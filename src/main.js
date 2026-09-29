import { createApp, computed, nextTick, reactive, ref, watch } from "./vendor/vue.esm-browser.prod.js";
import qrcode from "./vendor/qrcode-generator.min.mjs";
import { createSessionTransport } from "./session-transport.mjs";
import { AvatarCropDialog } from "./avatar-crop-dialog.mjs";
import { THEME_CHOICES, THEME_STORAGE_KEY, applyThemePreference, normalizeTheme, readThemePreference, saveThemePreference } from "./theme.mjs";
import {
  DEFAULT_GROUP_MINUTES,
  GROUP_DURATIONS,
  agendaRows,
  durationLabel,
  durationMinutes,
  freeMinutes,
  freeUntil,
  minutesToTime,
  occupations as roomOccupationsOf,
  startTimes,
  timeToMinutes,
  unavailableReason,
} from "./schedule.mjs";

const API_BASE = "/api";
const AUTH_SESSION_STORAGE_KEY = "compta-zik-auth-session";
const ACCOUNTING_YEAR = Number(localStorage.getItem("compta-zik-year")) || new Date().getFullYear();
const DEFAULT_TEACHER_HOURLY_RATE = 54;
const DEFAULT_GROUP_MEMBERSHIP_FEE = 30;
const COURSE_DURATION_HOURS = 0.5;
const WORKSHOP_DURATION_HOURS = 1.25;
const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const FRENCH_DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const PRINT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const EXPENSE_CATEGORIES = [
  { value: "EQUIPMENT", label: "Achat de matériel" },
  { value: "INSTRUMENT_REPAIR", label: "Réparation instrument" },
  { value: "MAINTENANCE", label: "Entretien" },
  { value: "ROOM_RENTAL", label: "Location de salle" },
  { value: "CONCERT", label: "Concert" },
  { value: "OTHER", label: "Autre" },
];
const CONFIG_PERMISSIONS = ["CONFIG_TEACHER", "CONFIG_FINANCIALS", "CONFIG_TERMS", "CONFIG_HOLIDAYS", "CONFIG_AUDIT"];
const BUSINESS_READ_PERMISSIONS = ["PRESENCE_READ", "MUSICIENS_READ", "GROUPS_READ", "EXPENSES_READ", "BILLING_READ", "MUSICIENS_ARCHIVED", "CONFIG_TEACHER", "CONFIG_FINANCIALS", "CONFIG_TERMS", "CONFIG_HOLIDAYS"];

const demoState = {
  settings: {
    year: ACCOUNTING_YEAR,
    teacherHourlyRate: DEFAULT_TEACHER_HOURLY_RATE,
    groupMembershipFee: DEFAULT_GROUP_MEMBERSHIP_FEE,
    individualCourseHours: COURSE_DURATION_HOURS,
    workshopHours: WORKSHOP_DURATION_HOURS,
    schoolHolidayWeeks: [8, 9],
    terms: [
      { id: "t1", name: "Trimestre 1", startWeek: 2, endWeek: 14 },
      { id: "t2", name: "Trimestre 2", startWeek: 16, endWeek: 27 },
      { id: "t3", name: "Trimestre 3", startWeek: 38, endWeek: 51 },
    ],
  },
  teachers: [
    { id: "teacher-yann", firstName: "Yann", lastName: "Bernard", instrument: "Guitare / basse" },
    { id: "teacher-mario", firstName: "Mario", lastName: "Rossi", instrument: "Batterie / chant / saxophone / piano" },
  ],
  musicians: [
    { id: "m1", firstName: "Julien", lastName: "Jeanjean", email: "" },
    { id: "m2", firstName: "Pauline", lastName: "Muguet", email: "" },
    { id: "m3", firstName: "Lionel", lastName: "Papillon", email: "" },
    { id: "m4", firstName: "François", lastName: "Savon", email: "" },
    { id: "m5", firstName: "Laureline", lastName: "Glu", email: "" },
    { id: "m6", firstName: "Nathalie", lastName: "Docker", email: "" },
    { id: "m7", firstName: "Laurent", lastName: "Blender", email: "" },
    { id: "m8", firstName: "Isabelle", lastName: "Signet", email: "" },
    { id: "m9", firstName: "Kevin", lastName: "Anneau", email: "" },
    { id: "m10", firstName: "Clément", lastName: "Disque", email: "" },
  ],
  bands: [
    { id: "band-1", name: "Capitaine Caverne", type: "independent", memberIds: ["m1"] },
    { id: "band-2", name: "All our Sins", type: "independent", memberIds: ["m2", "m3"] },
    { id: "band-3", name: "Groupe de travail Yann", type: "workshop", teacherId: "teacher-yann", weekday: "Mardi", memberIds: ["m4", "m5"] },
    { id: "band-4", name: "Groupe de travail Mario", type: "workshop", teacherId: "teacher-mario", weekday: "Mardi", memberIds: ["m8", "m10"] },
  ],
  individualCourses: [
    { id: "c1", musicianId: "m6", teacherId: "teacher-yann", instrument: "Guitare", weekday: "Lundi", startTime: "16:30" },
    { id: "c2", musicianId: "m7", teacherId: "teacher-yann", instrument: "Basse", weekday: "Lundi", startTime: "17:00" },
    { id: "c3", musicianId: "m8", teacherId: "teacher-mario", instrument: "Chant", weekday: "Mardi", startTime: "12:30" },
    { id: "c4", musicianId: "m9", teacherId: "teacher-mario", instrument: "Batterie", weekday: "Mardi", startTime: "13:00" },
    { id: "c5", musicianId: "m10", teacherId: "teacher-mario", instrument: "Piano", weekday: "Mardi", startTime: "16:30" },
  ],
  attendance: [
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-c1-${index}`, termId: "t1", week: index + 2, entityType: "individualCourse", entityId: "c1", present: true })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-c2-${index}`, termId: "t1", week: index + 2, entityType: "individualCourse", entityId: "c2", present: index !== 5 })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-c3-${index}`, termId: "t1", week: index + 2, entityType: "individualCourse", entityId: "c3", present: index % 2 === 0 })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-c4-${index}`, termId: "t1", week: index + 2, entityType: "individualCourse", entityId: "c4", present: index % 2 === 1 })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-c5-${index}`, termId: "t1", week: index + 2, entityType: "individualCourse", entityId: "c5", present: ![2, 8].includes(index) })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-b3-${index}`, termId: "t1", week: index + 2, entityType: "workshop", entityId: "band-3", present: true })),
    ...Array.from({ length: 13 }, (_, index) => ({ id: `a-b4-${index}`, termId: "t1", week: index + 2, entityType: "workshop", entityId: "band-4", present: index !== 9 })),
  ],
  expenses: [
    { id: "expense-1", year: ACCOUNTING_YEAR, date: `${ACCOUNTING_YEAR}-02-12`, category: "EQUIPMENT", label: "Câbles et pieds de micro", amount: 128.9, notes: "" },
    { id: "expense-2", year: ACCOUNTING_YEAR, date: `${ACCOUNTING_YEAR}-04-08`, category: "INSTRUMENT_REPAIR", label: "Révision ampli basse", amount: 86, notes: "" },
    { id: "expense-3", year: ACCOUNTING_YEAR, date: `${ACCOUNTING_YEAR}-06-14`, category: "ROOM_RENTAL", label: "Location salle concert", amount: 240, notes: "Concert de fin d'année" },
  ],
};

function fullName(person) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function apiBandTypeToUi(type) {
  return type === "WORKSHOP" ? "workshop" : "independent";
}

function uiBandTypeToApi(type) {
  return type === "workshop" ? "WORKSHOP" : "INDEPENDENT";
}

function apiAttendanceTypeToUi(type) {
  return type === "WORKSHOP" ? "workshop" : "individualCourse";
}

function uiAttendanceTypeToApi(type) {
  return type === "workshop" ? "WORKSHOP" : "INDIVIDUAL_COURSE";
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

function createId(prefix = "local") {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}-${timePart}-${randomPart}`;
}

function loadStoredAuthSession() {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  return null;
}

function normalizeAuthUser(user) {
  if (!user) return null;
  return {
    authenticated: true,
    roles: [],
    permissions: [],
    ...user,
  };
}

function normalizeAttendanceEntries(attendance = []) {
  return attendance.map((entry) => ({
    ...entry,
    entityType: apiAttendanceTypeToUi(entry.entityType),
    status: entry.status || (entry.present ? "PRESENT" : "ABSENT"),
  }));
}

function normalizeSnapshot(snapshot) {
  const settings = snapshot.settings || {};
  return {
    ...snapshot,
    settings: {
      ...settings,
      teacherHourlyRate: settings.teacherHourlyRate == null ? null : Number(settings.teacherHourlyRate),
      groupMembershipFee: settings.groupMembershipFee == null ? null : Number(settings.groupMembershipFee),
      individualCourseHours: Number(settings.individualCourseHours) || COURSE_DURATION_HOURS,
      workshopHours: Number(settings.workshopHours) || WORKSHOP_DURATION_HOURS,
      schoolHolidayWeeks: settings.schoolHolidayWeeks || [],
      terms: settings.terms || [],
    },
    teachers: (snapshot.teachers || []).map((teacher) => ({ active: true, ...teacher })),
    musicians: (snapshot.musicians || []).map((musician) => ({ active: true, ...musician })),
    bands: (snapshot.bands || []).map((band) => ({
      ...band,
      type: apiBandTypeToUi(band.type),
      memberIds: uniqueIds(band.memberIds),
    })),
    individualCourses: (snapshot.individualCourses || []).map((course) => ({ active: true, sharedSlot: false, ...course })),
    attendance: normalizeAttendanceEntries(snapshot.attendance),
    expenses: (snapshot.expenses || []).map((expense) => ({ notes: "", ...expense, amount: Number(expense.amount) || 0 })),
  };
}

function toApiPayload(resource, body) {
  if (!body) return null;
  if (resource.startsWith("bands") && Object.hasOwn(body, "type")) {
    return { ...body, type: uiBandTypeToApi(body.type) };
  }
    if (resource === "attendance") {
      return {
        version: body.version,
      termId: body.termId,
      week: body.week,
      entityType: uiAttendanceTypeToApi(body.entityType),
      entityId: body.entityId,
      present: body.status === "PRESENT",
      status: body.status,
      sessionDate: body.sessionDate,
    };
  }
  return body;
}

function weeksForTerm(term) {
  return Array.from({ length: term.endWeek - term.startWeek + 1 }, (_, index) => term.startWeek + index);
}

function money(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function hoursLabel(value) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(value) || 0)} h`;
}

function isoWeekNumber(value) {
  const date = new Date(value);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
}

function automaticTermForYear(terms, year, now = new Date()) {
  const orderedTerms = [...(terms || [])].sort((left, right) => (
    Number(left.displayOrder || left.startWeek) - Number(right.displayOrder || right.startWeek)
  ));
  if (!orderedTerms.length) return null;
  if (Number(year) < now.getFullYear()) return orderedTerms[orderedTerms.length - 1];
  if (Number(year) > now.getFullYear()) return orderedTerms[0];
  const currentWeek = isoWeekNumber(now);
  return orderedTerms.find((term) => currentWeek >= term.startWeek && currentWeek <= term.endWeek)
    || [...orderedTerms].reverse().find((term) => currentWeek >= term.startWeek)
    || orderedTerms[0];
}

function formatDate(value) {
  if (!value) return "";
  return SHORT_DATE.format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function categoryLabel(category) {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label || category;
}

function sortByName(items) {
  return [...items].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"));
}

function firstDayOfBusinessWeek(year, week) {
  if (week === 1) return new Date(year, 0, 1);
  const date = new Date(year, 0, 1);
  const day = date.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday + ((week - 2) * 7));
  return date;
}

function countLabel(count, singular, plural = `${singular}s`) {
  const normalizedCount = Number(count) || 0;
  return `${normalizedCount} ${Math.abs(normalizedCount) <= 1 ? singular : plural}`;
}

function emptyTotpDigits() {
  return Array.from({ length: 6 }, () => "");
}

const TotpCodeInput = {
  props: {
    modelValue: { type: Array, required: true },
    label: { type: String, default: "Code à six chiffres" },
    error: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    function normalizedDigits() {
      return emptyTotpDigits().map((_, index) => String(props.modelValue?.[index] || "").replace(/\D/g, "").slice(-1));
    }

    function updateDigits(nextDigits) {
      emit("update:modelValue", emptyTotpDigits().map((_, index) => nextDigits[index] || ""));
    }

    function focusDigit(event, index) {
      const inputs = event.currentTarget?.closest(".totp-input-group")?.querySelectorAll(".totp-digit");
      const input = inputs?.[Math.max(0, Math.min(5, index))];
      input?.focus();
      input?.select();
    }

    function synchronizeInputs(event, digits, focusIndex = null) {
      const group = event.currentTarget?.closest(".totp-input-group");
      nextTick(() => {
        const inputs = group?.querySelectorAll(".totp-digit");
        inputs?.forEach((input, index) => {
          input.value = digits[index] || "";
        });
        if (focusIndex !== null) {
          const input = inputs?.[Math.max(0, Math.min(5, focusIndex))];
          input?.focus();
          input?.select();
        }
      });
    }

    function distributeDigits(event, index, rawValue) {
      const entered = String(rawValue || "").replace(/\D/g, "");
      const next = normalizedDigits();
      if (!entered) {
        next[index] = "";
        updateDigits(next);
        synchronizeInputs(event, next, index);
        return;
      }
      const startIndex = entered.length >= 6 ? 0 : index;
      entered.slice(0, 6 - startIndex).split("").forEach((digit, offset) => {
        next[startIndex + offset] = digit;
      });
      updateDigits(next);
      synchronizeInputs(event, next, Math.min(startIndex + entered.length, 5));
    }

    function handleInput(event, index) {
      distributeDigits(event, index, event.target.value);
    }

    function handlePaste(event, index) {
      const pasted = event.clipboardData?.getData("text") || "";
      if (!/\d/.test(pasted)) return;
      event.preventDefault();
      distributeDigits(event, index, pasted);
    }

    function handleBeforeInput(event) {
      if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
        event.preventDefault();
      }
    }

    function handleKeydown(event, index) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusDigit(event, index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        focusDigit(event, index + 1);
      } else if (event.key === "Backspace" && !normalizedDigits()[index] && index > 0) {
        event.preventDefault();
        const next = normalizedDigits();
        next[index - 1] = "";
        updateDigits(next);
        synchronizeInputs(event, next, index - 1);
      } else if (event.key.length === 1 && !/\d/.test(event.key)) {
        event.preventDefault();
      }
    }

    return { handleInput, handlePaste, handleBeforeInput, handleKeydown };
  },
  template: `
    <fieldset class="totp-fieldset" :class="{ error }">
      <legend>{{ label }}</legend>
      <div class="totp-input-group" role="group" :aria-label="label" :aria-invalid="error ? 'true' : 'false'">
        <input
          v-for="(_, index) in 6"
          :key="index + '-' + (modelValue[index] || 'empty')"
          class="totp-digit"
          :class="{ filled: Boolean(modelValue[index]) }"
          :value="modelValue[index] || ''"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="1"
          autocomplete="off"
          :autofocus="autofocus && index === 0"
          :aria-label="'Chiffre ' + (index + 1) + ' sur 6'"
          @input="handleInput($event, index)"
          @paste="handlePaste($event, index)"
          @beforeinput="handleBeforeInput($event)"
          @keydown="handleKeydown($event, index)"
          @focus="$event.currentTarget.select()"
        />
      </div>
    </fieldset>
  `,
};

const app = createApp({
  setup() {
    const state = reactive(structuredClone(demoState));
    const selectedTermId = ref("t1");
    const activeView = ref("dashboard");
    const billingTab = ref("students");
    const authSession = ref(loadStoredAuthSession());
    const apiStatus = ref(authSession.value ? "connecté" : "déconnecté");
    const currentUser = ref(normalizeAuthUser(authSession.value?.user));
    const apiBase = ref(API_BASE);
    const sessionTransport = createSessionTransport({
      getSession: () => authSession.value,
      applySession: storeAuthSession,
      clearSession: clearAuthSession,
      getApiBase: () => apiBase.value,
    });
    const loginError = ref("");
    const authLoading = ref(false);
    const authFlowPending = ref(true);
    const loginForm = reactive({
      username: "",
      password: "",
      rememberMe: true,
    });
    const mfaChallenge = reactive({
      active: false,
      token: "",
      expiresAt: "",
      methods: [],
      code: "",
    });
    const mfaLoginError = ref("");
    const mfaLoginMode = ref("totp");
    const mfaLoginDigits = ref(emptyTotpDigits());
    const twoFactorStatus = ref(null);
    const twoFactorLoading = ref(false);
    const mfaSetup = ref(null);
    const mfaSetupDigits = ref(emptyTotpDigits());
    const mfaSetupError = ref("");
    const mfaRecoveryCodes = ref([]);
    const mfaRecoveryRequiresRelogin = ref(false);
    const mfaSetupForm = reactive({ password: "", code: "" });
    const mfaRecoveryForm = reactive({ code: "" });
    const mfaDisableForm = reactive({ password: "", code: "" });
    const mfaAccountAction = ref("");
    const accountingYearInput = ref(state.settings.year);
    const copySourceYear = ref(state.settings.year - 1);
    const search = ref("");
    const groupSearch = ref("");
    const groupListSearch = ref("");
    const selectedGroupId = ref("band-1");
    const musicianFilter = ref("all");
    // Formulaires tels qu'ouverts : sert à signaler les modifications non enregistrées.
    const musicianFormSnapshot = ref("");
    const groupFormSnapshot = ref("");
    const holidayWeekToAdd = ref("");
    const preparedStudentInvoices = ref(false);
    const studentInvoiceDocuments = ref([]);
    const studentInvoiceSummaryDocument = ref(null);
    const markingStudentInvoicesSent = ref(false);
    const studentInvoicesToSend = computed(() => studentInvoiceDocuments.value.filter(
      document => document.type === "STUDENT_INVOICE" && document.musicianId && document.status === "GENERATED",
    ));
    const teacherInvoiceRequestDocuments = ref([]);
    const teacherEndWeeks = reactive({});
    const documentHistory = ref([]);
    const billingSummary = ref(null);
    const billingSummariesByTerm = ref({});
    const billingStatus = ref("idle");
    const billingError = ref("");
    let billingRequestSequence = 0;
    const selectedImportFile = ref(null);
    const importPayload = ref(null);
    const importAnalysis = ref(null);
    const importConfirmation = ref("");
    const backupFiles = ref([]);
    const backupListLoaded = ref(false);
    const transferBusy = ref(false);
    const selectedRestoreFile = ref(null);
    const restoreAnalysis = ref(null);
    const restoreConfirmation = ref("");
    watch(activeView, (view) => {
      if (view === "data-transfer" && can("IMPORT_EXPORT")) loadBackups();
    });
    const currentUserAvatarUrl = ref("");
    const avatarFile = ref(null);
    const avatarCropFile = ref(null);
    const avatarUploading = ref(false);
    const avatarUploadError = ref("");
    let avatarUploadSequence = 0;
    const authUsers = ref([]);
    const authUserAvatarUrls = reactive({});
    const authRoles = ref([]);
    const authUsersPage = ref({ total: 0, limit: 50, offset: 0 });
    const authUserSearch = ref("");
    const generatedTemporaryPassword = ref("");
    const toasts = ref([]);
    const auditEvents = ref([]);
    const savingAttendanceKeys = reactive(new Set());
    const attendanceTeacherFilterId = ref("");
    const editingMusicianId = ref(null);
    const editingTeacherId = ref(null);
    const musicianFormOpen = ref(false);
    const teacherFormOpen = ref(false);
    const editingExpenseId = ref(null);
    const teacherForm = reactive({
      firstName: "",
      lastName: "",
      instrument: "",
      active: true,
    });
    const musicianForm = reactive({
      firstName: "",
      lastName: "",
      email: "",
      bandIds: [],
      inWorkshop: false,
      workshopBandId: "band-3",
      hasIndividualCourse: false,
      sharedSlot: false,
      courseId: null,
      teacherId: "teacher-yann",
      instrument: "Guitare",
      weekday: "Lundi",
      startTime: "11:30",
    });
    const groupForm = reactive({
      name: "",
      type: "independent",
      teacherId: "teacher-yann",
      weekday: "Mardi",
      memberIds: [],
      startTime: "",
      durationMinutes: DEFAULT_GROUP_MINUTES,
    });
    const expenseForm = reactive({
      date: `${state.settings.year}-01-01`,
      category: "EQUIPMENT",
      label: "",
      amount: 0,
      notes: "",
    });
    const profileForm = reactive({
      displayName: "",
      email: "",
      locale: "fr-FR",
      phone: "",
    });
    const passwordForm = reactive({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: false,
    });
    const passwordVisibility = reactive({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
    const userAdminForm = reactive({
      username: "",
      displayName: "",
      email: "",
      roles: ["OBSERVER"],
    });
    const editingAuthUserId = ref(null);
    const authUserEditForm = reactive({
      username: "",
      displayName: "",
      email: "",
      roles: [],
    });

    const selectedTerm = computed(() => state.settings.terms.find((term) => term.id === selectedTermId.value) || state.settings.terms[0]);
    const automaticTerm = computed(() => automaticTermForYear(state.settings.terms, state.settings.year));
    const dashboardDateLabel = computed(() => FRENCH_DATE.format(new Date()));
    const yearStatus = computed(() => state.settings.status || "OPEN");
    const structureLocked = computed(() => yearStatus.value !== "OPEN");
    const yearClosed = computed(() => yearStatus.value === "CLOSED");
    const yearStatusLabel = computed(() => ({
      OPEN: "Ouverte",
      REVIEWED: "En revue",
      CLOSED: "Clôturée",
    })[yearStatus.value] || yearStatus.value);
    const isFirstTerm = computed(() => selectedTerm.value?.id === state.settings.terms[0]?.id);
    const weeks = computed(() => weeksForTerm(selectedTerm.value));
    const allYearWeeks = computed(() => Array.from({ length: 53 }, (_, index) => index + 1));
    const workshopBands = computed(() => state.bands.filter((band) => band.type === "workshop"));
    const independentBands = computed(() => state.bands.filter((band) => band.type === "independent"));
    const musiciansById = computed(() => Object.fromEntries(state.musicians.map((musician) => [musician.id, musician])));
    const activeMusicians = computed(() => state.musicians.filter((musician) => musician.active !== false));
    const archivedMusicians = computed(() => sortByName(state.musicians.filter((musician) => musician.active === false)));
    const teachersById = computed(() => Object.fromEntries(state.teachers.map((teacher) => [teacher.id, teacher])));
    const coursesById = computed(() => Object.fromEntries(state.individualCourses.map((course) => [course.id, course])));
    const bandsById = computed(() => Object.fromEntries(state.bands.map((band) => [band.id, band])));
    const timeSlots = computed(() => startTimes());

    // Planning de la salle (écran Créneaux) — règles partagées avec le backend dans schedule.mjs.
    const AGENDA_ROWS = agendaRows();
    // Hauteurs en variables CSS : l'impression les agrandit pour tenir la semaine sur une page A4 paysage.
    const agendaTemplateRows = `var(--agenda-head, 44px) ${AGENDA_ROWS.map((row) => (row.type === "pause" ? "var(--agenda-pause, 34px)" : "var(--agenda-row, 22px)")).join(" ")}`;
    const roomOccupations = computed(() => roomOccupationsOf({
      settings: state.settings,
      courses: state.individualCourses,
      bands: state.bands,
      isActiveCourse,
    }));
    const slotsTeacherFilter = ref("");
    const slotsSelection = ref(null);
    const slotBandToPlaceId = ref("");
    const narrowScreenQuery = window.matchMedia("(max-width: 760px)");
    const isNarrowScreen = ref(narrowScreenQuery.matches);
    narrowScreenQuery.addEventListener("change", (event) => {
      isNarrowScreen.value = event.matches;
    });
    const todayWeekday = WEEKDAYS[new Date().getDay() - 1] || null;
    const slotsDay = ref(todayWeekday || WEEKDAYS[0]);
    // À l'impression, la semaine entière s'affiche, même depuis un écran étroit (bouton ou Ctrl+P).
    const slotsPrinting = ref(false);
    const slotsPrintDate = ref("");
    window.addEventListener("beforeprint", () => {
      slotsPrintDate.value = PRINT_DATE.format(new Date());
      slotsPrinting.value = true;
    });
    window.addEventListener("afterprint", () => {
      slotsPrinting.value = false;
    });
    const slotsHighlightedTeacher = computed(() => teachersById.value[slotsTeacherFilter.value] || null);

    function agendaRow(minutes) {
      return AGENDA_ROWS.findIndex((row) => row.type === "slot" && row.minutes === minutes) + 2;
    }

    function occupationBlock(group, day) {
      const first = group[0];
      const end = first.start + first.minutes;
      const timeLabel = `${minutesToTime(first.start)}–${minutesToTime(end)}`;
      const teacherIds = group.map((occupation) => occupation.item.teacherId).filter(Boolean);
      let title;
      let detail;
      let chip;
      if (first.kind === "course") {
        const musicians = group.map((occupation) => musiciansById.value[occupation.item.musicianId]).filter(Boolean);
        const teacher = teachersById.value[first.item.teacherId];
        title = musicians.map(fullName).join(" · ") || "Cours";
        detail = group.length > 1 ? `Créneau partagé · ${teacher ? fullName(teacher) : ""}` : [first.item.instrument, teacher ? fullName(teacher) : ""].filter(Boolean).join(" · ");
        chip = "Cours";
      } else {
        const teacher = teachersById.value[first.item.teacherId];
        title = first.item.name;
        detail = first.kind === "workshop"
          ? (teacher ? fullName(teacher) : "Atelier")
          : countLabel(uniqueIds(first.item.memberIds).length, "musicien");
        chip = first.kind === "workshop" ? "Atelier" : "Groupe";
      }
      return {
        key: `${day}-${first.kind}-${first.start}-${first.id}`,
        kind: first.kind,
        row: agendaRow(first.start),
        span: Math.max(1, Math.ceil(first.minutes / 15)),
        compact: first.minutes <= 30,
        timeLabel,
        title,
        detail,
        chip,
        description: `${chip} · ${day} ${timeLabel} · ${title}${detail ? ` · ${detail}` : ""}`,
        dimmed: Boolean(slotsTeacherFilter.value) && !teacherIds.includes(slotsTeacherFilter.value),
      };
    }

    const agendaDays = computed(() => (isNarrowScreen.value && !slotsPrinting.value ? [slotsDay.value] : WEEKDAYS).map((day) => {
      const dayOccupations = roomOccupations.value.filter((occupation) => occupation.weekday === day);
      const groups = [];
      [...dayOccupations].sort((left, right) => left.start - right.start).forEach((occupation) => {
        const shared = occupation.kind === "course" && groups.find((group) => group[0].kind === "course" && group[0].start === occupation.start);
        if (shared) shared.push(occupation);
        else groups.push([occupation]);
      });
      const freeCells = timeSlots.value
        .map((time) => timeToMinutes(time))
        .filter((start) => !dayOccupations.some((occupation) => start < occupation.start + occupation.minutes && occupation.start < start + 15))
        .map((start) => ({ time: minutesToTime(start), row: agendaRow(start) }));
      return {
        name: day,
        isToday: day === todayWeekday,
        freeLabel: `${durationLabel(freeMinutes(dayOccupations))} libres`,
        blocks: groups.map((group) => occupationBlock(group, day)),
        freeCells,
      };
    }));

    const unplacedBands = computed(() => [...state.bands]
      .filter((band) => !band.weekday || !band.startTime)
      .sort((left, right) => left.name.localeCompare(right.name, "fr")));

    function bandCandidate(band, weekday, time) {
      return {
        id: band.id,
        kind: band.type === "workshop" ? "workshop" : "group",
        weekday,
        start: timeToMinutes(time),
        minutes: durationMinutes(state.settings, band.type === "workshop" ? "workshop" : "group", band.durationMinutes),
        sharedSlot: false,
      };
    }

    const slotSelectionInfo = computed(() => {
      const selection = slotsSelection.value;
      if (!selection) return null;
      const dayOccupations = roomOccupations.value.filter((occupation) => occupation.weekday === selection.day);
      const start = timeToMinutes(selection.time);
      const until = freeUntil(start, dayOccupations);
      return { ...selection, until: minutesToTime(until), freeLabel: durationLabel(until - start) };
    });

    const fittingUnplacedBands = computed(() => {
      const selection = slotsSelection.value;
      if (!selection) return [];
      return unplacedBands.value.filter((band) => !unavailableReason(bandCandidate(band, selection.day, selection.time), roomOccupations.value));
    });

    function selectFreeSlot(day, time) {
      slotsSelection.value = { day, time };
      slotBandToPlaceId.value = fittingUnplacedBands.value[0]?.id || "";
    }

    function closeSlotSelection() {
      slotsSelection.value = null;
    }

    async function printSlots() {
      slotsSelection.value = null;
      slotsPrintDate.value = PRINT_DATE.format(new Date());
      slotsPrinting.value = true;
      await nextTick();
      window.print();
    }

    async function placeBand() {
      const band = state.bands.find((item) => item.id === slotBandToPlaceId.value);
      const selection = slotsSelection.value;
      if (!band || !selection || !can("GROUPS_WRITE") || !ensureStructureMutable()) return;
      const payload = {
        id: band.id,
        version: band.version,
        year: state.settings.year,
        name: band.name,
        type: band.type,
        teacherId: band.type === "workshop" ? band.teacherId : undefined,
        weekday: selection.day,
        startTime: selection.time,
        durationMinutes: band.type === "workshop" ? null : band.durationMinutes || DEFAULT_GROUP_MINUTES,
        memberIds: uniqueIds(band.memberIds),
      };
      const saved = await requestResource("PUT", `bands/${band.id}`, payload, {
        successMessage: `${band.name} placé ${selection.day} à ${selection.time}`,
        errorMessage: "Placement refusé : le groupe reste à placer",
      });
      if (!saved) return;
      Object.assign(band, { ...saved, type: apiBandTypeToUi(saved.type), memberIds: uniqueIds(saved.memberIds) });
      slotsSelection.value = null;
    }

    function newCourseAt(day, time) {
      if (!startNewMusician()) return;
      activeView.value = "people";
      Object.assign(musicianForm, { hasIndividualCourse: true, weekday: day, startTime: time });
      slotsSelection.value = null;
    }

    function newGroupAt(day, time) {
      if (!confirmDiscardChanges(groupFormDirty.value)) return;
      activeView.value = "groups";
      resetGroupForm();
      Object.assign(groupForm, { weekday: day, startTime: time });
      slotsSelection.value = null;
    }

    function openBandInGroups(bandId) {
      if (bandId !== selectedGroupId.value && !confirmDiscardChanges(groupFormDirty.value)) return;
      activeView.value = "groups";
      selectGroup(bandId);
    }

    const groupStartOptions = computed(() => {
      const candidate = { id: selectedGroupId.value || null, type: groupForm.type, durationMinutes: groupForm.durationMinutes };
      const minutes = durationMinutes(state.settings, groupForm.type === "workshop" ? "workshop" : "group", groupForm.durationMinutes);
      return timeSlots.value.map((time) => {
        const reason = unavailableReason(bandCandidate(candidate, groupForm.weekday, time), roomOccupations.value);
        return { time, reason, label: `${time}–${minutesToTime(timeToMinutes(time) + minutes)}${reason ? ` · ${reason}` : ""}` };
      });
    });

    const groupStartWarning = computed(() => (
      groupForm.startTime ? groupStartOptions.value.find((option) => option.time === groupForm.startTime)?.reason || null : null
    ));
    const passwordRequirements = computed(() => {
      const value = passwordForm.newPassword || "";
      return [
        { key: "length", label: "12 caractères minimum", valid: value.length >= 12 },
        { key: "lowercase", label: "Une minuscule", valid: /[a-z]/.test(value) },
        { key: "uppercase", label: "Une majuscule", valid: /[A-Z]/.test(value) },
        { key: "digit", label: "Un chiffre", valid: /\d/.test(value) },
        { key: "special", label: "Un caractère spécial", valid: /[^A-Za-z0-9]/.test(value) },
      ];
    });
    const isNewPasswordValid = computed(() => passwordRequirements.value.every((rule) => rule.valid));
    const passwordStrength = computed(() => passwordRequirements.value.filter((rule) => rule.valid).length);
    const isPasswordConfirmationValid = computed(
      () => Boolean(passwordForm.confirmPassword) && passwordForm.newPassword === passwordForm.confirmPassword,
    );
    const isPasswordChangeReady = computed(
      () => Boolean(passwordForm.currentPassword) && isNewPasswordValid.value && isPasswordConfirmationValid.value,
    );
    const passwordChangeHelp = computed(() => {
      if (!passwordForm.currentPassword) return "Renseignez le mot de passe actuel pour continuer.";
      if (!isNewPasswordValid.value) return "Respectez les cinq contraintes du nouveau mot de passe.";
      if (!passwordForm.confirmPassword) return "Confirmez le nouveau mot de passe.";
      if (!isPasswordConfirmationValid.value) return "La confirmation doit être identique au nouveau mot de passe.";
      return "Le mot de passe peut être modifié.";
    });
    const viewUsesTerm = computed(() => ["dashboard", "attendance", "signatures", "people", "billing"].includes(activeView.value));

    function matchesMusicianSearch(musician, query) {
      if (!query) return true;
      return `${fullName(musician)} ${musician.email || ""}`.toLowerCase().includes(query);
    }

    function musicianHasCourse(musician) {
      return state.individualCourses.some((course) => course.musicianId === musician.id && course.active !== false);
    }

    function musicianInBandType(musician, type) {
      return state.bands.some((band) => band.type === type && band.memberIds.includes(musician.id));
    }

    const MUSICIAN_FILTER_TESTS = {
      all: () => true,
      course: musicianHasCourse,
      bands: (musician) => musicianInBandType(musician, "independent"),
      workshop: (musician) => musicianInBandType(musician, "workshop"),
    };

    const musicianFilters = computed(() => {
      const filters = [];
      if (canAny(["MUSICIENS_READ", "MUSICIENS_WRITE"])) {
        [["all", "Tous"], ["course", "Cours"], ["bands", "Groupes"], ["workshop", "Ateliers"]].forEach(([value, label]) => {
          filters.push({ value, label, count: activeMusicians.value.filter(MUSICIAN_FILTER_TESTS[value]).length });
        });
      }
      if (can("MUSICIENS_ARCHIVED")) filters.push({ value: "archived", label: "Archivés", count: archivedMusicians.value.length });
      return filters;
    });

    const activeMusicianFilter = computed(() => (
      musicianFilters.value.some((filter) => filter.value === musicianFilter.value)
        ? musicianFilter.value
        : musicianFilters.value[0]?.value || "all"
    ));

    const filteredMusicians = computed(() => {
      const q = search.value.trim().toLowerCase();
      const test = MUSICIAN_FILTER_TESTS[activeMusicianFilter.value] || MUSICIAN_FILTER_TESTS.all;
      return sortByName(activeMusicians.value).filter((musician) => matchesMusicianSearch(musician, q) && test(musician));
    });

    const filteredArchivedMusicians = computed(() => {
      const q = search.value.trim().toLowerCase();
      return archivedMusicians.value.filter((musician) => matchesMusicianSearch(musician, q));
    });

    const selectedGroup = computed(() => state.bands.find((band) => band.id === selectedGroupId.value) || state.bands[0]);

    const sortedIndependentBands = computed(() => [...independentBands.value].sort((a, b) => a.name.localeCompare(b.name, "fr")));
    const sortedWorkshopBands = computed(() => [...workshopBands.value].sort((a, b) => a.name.localeCompare(b.name, "fr")));

    /** « Jeu 18:00–19:15 », ou vide pour un groupe à placer. */
    function bandScheduleLabel(band) {
      if (!band?.weekday || !band.startTime) return "";
      const minutes = durationMinutes(state.settings, band.type === "workshop" ? "workshop" : "group", band.durationMinutes);
      return `${band.weekday.slice(0, 3)} ${band.startTime}–${minutesToTime(timeToMinutes(band.startTime) + minutes)}`;
    }

    function personInitials(person) {
      return `${person?.firstName?.[0] || ""}${person?.lastName?.[0] || ""}`.toUpperCase() || "?";
    }

    function courseSummary(musician) {
      const course = state.individualCourses.find((item) => item.musicianId === musician.id && item.active !== false);
      if (!course) return "";
      const teacher = teachersById.value[course.teacherId];
      return [course.instrument, teacher?.firstName].filter(Boolean).join(" · ");
    }

    const groupSections = computed(() => {
      const q = groupListSearch.value.trim().toLowerCase();
      const matches = (band) => !q || band.name.toLowerCase().includes(q);
      return [
        { key: "workshop", label: "Ateliers", bands: sortedWorkshopBands.value.filter(matches) },
        { key: "independent", label: "Groupes musicaux", bands: sortedIndependentBands.value.filter(matches) },
      ].filter((section) => section.bands.length);
    });

    function bandMemberPreview(band) {
      const musicians = sortByName(uniqueIds(band.memberIds).map((id) => musiciansById.value[id]).filter(Boolean));
      return { shown: musicians.slice(0, 4), more: Math.max(0, musicians.length - 4) };
    }

    function courseTimeLabel(course) {
      const end = timeToMinutes(course.startTime) + durationMinutes(state.settings, "course");
      return `${course.weekday.slice(0, 3)} ${course.startTime}–${minutesToTime(end)}`;
    }

    /** Membres cochés en tête, puis les autres musiciens actifs ; filtre sur le nom. */
    const groupMemberRows = computed(() => {
      const q = groupSearch.value.trim().toLowerCase();
      const rows = sortByName(activeMusicians.value)
        .filter((musician) => matchesMusicianSearch(musician, q))
        .map((musician) => ({
          musician,
          course: courseSummary(musician),
          otherBands: state.bands
            .filter((band) => band.id !== selectedGroupId.value && band.memberIds.includes(musician.id))
            .map((band) => band.name)
            .join(", "),
        }));
      const members = rows.filter((row) => groupForm.memberIds.includes(row.musician.id)).map((row) => ({ ...row, checked: true }));
      const others = rows.filter((row) => !groupForm.memberIds.includes(row.musician.id)).map((row, index) => ({
        ...row,
        checked: false,
        firstOther: index === 0 && members.length > 0,
      }));
      return [...members, ...others];
    });

    const groupFormDirty = computed(() => JSON.stringify(groupForm) !== groupFormSnapshot.value);
    const musicianFormDirty = computed(() => musicianFormOpen.value && JSON.stringify(musicianForm) !== musicianFormSnapshot.value);

    const musicianSheetSummary = computed(() => {
      const parts = [];
      if (musicianForm.hasIndividualCourse) parts.push(`Cours de ${musicianForm.instrument || "musique"}`);
      if (musicianForm.bandIds.length) parts.push(countLabel(musicianForm.bandIds.length, "groupe"));
      const workshop = musicianForm.inWorkshop && state.bands.find((band) => band.id === musicianForm.workshopBandId);
      if (workshop) parts.push(workshop.name);
      return parts.join(" · ") || "Aucune activité";
    });

    const selectedHolidayWeeks = computed(() => [...(state.settings.schoolHolidayWeeks || [])].sort((a, b) => a - b));
    const availableHolidayWeeks = computed(() => allYearWeeks.value.filter((week) => !selectedHolidayWeeks.value.includes(week)));

    const attendanceIndex = computed(() => {
      const map = new Map();
      state.attendance.forEach((entry) => {
        map.set(`${entry.termId}:${entry.entityType}:${entry.entityId}:${entry.week}`, entry);
      });
      return map;
    });

    const studentDraftsByMusicianId = computed(() => Object.fromEntries(
      (billingSummary.value?.studentInvoices || []).map((draft) => [draft.musicianId, draft]),
    ));

    const musicianRows = computed(() => filteredMusicians.value.map((musician) => (
      buildMusicianAccountingRow(musician, studentDraftsByMusicianId.value[musician.id])
    )));

    const studentBillingRows = computed(() => (billingSummary.value?.studentInvoices || [])
      .map((draft) => musiciansById.value[draft.musicianId] && buildMusicianAccountingRow(
        musiciansById.value[draft.musicianId],
        draft,
      ))
      .filter(Boolean));

    function buildMusicianAccountingRow(musician, draft) {
      const course = state.individualCourses.find((item) => item.musicianId === musician.id);
      const bands = state.bands.filter((band) => band.memberIds.includes(musician.id));
      return {
        musician,
        course,
        bands,
        courseCount: draft?.individualCourseCount ?? 0,
        courseDue: draft ? Number(draft.individualCourseAmount) : null,
        groupFee: draft ? Number(draft.groupMembershipAmount) : null,
        totalDue: draft ? Number(draft.totalAmount) : null,
      };
    }

    const attendanceCourseRows = computed(() => state.individualCourses
      .map((course) => {
        const musician = musiciansById.value[course.musicianId];
        const teacher = teachersById.value[course.teacherId];
        return { course, musician, teacher, count: countPresences("individualCourse", course.id) };
      })
      .filter((row) => row.musician && row.teacher && (isActiveCourse(row.course) || hasTermAttendance("individualCourse", row.course.id)))
      .filter((row) => !attendanceTeacherFilterId.value || row.course.teacherId === attendanceTeacherFilterId.value)
      .sort((a, b) => `${a.course.weekday} ${a.course.startTime} ${fullName(a.musician)}`.localeCompare(`${b.course.weekday} ${b.course.startTime} ${fullName(b.musician)}`, "fr")));

    const attendanceWorkshopRows = computed(() => workshopBands.value
      .map((band) => ({ band, teacher: teachersById.value[band.teacherId], count: countPresences("workshop", band.id) }))
      .filter((row) => !attendanceTeacherFilterId.value || row.band.teacherId === attendanceTeacherFilterId.value)
      .sort((a, b) => a.band.name.localeCompare(b.band.name, "fr")));

    const ATTENDANCE_STATUS_WORDS = { PRESENT: "présent", ABSENT: "absent", CANCELLED: "annulé", UNRECORDED: "non renseigné" };
    const TERM_DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

    function weekdayShort(weekday) {
      return weekday ? weekday.slice(0, 3) : "";
    }

    function weekdayOrder(weekday) {
      const index = WEEKDAYS.indexOf(weekday);
      return index < 0 ? WEEKDAYS.length : index;
    }

    // Grille : un groupe par professeur (cours individuels), puis les ateliers.
    const attendanceGroups = computed(() => {
      const byTeacher = new Map();
      attendanceCourseRows.value.forEach((row) => {
        if (!byTeacher.has(row.teacher.id)) byTeacher.set(row.teacher.id, { teacher: row.teacher, rows: [] });
        byTeacher.get(row.teacher.id).rows.push(row);
      });
      const teacherGroups = [...byTeacher.values()]
        .sort((left, right) => fullName(left.teacher).localeCompare(fullName(right.teacher), "fr"))
        .map(({ teacher, rows }) => ({
          key: `teacher-${teacher.id}`,
          title: fullName(teacher),
          subtitle: ["Cours individuels", teacher.instrument].filter(Boolean).join(" · "),
          rows: [...rows]
            .sort((left, right) => (
              weekdayOrder(left.course.weekday) - weekdayOrder(right.course.weekday)
              || String(left.course.startTime).localeCompare(String(right.course.startTime))
              || fullName(left.musician).localeCompare(fullName(right.musician), "fr")
            ))
            .map((row) => ({
              key: `course-${row.course.id}`,
              entityType: "individualCourse",
              entityId: row.course.id,
              time: `${weekdayShort(row.course.weekday)} ${row.course.startTime || ""}`.trim(),
              name: fullName(row.musician),
              detail: row.course.instrument || "",
              count: row.count,
            })),
        }));
      const workshopRows = attendanceWorkshopRows.value.map((row) => ({
        key: `workshop-${row.band.id}`,
        entityType: "workshop",
        entityId: row.band.id,
        time: weekdayShort(row.band.weekday),
        name: row.band.name,
        detail: [row.teacher ? fullName(row.teacher) : "", countLabel(memberCount(row.band), "musicien")].filter(Boolean).join(" · "),
        count: row.count,
      }));
      return workshopRows.length
        ? [...teacherGroups, {
          key: "workshops",
          title: "Ateliers",
          subtitle: `Groupes de travail encadrés · ${hoursLabel(state.settings.workshopHours)} par séance`,
          rows: workshopRows,
        }]
        : teacherGroups;
    });

    const currentAttendanceWeek = computed(() => {
      const now = new Date();
      if (Number(state.settings.year) !== now.getFullYear()) return null;
      const week = isoWeekNumber(now);
      return weeks.value.includes(week) ? week : null;
    });

    const attendanceWeekSummary = computed(() => {
      const week = currentAttendanceWeek.value;
      if (!week) return null;
      const summary = { week, PRESENT: 0, ABSENT: 0, CANCELLED: 0, UNRECORDED: 0 };
      attendanceGroups.value.forEach((group) => group.rows.forEach((row) => {
        summary[attendanceStatus(row.entityType, row.entityId, week)] += 1;
      }));
      return summary;
    });

    const attendanceTotalPresent = computed(() => attendanceGroups.value
      .reduce((sum, group) => sum + group.rows.reduce((groupSum, row) => groupSum + row.count, 0), 0));

    const attendanceSaving = computed(() => savingAttendanceKeys.size > 0);

    // Émargement mobile par jour (partition.md §6) : semaine du trimestre, onglets Lun–Ven, une carte par séance.
    const DAY_ENTRY_CHOICES = [
      { value: "PRESENT", label: "Présent" },
      { value: "ABSENT", label: "Absent" },
      { value: "CANCELLED", label: "Annulé" },
    ];
    const dayEntryWeek = ref(null);
    const dayEntryDay = ref(null);

    const dayEntryWeekValue = computed(() => (
      weeks.value.includes(dayEntryWeek.value) ? dayEntryWeek.value : (currentAttendanceWeek.value || weeks.value[0] || null)
    ));

    function dayEntryMonday(week) {
      const first = firstDayOfBusinessWeek(Number(state.settings.year), week);
      first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
      return first;
    }

    function dayEntrySessionsFor(dayName) {
      const courses = state.individualCourses
        .filter((course) => course.weekday === dayName)
        .map((course) => ({ course, musician: musiciansById.value[course.musicianId], teacher: teachersById.value[course.teacherId] }))
        .filter((row) => row.musician && row.teacher && (isActiveCourse(row.course) || hasTermAttendance("individualCourse", row.course.id)))
        .map((row) => ({
          key: `course-${row.course.id}`,
          entityType: "individualCourse",
          entityId: row.course.id,
          time: row.course.startTime || "",
          name: fullName(row.musician),
          detail: [row.course.instrument, fullName(row.teacher)].filter(Boolean).join(" · "),
        }));
      const workshops = workshopBands.value
        .filter((band) => band.weekday === dayName)
        .map((band) => ({
          key: `workshop-${band.id}`,
          entityType: "workshop",
          entityId: band.id,
          time: "Atelier",
          name: band.name,
          detail: [countLabel(memberCount(band), "musicien"), teachersById.value[band.teacherId] ? fullName(teachersById.value[band.teacherId]) : ""].filter(Boolean).join(" · "),
        }));
      return [...courses.sort((left, right) => String(left.time).localeCompare(String(right.time))), ...workshops];
    }

    const dayEntryDays = computed(() => {
      const week = dayEntryWeekValue.value;
      if (!week) return [];
      const monday = dayEntryMonday(week);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return WEEKDAYS.map((name, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        const sessions = dayEntrySessionsFor(name);
        return {
          name,
          short: weekdayShort(name),
          date,
          number: date.getDate(),
          isToday: date.getTime() === today.getTime(),
          pending: date <= today && sessions.some((session) => attendanceStatus(session.entityType, session.entityId, week) === "UNRECORDED"),
          sessionCount: sessions.length,
        };
      });
    });

    const dayEntryDayValue = computed(() => {
      const days = dayEntryDays.value;
      if (days.some((day) => day.name === dayEntryDay.value)) return dayEntryDay.value;
      return (days.find((day) => day.isToday) || days.find((day) => day.sessionCount) || days[0])?.name || WEEKDAYS[0];
    });

    const dayEntrySessions = computed(() => dayEntrySessionsFor(dayEntryDayValue.value));

    const dayEntryTitle = computed(() => {
      const day = dayEntryDays.value.find((item) => item.name === dayEntryDayValue.value);
      return day ? `${day.name} ${day.number}` : dayEntryDayValue.value;
    });

    const dayEntryWeekLabel = computed(() => {
      const week = dayEntryWeekValue.value;
      if (!week) return "";
      const start = dayEntryMonday(week);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startLabel = start.getMonth() === end.getMonth() ? String(start.getDate()) : TERM_DAY_FORMAT.format(start);
      return `${startLabel} → ${TERM_DAY_FORMAT.format(end)} · ${selectedTerm.value?.name || ""}`;
    });

    const dayEntryRecorded = computed(() => dayEntrySessions.value
      .filter((session) => attendanceStatus(session.entityType, session.entityId, dayEntryWeekValue.value) !== "UNRECORDED").length);

    function shiftDayEntryWeek(delta) {
      const index = weeks.value.indexOf(dayEntryWeekValue.value);
      const next = weeks.value[index + delta];
      if (!next) return;
      dayEntryWeek.value = next;
      dayEntryDay.value = null;
    }

    const mobileMenuOpen = ref(false);
    const mobileTabs = computed(() => {
      if (mustChangePassword.value) return [];
      return [
        { view: "dashboard", label: "Tableau", visible: true },
        { view: "attendance", label: "Présences", visible: can("PRESENCE_READ") },
        { view: "signatures", label: "Émargement", visible: can("PRESENCE_READ") },
      ].filter((tab) => tab.visible);
    });

    watch(activeView, () => {
      mobileMenuOpen.value = false;
    });
    watch(selectedTermId, () => {
      dayEntryWeek.value = null;
      dayEntryDay.value = null;
    });
    watch(mobileMenuOpen, (open) => {
      nextTick(() => {
        if (open) document.querySelector(".sidebar-close")?.focus();
        else if (document.activeElement === document.body || document.activeElement?.closest(".sidebar")) document.querySelector(".tab-more")?.focus();
      });
    });

    const termEyebrow = computed(() => {
      const term = selectedTerm.value;
      if (!term) return "";
      const year = Number(state.settings.year);
      const start = firstDayOfBusinessWeek(year, term.startWeek);
      const end = firstDayOfBusinessWeek(year, term.endWeek);
      end.setDate(end.getDate() + 6);
      return `${term.name} · semaines ${term.startWeek} à ${term.endWeek} · ${TERM_DAY_FORMAT.format(start)} → ${TERM_DAY_FORMAT.format(end)}`;
    });

    function attendanceCellLabel(row, week) {
      const status = attendanceStatus(row.entityType, row.entityId, week);
      const date = attendanceDateLabel(row.entityType, row.entityId, week);
      const locked = isAttendanceLocked(row.entityType, row.entityId, week) ? " (facturée, verrouillée)" : "";
      return `${row.name}, semaine ${week}${date ? ` (${date})` : ""} : ${ATTENDANCE_STATUS_WORDS[status] || status}${locked}`;
    }

    function attendanceCellTitle(row, week) {
      const attendance = attendanceFor(row.entityType, row.entityId, week);
      const date = attendanceDateLabel(row.entityType, row.entityId, week);
      const status = ATTENDANCE_STATUS_WORDS[attendanceStatus(row.entityType, row.entityId, week)];
      const base = `S${week}${date ? ` · ${date}` : ""} · ${status}`;
      return attendance?.billingLocked
        ? `${base} · rémunérée par ${attendance.billingDocumentNumber || attendance.billingDocumentId}`
        : base;
    }

    const teacherRequestsById = computed(() => Object.fromEntries(
      (billingSummary.value?.teacherInvoiceRequests || []).map((request) => [request.teacherId, request]),
    ));

    const teacherRows = computed(() => state.teachers.map((teacher) => {
      const individualCount = state.individualCourses
        .filter((course) => course.teacherId === teacher.id)
        .reduce((sum, course) => sum + countPresences("individualCourse", course.id), 0);
      const workshopCount = workshopBands.value
        .filter((band) => band.teacherId === teacher.id)
        .reduce((sum, band) => sum + countPresences("workshop", band.id), 0);
      const hourlyRate = state.settings.teacherHourlyRate;
      return {
        teacher,
        individualCount,
        workshopCount,
        individualHours: individualCount * state.settings.individualCourseHours,
        workshopHours: workshopCount * state.settings.workshopHours,
        totalDue: teacherRequestsById.value[teacher.id]
          ? Number(teacherRequestsById.value[teacher.id].totalAmount)
          : null,
      };
    }));

    const totals = computed(() => {
      const backendTotals = billingSummary.value?.totals;
      const annualExpenses = state.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      return {
        studentBilling: backendTotals ? Number(backendTotals.studentBilling) : null,
        groupFees: backendTotals ? Number(backendTotals.groupFees) : null,
        teacherDue: backendTotals ? Number(backendTotals.teacherDue) : null,
        annualExpenses,
        subsidy: backendTotals ? Number(backendTotals.subsidy) : null,
      };
    });
    const studentTotal = computed(() => billingStatus.value === "ready"
      ? totals.value.studentBilling + totals.value.groupFees
      : null);

    const dashboardTerms = computed(() => [...state.settings.terms]
      .sort((left, right) => Number(left.displayOrder || left.startWeek) - Number(right.displayOrder || right.startWeek))
      .map((term) => {
        const summary = billingSummariesByTerm.value[term.id];
        const backendTotals = summary?.totals;
        const expenses = state.expenses
          .filter((expense) => {
            const date = new Date(`${expense.date}T00:00:00`);
            const week = isoWeekNumber(date);
            return date.getFullYear() === Number(state.settings.year) && week >= term.startWeek && week <= term.endWeek;
          })
          .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
        return {
          ...term,
          studentBilling: backendTotals ? Number(backendTotals.studentBilling) + Number(backendTotals.groupFees) : 0,
          teacherDue: backendTotals ? Number(backendTotals.teacherDue) : 0,
          subsidy: backendTotals ? Number(backendTotals.subsidy) : 0,
          expenses,
          selected: term.id === selectedTermId.value,
          automatic: term.id === automaticTerm.value?.id,
          phase: dashboardTermPhase(term),
        };
      }));

    const annualDashboardTotals = computed(() => ({
      studentBilling: dashboardTerms.value.reduce((sum, term) => sum + term.studentBilling, 0),
      teacherDue: dashboardTerms.value.reduce((sum, term) => sum + term.teacherDue, 0),
      expenses: state.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
      subsidy: dashboardTerms.value.reduce((sum, term) => sum + term.subsidy, 0),
    }));

    // Échelle « ronde » de la portée : cinq lignes (4 intervalles), ex. 5 000 / 3 750 / 2 500 / 1 250 / 0.
    const dashboardChartScale = computed(() => {
      const maximum = Math.max(
        1,
        ...dashboardTerms.value.flatMap((term) => [term.studentBilling, term.teacherDue, term.subsidy, term.expenses]),
      );
      const rawStep = maximum / 4;
      const magnitude = 10 ** Math.floor(Math.log10(rawStep));
      const step = [1, 1.25, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep);
      return { max: step * 4, ticks: [4, 3, 2, 1, 0].map((index) => index * step) };
    });

    const DASHBOARD_SERIES = [
      { key: "studentBilling", label: "Facturation élèves", className: "students", fromBilling: true },
      { key: "teacherDue", label: "Prestataires", className: "teachers", fromBilling: true },
      { key: "subsidy", label: "Subvention", className: "subsidy", fromBilling: true },
      { key: "expenses", label: "Dépenses", className: "expenses", fromBilling: false },
    ];

    const dashboardChartSummary = computed(() => dashboardTerms.value.map((term) => (
      `${term.name} : ${DASHBOARD_SERIES.map((series) => `${series.label.toLowerCase()} ${series.fromBilling ? billingMoney(term[series.key]) : money(term[series.key])}`).join(", ")}`
    )).join(" ; "));

    const dashboardKpiTiles = computed(() => [
      { key: "studentBilling", label: "Facturation élèves", detail: "Cours + cotisations", value: billingMoney(annualDashboardTotals.value.studentBilling) },
      { key: "teacherDue", label: "Coût prestataires", detail: "Cours individuels + ateliers", value: billingMoney(annualDashboardTotals.value.teacherDue) },
      { key: "expenses", label: "Dépenses", detail: "Charges de l'année", value: money(annualDashboardTotals.value.expenses) },
      { key: "subsidy", label: "Subvention calculée", detail: "Dû − 50 % cours − cotisations", value: billingMoney(annualDashboardTotals.value.subsidy), emphasis: true },
    ].map((tile) => {
      const maximum = Math.max(0, ...dashboardTerms.value.map((term) => term[tile.key]));
      return {
        ...tile,
        available: tile.key === "expenses" || billingStatus.value === "ready",
        bars: dashboardTerms.value.map((term) => ({
          id: term.id,
          phase: term.phase,
          height: maximum > 0 ? Math.max(3, (term[tile.key] / maximum) * 30) : 3,
        })),
      };
    }));

    const dashboardOutflowTotal = computed(() => (
      annualDashboardTotals.value.subsidy + annualDashboardTotals.value.expenses
    ));

    const dashboardSubsidyShare = computed(() => (
      dashboardOutflowTotal.value > 0
        ? (annualDashboardTotals.value.subsidy / dashboardOutflowTotal.value) * 100
        : 0
    ));

    const dashboardTeacherActivity = computed(() => (
      billingSummariesByTerm.value[selectedTermId.value]?.teacherInvoiceRequests || []
    ).map((request) => {
      const teacher = teachersById.value[request.teacherId];
      const issuedAmount = Number(request.issuedAmount ?? 0);
      const remainingAmount = Number(request.remainingAmount ?? request.totalAmount ?? 0);
      const totalToIssue = issuedAmount + Math.max(remainingAmount, 0);
      return {
        teacher,
        teacherId: request.teacherId,
        totalHours: Number(request.totalHours ?? 0),
        issuedAmount,
        remainingAmount,
        issuedPercent: totalToIssue > 0 ? Math.min(100, Math.max(0, (issuedAmount / totalToIssue) * 100)) : 0,
      };
    })
      .filter((activity) => activity.teacher)
      .sort((left, right) => fullName(left.teacher).localeCompare(fullName(right.teacher), "fr")));

    const dashboardTeacherActivityTotals = computed(() => dashboardTeacherActivity.value.reduce((totals, activity) => ({
      hours: totals.hours + activity.totalHours,
      issued: totals.issued + activity.issuedAmount,
      remaining: totals.remaining + activity.remainingAmount,
    }), { hours: 0, issued: 0, remaining: 0 }));

    function dashboardBarHeight(value) {
      if (!value) return "0px";
      return `${Math.max(3, (Number(value) / dashboardChartScale.value.max) * 200).toFixed(1)}px`;
    }

    function dashboardTermPhase(term) {
      const year = Number(state.settings.year);
      const now = new Date();
      if (year < now.getFullYear()) return "done";
      if (year > now.getFullYear()) return "upcoming";
      const currentWeek = isoWeekNumber(now);
      if (currentWeek < term.startWeek) return "upcoming";
      return currentWeek > term.endWeek ? "done" : "current";
    }

    const DASHBOARD_PHASE_LABELS = { done: "Terminé", current: "En cours", upcoming: "À venir" };

    function dashboardSeriesValue(term, series) {
      return series.fromBilling && billingStatus.value !== "ready" ? null : term[series.key];
    }

    function wholeEuros(value) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
    }

    const expenseRows = computed(() => [...state.expenses].sort((a, b) => (
      String(b.date).localeCompare(String(a.date)) || a.label.localeCompare(b.label, "fr")
    )));

    const expenseTotalsByCategory = computed(() => EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      total: state.expenses
        .filter((expense) => expense.category === category.value)
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    })).filter((category) => category.total > 0));

    const isAuthenticated = computed(() => Boolean(authSession.value?.accessToken));
    const isAdministrator = computed(() => currentUser.value?.roles?.includes("ADMINISTRATOR") === true);
    const mustEnrollMfa = computed(() => (
      mfaRecoveryCodes.value.length > 0
      || (isAuthenticated.value && isAdministrator.value && twoFactorStatus.value?.enabled !== true)
    ));
    const authGateActive = computed(() => !isAuthenticated.value || mustChangePassword.value || mustEnrollMfa.value || authFlowPending.value);
    const authGateTitle = computed(() => {
      if (authFlowPending.value) return "Vérification de la session";
      if (mfaRecoveryCodes.value.length) return "Codes de récupération";
      if (mustChangePassword.value) return "Nouveau mot de passe";
      if (mustEnrollMfa.value) return "Sécuriser le compte";
      if (mfaChallenge.active) return "Validation en deux étapes";
      return "Connexion";
    });
    const mfaSetupCode = computed(() => mfaSetupDigits.value.join(""));
    const mfaSetupCodeComplete = computed(() => /^\d{6}$/.test(mfaSetupCode.value));
    const mfaLoginCodeComplete = computed(() => (
      mfaLoginMode.value === "totp"
        ? /^\d{6}$/.test(mfaLoginDigits.value.join(""))
        : Boolean(mfaChallenge.code.trim())
    ));
    watch(mfaLoginDigits, () => {
      if (mfaLoginError.value) mfaLoginError.value = "";
    }, { deep: true });
    watch(mfaSetupDigits, () => {
      if (mfaSetupError.value) mfaSetupError.value = "";
    }, { deep: true });
    const mfaQrSvg = computed(() => {
      const uri = mfaSetup.value?.otpauthUri;
      if (!uri) return "";
      try {
        const code = qrcode(0, "M");
        code.addData(uri);
        code.make();
        return code.createSvgTag({ cellSize: 5, margin: 16, scalable: true, title: "QR code d’enrôlement TOTP" });
      } catch (error) {
        console.warn("TOTP QR code generation failed", error);
        return "";
      }
    });

    const currentUserLabel = computed(() => {
      if (!isAuthenticated.value) return "Utilisateur non connecté";
      if (!currentUser.value?.authenticated) return "Session à confirmer";
      return currentUser.value.displayName || currentUser.value.username || "Utilisateur connecté";
    });

    const currentUserDetail = computed(() => {
      if (!isAuthenticated.value) return "";
      return currentUser.value?.roles?.length ? currentUser.value.roles.map(roleLabel).join(", ") : "";
    });

    const currentUserInitials = computed(() => {
      const source = currentUser.value?.displayName || currentUser.value?.username || "?";
      return source
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "?";
    });

    function authUserInitials(user) {
      const source = user?.displayName || user?.username || "?";
      return source
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "?";
    }

    function authUserAvatarUrl(user) {
      if (user?.id && user.id === currentUser.value?.id && currentUserAvatarUrl.value) {
        return currentUserAvatarUrl.value;
      }
      return user?.id ? authUserAvatarUrls[user.id] || "" : "";
    }
    const mustChangePassword = computed(() => Boolean(currentUser.value?.mustChangePassword));
    const pageTitle = computed(() => {
      const labels = {
        dashboard: `Saison ${state.settings.year}`,
        expenses: `Dépenses ${state.settings.year}`,
        attendance: "Présences",
        account: "Compte utilisateur",
        people: "Musiciens",
        slots: "Créneaux",
        groups: "Groupes",
        settings: "Configuration",
        billing: "Facturation",
        signatures: "Émargement",
        "data-transfer": "Import / Export",
      };
      return labels[activeView.value] || selectedTerm.value?.name || "";
    });

    function can(permission) {
      const roles = currentUser.value?.roles || [];
      const permissions = currentUser.value?.permissions || [];
      return roles.includes("ADMINISTRATOR") || permissions.includes(permission);
    }

    function canAny(permissions) {
      return permissions.some(can);
    }

    const canReadBusinessData = computed(() => canAny(BUSINESS_READ_PERMISSIONS));
    const canUseAccount = computed(() => mustChangePassword.value || canAny(["ACCOUNT_USER", "ACCOUNT_CREATE", "ACCOUNT_MANAGE"]));
    const canCreateUsers = computed(() => can("ACCOUNT_CREATE"));
    const canAdminUsers = computed(() => can("ACCOUNT_MANAGE"));
    const canAccessSettings = computed(() => canAny(CONFIG_PERMISSIONS));
    const navGroups = computed(() => {
      if (mustChangePassword.value) return [];
      return [
        { label: "Saison", items: [
          { view: "dashboard", label: "Tableau de bord", visible: true },
          { view: "attendance", label: "Présences", visible: can("PRESENCE_READ") },
          { view: "signatures", label: "Émargement", visible: can("PRESENCE_READ") },
        ] },
        { label: "Répertoire", items: [
          { view: "people", label: "Musiciens", visible: canAny(["MUSICIENS_READ", "MUSICIENS_WRITE", "MUSICIENS_ARCHIVED"]) },
          { view: "slots", label: "Créneaux", visible: canAny(["MUSICIENS_READ", "MUSICIENS_WRITE"]) },
          { view: "groups", label: "Groupes", visible: canAny(["GROUPS_READ", "GROUPS_WRITE"]) },
        ] },
        { label: "Comptes", items: [
          { view: "expenses", label: "Dépenses", visible: canAny(["EXPENSES_READ", "EXPENSES_WRITE", "EXPENSES_DELETE"]) },
          { view: "billing", label: "Facturation", visible: canAny(["BILLING_READ", "BILLING_PRINT"]) },
        ] },
        { label: "Système", items: [
          { view: "data-transfer", label: "Import / Export", visible: can("IMPORT_EXPORT") },
          { view: "settings", label: "Configuration", visible: canAccessSettings.value },
        ] },
      ]
        .map((group) => ({ ...group, items: group.items.filter((item) => item.visible) }))
        .filter((group) => group.items.length);
    });
    const seasonPickerOpen = ref(false);
    const themePreference = ref(applyThemePreference(readThemePreference()));

    function setThemePreference(value) {
      themePreference.value = saveThemePreference(value);
    }

    // Garde les onglets ouverts d'accord lorsque le thème change ailleurs.
    window.addEventListener("storage", (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        themePreference.value = applyThemePreference(normalizeTheme(event.newValue));
      }
    });
    const visibleAuthRoles = computed(() => {
      const rows = authRoles.value.length
        ? authRoles.value
        : [
            { code: "OBSERVER", label: "Observateur" },
            { code: "ADMINISTRATOR", label: "Administrateur" },
          ];
      return [...rows].sort((left, right) => {
        if (left.code === "OBSERVER") return -1;
        if (right.code === "OBSERVER") return 1;
        if (left.code === "ADMINISTRATOR") return 1;
        if (right.code === "ADMINISTRATOR") return -1;
        return roleLabel(left.code).localeCompare(roleLabel(right.code), "fr");
      });
    });

    const billableStudentRows = computed(() => studentBillingRows.value.filter((item) => item.totalDue > 0));

    const teacherWeeklyRows = computed(() => (billingSummary.value?.teacherInvoiceRequests || []).flatMap((request) => {
      const teacher = teachersById.value[request.teacherId];
      if (!teacher) return [];
      return request.weeklyLines.map((line) => ({
        key: `${request.teacherId}-${line.week}`,
        teacher,
        week: line.week,
        date: new Date(`${line.date}T00:00:00`),
        dateLabel: FRENCH_DATE.format(new Date(`${line.date}T00:00:00`)),
        hours: Number(line.hours),
        totalAmount: Number(line.amount),
      }));
    }));

    const teacherBillingSections = computed(() => (billingSummary.value?.teacherInvoiceRequests || [])
      .map((request) => ({
        teacher: teachersById.value[request.teacherId],
        rows: teacherWeeklyRows.value.filter((row) => row.teacher.id === request.teacherId),
        totalHours: Number(request.totalHours),
        totalAmount: Number(request.totalAmount),
        accruedAmount: Number(request.accruedAmount ?? request.totalAmount),
        issuedAmount: Number(request.issuedAmount ?? 0),
        pendingAdjustmentAmount: Number(request.pendingAdjustmentAmount ?? 0),
        remainingAmount: Number(request.remainingAmount ?? request.totalAmount),
        installmentsAvailable: request.installmentsAvailable !== false,
        adjustments: request.adjustments || [],
        endWeek: selectedTeacherEndWeek(request.teacherId),
      }))
      .filter((section) => section.teacher));

    const signatureSheetSections = computed(() => state.teachers.map((teacher) => {
      const individualColumns = state.individualCourses
        .map((course) => ({
          type: "individual",
          key: `individual-${course.id}`,
          course,
          musician: musiciansById.value[course.musicianId],
        }))
        .filter((item) => (
          item.musician
          && item.course.teacherId === teacher.id
          && (isActiveCourse(item.course) || hasTermAttendance("individualCourse", item.course.id))
        ))
        .sort((a, b) => courseSortKey(a.course, a.musician).localeCompare(courseSortKey(b.course, b.musician), "fr"));
      const workshopColumns = workshopBands.value
        .filter((band) => band.teacherId === teacher.id)
        .sort((a, b) => (a.weekday || "").localeCompare(b.weekday || "", "fr") || a.name.localeCompare(b.name, "fr"))
        .map((band) => ({
          type: "workshop",
          key: `workshop-${band.id}`,
          band,
        }));
      const columns = [...individualColumns, ...workshopColumns];
      return { teacher, columns };
    }).filter((section) => section.columns.length > 0));

    function isActiveCourse(course) {
      return course.active !== false && musiciansById.value[course.musicianId]?.active !== false;
    }

    function hasTermAttendance(entityType, entityId) {
      return state.attendance.some((entry) => (
        entry.termId === selectedTerm.value.id
        && entry.entityType === entityType
        && entry.entityId === entityId
      ));
    }

    function courseSortKey(course, musician) {
      const dayIndex = WEEKDAYS.indexOf(course.weekday);
      return `${dayIndex < 0 ? 99 : dayIndex}-${course.startTime}-${fullName(musician)}`;
    }

    function signatureWeekDate(week) {
      return FRENCH_DATE.format(firstDayOfBusinessWeek(state.settings.year, week));
    }

    function signatureWeekNumber(week) {
      return `S${week}`;
    }

    function printPage() {
      window.print();
    }

    function attendanceFor(entityType, entityId, week) {
      return attendanceIndex.value.get(`${selectedTerm.value.id}:${entityType}:${entityId}:${week}`);
    }

    function isPresent(entityType, entityId, week) {
      return attendanceStatus(entityType, entityId, week) === "PRESENT";
    }

    function attendanceStatus(entityType, entityId, week) {
      return attendanceFor(entityType, entityId, week)?.status || "UNRECORDED";
    }

    function isAttendanceLocked(entityType, entityId, week) {
      return attendanceFor(entityType, entityId, week)?.billingLocked === true;
    }

    function attendanceTitle(entityType, entityId, week) {
      const attendance = attendanceFor(entityType, entityId, week);
      return attendance?.billingLocked
        ? `Rémunérée par ${attendance.billingDocumentNumber || attendance.billingDocumentId}`
        : attendanceStatus(entityType, entityId, week);
    }

    function scheduledSessionDate(entityType, entityId, week) {
      const existing = attendanceFor(entityType, entityId, week)?.sessionDate;
      if (existing) return existing;
      const weekday = entityType === "individualCourse" ? coursesById.value[entityId]?.weekday : bandsById.value[entityId]?.weekday;
      const firstDay = new Date(Date.UTC(state.settings.year, 0, 1));
      if (week === 1) return firstDay.toISOString().slice(0, 10);
      const isoDay = firstDay.getUTCDay() || 7;
      const firstMonday = new Date(firstDay);
      firstMonday.setUTCDate(firstDay.getUTCDate() + ((8 - isoDay) % 7) + ((week - 2) * 7) + Math.max(0, WEEKDAYS.indexOf(weekday)));
      return firstMonday.toISOString().slice(0, 10);
    }

    function attendanceDateLabel(entityType, entityId, week) {
      const value = scheduledSessionDate(entityType, entityId, week);
      if (!value) return "";
      const [year, month, day] = value.split("-");
      return `${day}/${month}`;
    }

    function countPresences(entityType, entityId) {
      return weeks.value.reduce((sum, week) => sum + (isPresent(entityType, entityId, week) ? 1 : 0), 0);
    }

    function memberCount(band) {
      return uniqueIds(band.memberIds).filter((id) => musiciansById.value[id]).length;
    }

    function isHolidayWeek(week) {
      return selectedHolidayWeeks.value.includes(week);
    }

    function addHolidayWeek() {
      if (!can("CONFIG_HOLIDAYS")) return;
      const week = Number(holidayWeekToAdd.value);
      if (!week || isHolidayWeek(week)) return;
      state.settings.schoolHolidayWeeks = [...selectedHolidayWeeks.value, week].sort((a, b) => a - b);
      holidayWeekToAdd.value = availableHolidayWeeks.value[0] || "";
      saveSettings();
    }

    function removeHolidayWeek(week) {
      if (!can("CONFIG_HOLIDAYS")) return;
      state.settings.schoolHolidayWeeks = selectedHolidayWeeks.value.filter((item) => item !== week);
      holidayWeekToAdd.value = availableHolidayWeeks.value[0] || "";
      saveSettings();
    }

    async function saveSettings() {
      if (!canAny(["CONFIG_FINANCIALS", "CONFIG_TERMS", "CONFIG_HOLIDAYS"])) return;
      if (!ensureStructureMutable()) return;
      const payload = {
        version: state.settings.version,
        year: state.settings.year,
        teacherHourlyRate: Number(state.settings.teacherHourlyRate) || 0,
        groupMembershipFee: Number(state.settings.groupMembershipFee) || 0,
        individualCourseHours: Number(state.settings.individualCourseHours) || COURSE_DURATION_HOURS,
        workshopHours: Number(state.settings.workshopHours) || WORKSHOP_DURATION_HOURS,
        schoolHolidayWeeks: selectedHolidayWeeks.value,
        terms: state.settings.terms.map((term, index) => ({
          id: term.id,
          name: term.name,
          startWeek: Number(term.startWeek) || 1,
          endWeek: Number(term.endWeek) || 1,
          displayOrder: Number(term.displayOrder) || index + 1,
        })),
      };

      if (!can("CONFIG_FINANCIALS")) {
        for (const field of ["teacherHourlyRate", "groupMembershipFee", "individualCourseHours", "workshopHours"]) delete payload[field];
      }
      if (!can("CONFIG_TERMS")) delete payload.terms;
      if (!can("CONFIG_HOLIDAYS")) delete payload.schoolHolidayWeeks;

      const savedSettings = await requestResource("PUT", `accounting-years/${state.settings.year}/settings`, payload, {
        successMessage: "Configuration enregistrée",
        errorMessage: "Configuration conservée en local",
      });
      if (savedSettings) {
        state.settings = savedSettings;
        selectedTermId.value = automaticTermForYear(state.settings.terms, state.settings.year)?.id || "";
      }
    }

    async function copyAnnualConfiguration() {
      if (!can("CONFIG_TERMS")) return;
      if (!ensureStructureMutable()) return;
      const sourceYear = Number(copySourceYear.value);
      const targetYear = Number(state.settings.year);
      if (!sourceYear || sourceYear === targetYear) {
        showToast("Choisis une année source différente", "warning");
        return;
      }
      const snapshot = await requestResource(
        "POST",
        `accounting-years/${targetYear}/copy-configuration-from/${sourceYear}`,
        null,
        {
          successMessage: `Configuration ${sourceYear} copiée vers ${targetYear}`,
          errorMessage: "Configuration annuelle non copiée",
        },
      );
      if (!snapshot) return;
      Object.assign(state, normalizeSnapshot(snapshot));
      resetFormsAfterStateLoad();
      await loadBillingSummary();
    }

    function attendanceSaveKey(entityType, entityId, week) {
      return `${selectedTerm.value?.id}:${entityType}:${entityId}:${week}`;
    }

    function isAttendanceSaving(entityType, entityId, week) {
      return savingAttendanceKeys.has(attendanceSaveKey(entityType, entityId, week));
    }

    async function setAttendanceStatus(entityType, entityId, week, status) {
      if (!can("PRESENCE_WRITE")) return;
      if (!ensureYearNotClosed("Les présences sont verrouillées")) return;
      if (isAttendanceLocked(entityType, entityId, week)) {
        showToast(attendanceTitle(entityType, entityId, week), "warning");
        return;
      }
      const saveKey = attendanceSaveKey(entityType, entityId, week);
      if (savingAttendanceKeys.has(saveKey)) return;
      savingAttendanceKeys.add(saveKey);
      const existing = attendanceFor(entityType, entityId, week);
      try {
        if (existing) {
          if (existing.status === status) return;
          existing.status = status;
          existing.present = status === "PRESENT";
          await saveAttendance(existing);
          return;
        }
        const entry = {
          id: createId(),
          termId: selectedTerm.value.id,
          week,
          entityType,
          entityId,
          present: status === "PRESENT",
          status,
          sessionDate: scheduledSessionDate(entityType, entityId, week),
        };
        state.attendance.push(entry);
        await saveAttendance(entry);
      } finally {
        savingAttendanceKeys.delete(saveKey);
      }
    }

    async function toggleAttendance(entityType, entityId, week) {
      const next = { PRESENT: "ABSENT", ABSENT: "CANCELLED", CANCELLED: "PRESENT" }[attendanceStatus(entityType, entityId, week)] || "PRESENT";
      await setAttendanceStatus(entityType, entityId, week, next);
    }

    function confirmDiscardChanges(dirty) {
      return !dirty || window.confirm("Des modifications ne sont pas enregistrées. Les abandonner ?");
    }

    function resetMusicianForm() {
      editingMusicianId.value = null;
      musicianFormOpen.value = false;
      Object.assign(musicianForm, {
        firstName: "",
        lastName: "",
        email: "",
        bandIds: [],
        inWorkshop: false,
        workshopBandId: workshopBands.value[0]?.id || "",
        hasIndividualCourse: false,
        sharedSlot: false,
        courseId: null,
        teacherId: state.teachers[0]?.id || "",
        instrument: "Guitare",
        weekday: "Lundi",
        startTime: timeSlots.value[0] || "11:30",
      });
      musicianFormSnapshot.value = JSON.stringify(musicianForm);
    }

    function startNewMusician() {
      if (!confirmDiscardChanges(musicianFormDirty.value)) return false;
      resetMusicianForm();
      musicianFormOpen.value = true;
      scrollToMusicianSheet();
      return true;
    }

    // Sur une colonne, la fiche s'ouvre au-dessus de la liste ; au-delà elle reste visible à droite.
    function scrollToMusicianSheet() {
      if (!window.matchMedia("(max-width: 1240px)").matches) return;
      nextTick(() => {
        document.getElementById("musician-editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    function resetTeacherForm() {
      editingTeacherId.value = null;
      teacherFormOpen.value = false;
      Object.assign(teacherForm, {
        firstName: "",
        lastName: "",
        instrument: "",
        active: true,
      });
    }

    function startNewTeacher() {
      resetTeacherForm();
      teacherFormOpen.value = true;
    }

    function editTeacher(teacher) {
      if (!can("CONFIG_TEACHER")) return;
      editingTeacherId.value = teacher.id;
      teacherFormOpen.value = true;
      Object.assign(teacherForm, {
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        instrument: teacher.instrument,
        active: teacher.active !== false,
      });
    }

    function teacherUsageCount(teacherId) {
      const courseCount = state.individualCourses.filter((course) => course.teacherId === teacherId).length;
      const workshopCount = state.bands.filter((band) => band.teacherId === teacherId).length;
      return courseCount + workshopCount;
    }

    function teacherDeleteActionLabel(teacher) {
      return teacherUsageCount(teacher.id) > 0 ? `Désactiver ${fullName(teacher)}` : `Supprimer ${fullName(teacher)}`;
    }

    async function saveTeacher() {
      if (!can("CONFIG_TEACHER")) return;
      if (!teacherForm.firstName.trim() || !teacherForm.lastName.trim() || !teacherForm.instrument.trim()) return;

      const payload = {
        firstName: teacherForm.firstName.trim(),
        lastName: teacherForm.lastName.trim(),
        instrument: teacherForm.instrument.trim(),
        active: teacherForm.active,
      };

      if (editingTeacherId.value) {
        const teacher = state.teachers.find((item) => item.id === editingTeacherId.value);
        if (!teacher) return;
        const savedTeacher = await requestResource("PUT", `teachers/${teacher.id}`, { ...payload, id: teacher.id }, {
          successMessage: "Professeur enregistré",
          errorMessage: "Professeur conservé en local",
        });
        Object.assign(teacher, savedTeacher || payload);
      } else {
        const savedTeacher = await requestResource("POST", "teachers", payload, {
          successMessage: "Professeur créé",
          errorMessage: "Professeur créé en local",
        });
        state.teachers.push(savedTeacher || { ...payload, id: createId() });
      }

      resetTeacherForm();
    }

    async function deleteTeacher(teacherId) {
      if (!can("CONFIG_TEACHER")) return;
      const teacher = state.teachers.find((item) => item.id === teacherId);
      if (!teacher) return;
      if (teacherUsageCount(teacherId) > 0 && teacher.active === false) return;
      const shouldDeactivate = teacherUsageCount(teacherId) > 0;
      const result = await requestResource("DELETE", `teachers/${teacherId}`, null, {
        successMessage: shouldDeactivate ? "Professeur désactivé" : "Professeur supprimé",
        errorMessage: shouldDeactivate ? "Professeur désactivé localement" : "Professeur supprimé localement",
      });
      if (result === undefined) return;
      if (shouldDeactivate) {
        teacher.active = false;
      } else {
        state.teachers = state.teachers.filter((item) => item.id !== teacherId);
      }
      if (editingTeacherId.value === teacherId) resetTeacherForm();
    }

    function editMusician(musician) {
      if (!can("MUSICIENS_WRITE")) return;
      if (editingMusicianId.value !== musician.id && !confirmDiscardChanges(musicianFormDirty.value)) return;
      loadMusicianForm(musician);
      activeView.value = "people";
      scrollToMusicianSheet();
    }

    function loadMusicianForm(musician) {
      const course = state.individualCourses.find((item) => item.musicianId === musician.id);
      const workshopBand = workshopBands.value.find((band) => band.memberIds.includes(musician.id));
      editingMusicianId.value = musician.id;
      musicianFormOpen.value = true;
      Object.assign(musicianForm, {
        firstName: musician.firstName,
        lastName: musician.lastName,
        email: musician.email || "",
        bandIds: independentBands.value.filter((band) => band.memberIds.includes(musician.id)).map((band) => band.id),
        inWorkshop: Boolean(workshopBand),
        workshopBandId: workshopBand?.id || workshopBands.value[0]?.id || "",
        hasIndividualCourse: Boolean(course),
        sharedSlot: course?.sharedSlot || false,
        courseId: course?.id || null,
        teacherId: course?.teacherId || state.teachers[0]?.id || "",
        instrument: course?.instrument || "Guitare",
        weekday: course?.weekday || "Lundi",
        startTime: course?.startTime || timeSlots.value[0] || "11:30",
      });
      musicianFormSnapshot.value = JSON.stringify(musicianForm);
    }

    function toggleMusicianBand(bandId) {
      if (!can("MUSICIENS_WRITE")) return;
      musicianForm.bandIds = musicianForm.bandIds.includes(bandId)
        ? musicianForm.bandIds.filter((id) => id !== bandId)
        : [...musicianForm.bandIds, bandId];
    }

    function setMusicianWorkshop(bandId) {
      if (!can("MUSICIENS_WRITE")) return;
      musicianForm.inWorkshop = Boolean(bandId);
      if (bandId) musicianForm.workshopBandId = bandId;
    }

    function courseSlotReason(slot) {
      return unavailableReason({
        id: musicianForm.courseId,
        kind: "course",
        weekday: musicianForm.weekday,
        start: timeToMinutes(slot),
        minutes: durationMinutes(state.settings, "course"),
        sharedSlot: musicianForm.sharedSlot,
      }, roomOccupations.value);
    }

    function slotTakenByOtherMusician() {
      return musicianForm.hasIndividualCourse && Boolean(courseSlotReason(musicianForm.startTime));
    }

    function isSlotDisabled(slot) {
      return Boolean(courseSlotReason(slot));
    }

    async function syncMusicianCourse(musicianId) {
      let course = state.individualCourses.find((item) => item.musicianId === musicianId);

      if (!musicianForm.hasIndividualCourse) {
        if (course) {
          state.individualCourses = state.individualCourses.filter((item) => item.id !== course.id);
          state.attendance = state.attendance.filter((entry) => !(entry.entityType === "individualCourse" && entry.entityId === course.id));
          await requestResource("DELETE", `individual-courses/${course.id}`);
        }
        return;
      }

      const teacherId = teachersById.value[musicianForm.teacherId]
        ? musicianForm.teacherId
        : state.teachers[0]?.id;
      if (!teacherId) return;

      const payload = {
        year: state.settings.year,
        musicianId,
        teacherId,
        instrument: musicianForm.instrument.trim() || "Instrument",
        weekday: musicianForm.weekday,
        startTime: musicianForm.startTime,
        sharedSlot: musicianForm.sharedSlot,
        active: true,
      };

      const wasConnected = apiStatus.value === "connecté";
      const savedCourse = await requestResource(
        course ? "PUT" : "POST",
        course ? `individual-courses/${course.id}` : "individual-courses",
        course ? { ...payload, id: course.id } : payload,
        {
          successMessage: "Créneau individuel enregistré",
          errorMessage: "Créneau individuel non enregistré côté backend",
        },
      );
      if (!savedCourse && wasConnected) {
        return;
      }

      if (!course) {
        course = savedCourse || { ...payload, id: createId() };
        state.individualCourses.push(course);
      }
      Object.assign(course, savedCourse || payload);
    }

    async function syncMusicianBandMemberships(musicianId) {
      const changedBands = [];
      state.bands.forEach((band) => {
        const shouldContain = band.type === "workshop"
          ? musicianForm.inWorkshop && band.id === musicianForm.workshopBandId
          : musicianForm.bandIds.includes(band.id);
        band.memberIds = uniqueIds(band.memberIds);
        const contains = band.memberIds.includes(musicianId);
        if (shouldContain && !contains) {
          band.memberIds = uniqueIds([...band.memberIds, musicianId]);
          changedBands.push(band);
        }
        if (!shouldContain && contains) {
          band.memberIds = uniqueIds(band.memberIds.filter((id) => id !== musicianId));
          changedBands.push(band);
        }
      });

      const savedBands = await Promise.all(changedBands.map((band) => requestResource("PUT", `bands/${band.id}/members`, {
        memberIds: band.memberIds,
      })));
      savedBands.filter(Boolean).forEach((savedBand) => {
        const band = state.bands.find((item) => item.id === savedBand.id);
        if (band) {
          Object.assign(band, {
            ...savedBand,
            type: apiBandTypeToUi(savedBand.type),
            memberIds: uniqueIds(savedBand.memberIds),
          });
        }
      });
      if (changedBands.length) {
        showToast(
          savedBands.every(Boolean) ? "Associations de groupes enregistrées" : "Associations de groupes conservées en local",
          savedBands.every(Boolean) ? "success" : "warning",
        );
      }
    }

    async function saveMusician() {
      if (!can("MUSICIENS_WRITE")) return;
      if (!ensureStructureMutable()) return;
      if (!musicianForm.firstName.trim() || !musicianForm.lastName.trim()) return;
      if (slotTakenByOtherMusician()) return;

      const payload = {
        firstName: musicianForm.firstName.trim(),
        lastName: musicianForm.lastName.trim(),
        email: musicianForm.email.trim(),
        active: true,
      };

      const existingMusician = editingMusicianId.value
        ? state.musicians.find((item) => item.id === editingMusicianId.value)
        : null;
      const savedMusician = await requestResource(
        editingMusicianId.value ? "PUT" : "POST",
        editingMusicianId.value ? `musicians/${editingMusicianId.value}` : "musicians",
        editingMusicianId.value ? { ...payload, id: editingMusicianId.value } : payload,
        {
          successMessage: editingMusicianId.value ? "Musicien enregistré" : "Musicien créé",
          errorMessage: editingMusicianId.value ? "Musicien conservé en local" : "Musicien créé en local",
        },
      );
      const musician = existingMusician || savedMusician || { ...payload, id: createId() };
      Object.assign(musician, savedMusician || payload);

      if (!editingMusicianId.value) {
        state.musicians.push(musician);
      }

      await syncMusicianBandMemberships(musician.id);
      await syncMusicianCourse(musician.id);

      loadMusicianForm(musician);
    }

    async function deleteMusician(musicianId) {
      if (!can("MUSICIENS_WRITE")) return;
      if (!ensureStructureMutable()) return;
      const musician = state.musicians.find((item) => item.id === musicianId);
      if (musician) {
        musician.active = false;
      }
      state.individualCourses
        .filter((course) => course.musicianId === musicianId)
        .forEach((course) => {
          course.active = false;
        });
      await requestResource("DELETE", `musicians/${musicianId}`, null, {
        successMessage: "Musicien archivé",
        errorMessage: "Musicien archivé localement",
      });
      if (editingMusicianId.value === musicianId) resetMusicianForm();
      musicianFilter.value = "all";
    }

    async function restoreMusician(musicianId) {
      if (!can("MUSICIENS_ARCHIVED")) return;
      if (!ensureStructureMutable()) return;
      const restored = await requestResource("POST", `musicians/${musicianId}/restore`, null, {
        successMessage: "Musicien désarchivé",
        errorMessage: "Musicien non désarchivé",
      });
      if (!restored) return;
      const musician = state.musicians.find((item) => item.id === musicianId);
      if (musician) Object.assign(musician, restored, { active: true });
    }

    function selectGroup(groupId) {
      selectedGroupId.value = groupId;
      const band = selectedGroup.value;
      if (!band) return;
      Object.assign(groupForm, {
        name: band.name,
        type: band.type,
        teacherId: band.teacherId || state.teachers[0]?.id || "",
        weekday: band.weekday || "Mardi",
        startTime: band.startTime || "",
        durationMinutes: band.durationMinutes || DEFAULT_GROUP_MINUTES,
        memberIds: uniqueIds(band.memberIds),
      });
      groupFormSnapshot.value = JSON.stringify(groupForm);
    }

    function pickGroup(groupId) {
      if (groupId !== selectedGroupId.value && !confirmDiscardChanges(groupFormDirty.value)) return;
      selectGroup(groupId);
    }

    function startNewGroup() {
      if (!confirmDiscardChanges(groupFormDirty.value)) return;
      resetGroupForm();
    }

    function cancelGroupEdit() {
      const groupId = selectedGroupId.value || state.bands[0]?.id;
      if (groupId) selectGroup(groupId);
      else resetGroupForm();
    }

    function openGroupInSlots() {
      if (groupForm.weekday) slotsDay.value = groupForm.weekday;
      activeView.value = "slots";
    }

    function resetGroupForm() {
      selectedGroupId.value = "";
      Object.assign(groupForm, {
        name: "",
        type: "independent",
        teacherId: state.teachers[0]?.id || "",
        weekday: "Mardi",
        startTime: "",
        durationMinutes: DEFAULT_GROUP_MINUTES,
        memberIds: [],
      });
      groupFormSnapshot.value = JSON.stringify(groupForm);
    }

    function resetFormsAfterStateLoad() {
      selectedTermId.value = automaticTermForYear(state.settings.terms, state.settings.year)?.id || "";
      resetMusicianForm();
      resetTeacherForm();
      resetExpenseForm();
      selectedGroupId.value = state.bands[0]?.id || "";
      if (selectedGroupId.value) {
        selectGroup(selectedGroupId.value);
      } else {
        resetGroupForm();
      }
    }

    async function saveGroup() {
      if (!can("GROUPS_WRITE")) return;
      if (!ensureStructureMutable()) return;
      if (!groupForm.name.trim()) return;
      if (groupStartWarning.value) {
        showToast(`Horaire impossible : ${groupStartWarning.value}`, "warning");
        return;
      }
      const existing = selectedGroupId.value ? state.bands.find((band) => band.id === selectedGroupId.value) : null;
      const teacherId = teachersById.value[groupForm.teacherId]
        ? groupForm.teacherId
        : state.teachers[0]?.id;
      const payload = {
        year: state.settings.year,
        name: groupForm.name.trim(),
        type: groupForm.type,
        teacherId: groupForm.type === "workshop" ? teacherId : undefined,
        weekday: groupForm.weekday,
        startTime: groupForm.startTime || null,
        durationMinutes: groupForm.type === "workshop" ? null : groupForm.durationMinutes,
        memberIds: uniqueIds(groupForm.memberIds),
      };
      const savedBand = await requestResource(
        existing ? "PUT" : "POST",
        existing ? `bands/${existing.id}` : "bands",
        existing ? { ...payload, id: existing.id, version: existing.version } : payload,
        {
          successMessage: existing ? "Groupe enregistré" : "Groupe créé",
          errorMessage: existing ? "Groupe conservé en local" : "Groupe créé en local",
        },
      );
      const band = existing || savedBand || { ...payload, id: createId() };
      const normalizedBand = savedBand
        ? { ...savedBand, type: apiBandTypeToUi(savedBand.type), memberIds: uniqueIds(savedBand.memberIds) }
        : { ...payload, memberIds: uniqueIds(payload.memberIds) };
      Object.assign(band, normalizedBand);
      if (!existing) state.bands.push(band);
      selectGroup(band.id);
    }

    async function deleteGroup(groupId) {
      if (!can("GROUPS_WRITE")) return;
      if (!ensureStructureMutable()) return;
      const band = state.bands.find((item) => item.id === groupId);
      if (!window.confirm(`Supprimer définitivement « ${band?.name || "ce groupe"} » ?`)) return;
      state.bands = state.bands.filter((band) => band.id !== groupId);
      state.attendance = state.attendance.filter((entry) => !(entry.entityType === "workshop" && entry.entityId === groupId));
      await requestResource("DELETE", `bands/${groupId}`, null, {
        successMessage: "Groupe supprimé",
        errorMessage: "Groupe supprimé localement",
      });
      selectedGroupId.value = "";
      cancelGroupEdit();
    }

    function resetExpenseForm() {
      editingExpenseId.value = null;
      Object.assign(expenseForm, {
        date: `${state.settings.year}-01-01`,
        category: "EQUIPMENT",
        label: "",
        amount: 0,
        notes: "",
      });
    }

    function editExpense(expense) {
      if (!can("EXPENSES_WRITE")) return;
      editingExpenseId.value = expense.id;
      Object.assign(expenseForm, {
        date: expense.date,
        category: expense.category,
        label: expense.label,
        amount: Number(expense.amount) || 0,
        notes: expense.notes || "",
      });
    }

    async function saveExpense() {
      if (!can("EXPENSES_WRITE")) return;
      if (!ensureYearNotClosed("Les dépenses sont verrouillées")) return;
      if (!expenseForm.label.trim()) return;
      const existing = editingExpenseId.value
        ? state.expenses.find((expense) => expense.id === editingExpenseId.value)
        : null;
      const payload = {
        year: state.settings.year,
        date: expenseForm.date,
        category: expenseForm.category,
        label: expenseForm.label.trim(),
        amount: Number(expenseForm.amount) || 0,
        notes: expenseForm.notes.trim(),
      };
      const savedExpense = await requestResource(
        existing ? "PUT" : "POST",
        existing ? `expenses/${existing.id}` : `accounting-years/${state.settings.year}/expenses`,
        existing ? { ...payload, id: existing.id } : payload,
        {
          successMessage: existing ? "Dépense enregistrée" : "Dépense créée",
          errorMessage: "Dépense non enregistrée côté backend",
          preserveApiStatus: true,
        },
      );
      if (!savedExpense) return;

      const expense = existing || savedExpense;
      Object.assign(expense, savedExpense ? { ...savedExpense, amount: Number(savedExpense.amount) || 0 } : payload);
      if (!existing) {
        state.expenses.push(expense);
      }
      resetExpenseForm();
    }

    async function deleteExpense(expenseId) {
      if (!can("EXPENSES_DELETE")) return;
      if (!ensureYearNotClosed("Les dépenses sont verrouillées")) return;
      const deleted = await requestResource("DELETE", `expenses/${expenseId}`, null, {
        successMessage: "Dépense supprimée",
        errorMessage: "Dépense non supprimée côté backend",
        preserveApiStatus: true,
      });
      if (deleted === undefined) return;
      state.expenses = state.expenses.filter((expense) => expense.id !== expenseId);
      if (editingExpenseId.value === expenseId) resetExpenseForm();
    }

    function toggleGroupMember(musicianId) {
      if (!can("GROUPS_WRITE")) return;
      groupForm.memberIds = groupForm.memberIds.includes(musicianId)
        ? groupForm.memberIds.filter((id) => id !== musicianId)
        : uniqueIds([...groupForm.memberIds, musicianId]);
    }

    async function prepareAllStudentInvoices() {
      if (!can("BILLING_PRINT")) return;
      if (!ensureYearNotClosed("L'émission est verrouillée")) return;
      const documents = await requestResource(
        "POST",
        `accounting-years/${state.settings.year}/terms/${selectedTerm.value.id}/student-invoices`,
        null,
        {
          successMessage: "Factures élèves générées",
          errorMessage: "Factures élèves non générées côté backend",
        },
      );
      if (documents) {
        studentInvoiceDocuments.value = documents;
        preparedStudentInvoices.value = true;
        const summaryDocument = await requestResource(
          "POST",
          `accounting-years/${state.settings.year}/terms/${selectedTerm.value.id}/student-invoices/summary`,
          null,
          {
            successMessage: "PDF global élèves généré",
            errorMessage: "PDF global élèves non généré côté backend",
          },
        );
        if (summaryDocument) {
          studentInvoiceSummaryDocument.value = summaryDocument;
        }
      }
    }

    function upsertTeacherInvoiceRequestDocument(document) {
      const index = teacherInvoiceRequestDocuments.value.findIndex((item) => item.id === document.id);
      if (index >= 0) {
        teacherInvoiceRequestDocuments.value.splice(index, 1, document);
      } else {
        teacherInvoiceRequestDocuments.value.push(document);
      }
    }

    async function prepareTeacherInvoiceRequest(teacherId) {
      if (!can("BILLING_PRINT")) return;
      if (!ensureYearNotClosed("L'émission est verrouillée")) return;
      const teacher = teachersById.value[teacherId];
      const document = await requestResource(
        "POST",
        `accounting-years/${state.settings.year}/terms/${selectedTerm.value.id}/teacher-invoice-requests/${teacherId}/prepare`,
        { endWeek: selectedTeacherEndWeek(teacherId) },
        {
          successMessage: `Demande de ${teacher ? fullName(teacher) : "facturation"} prévisualisée`,
          errorMessage: "Demande non générée côté backend",
        },
      );
      if (document) {
        upsertTeacherInvoiceRequestDocument(document);
        await loadBillingSummary();
      }
    }

    async function finalizeAllStudentInvoices() {
      if (!can("BILLING_PRINT") || !ensureYearNotClosed("La validation est verrouillée")) return;
      if (!window.confirm("Valider définitivement toutes les factures élèves de ce trimestre ? Elles ne pourront plus être régénérées.")) return;
      const documents = await requestResource("POST", `accounting-years/${state.settings.year}/terms/${selectedTerm.value.id}/student-invoices/finalize`, null, {
        successMessage: "Factures élèves validées définitivement",
        errorMessage: "Validation définitive impossible",
      });
      if (documents) studentInvoiceDocuments.value = documents;
    }

    async function finalizeTeacherInvoiceRequest(teacherId) {
      if (!can("BILLING_PRINT") || !ensureYearNotClosed("La validation est verrouillée")) return;
      const teacher = teachersById.value[teacherId];
      const teacherName = teacher ? fullName(teacher) : "ce prestataire";
      const draft = draftForTeacher(teacherId);
      if (!draft) return;
      if (!window.confirm(`Valider la situation n°${draft.installmentNumber || 1} de ${teacherName} ? Les présences incluses seront verrouillées.`)) return;
      const document = await requestResource("POST", `accounting-years/${state.settings.year}/terms/${selectedTerm.value.id}/teacher-invoice-requests/${teacherId}/finalize`, { documentId: draft.id, version: draft.version }, {
        successMessage: `Situation de ${teacherName} validée`,
        errorMessage: "Validation définitive impossible",
      });
      if (document) {
        upsertTeacherInvoiceRequestDocument(document);
        await loadBillingSummary();
        await loadTermAttendance(state.settings.year, selectedTerm.value.id);
      }
    }

    function documentDownloadUrl(document) {
      return document?.id ? `${apiBase.value}/documents/${document.id}` : "";
    }

    function documentForMusician(musicianId) {
      return studentInvoiceDocuments.value.find((document) => document.musicianId === musicianId);
    }

    function documentForTeacher(teacherId) {
      return draftForTeacher(teacherId) || documentsForTeacher(teacherId).find((document) => ["GENERATED", "SENT"].includes(document.status));
    }

    function documentsForTeacher(teacherId) {
      return [...teacherInvoiceRequestDocuments.value, ...documentHistory.value]
        .filter((document) => document.type === "TEACHER_INVOICE_REQUEST" && document.teacherId === teacherId)
        .sort((left, right) => Number(right.installmentNumber || 0) - Number(left.installmentNumber || 0));
    }

    function draftForTeacher(teacherId) {
      return teacherInvoiceRequestDocuments.value.find((document) => document.teacherId === teacherId && document.status === "DRAFT");
    }

    function finalizedDocumentsForTeacher(teacherId) {
      return documentsForTeacher(teacherId).filter((document) => document.status !== "DRAFT");
    }

    function defaultTeacherEndWeek() {
      const term = selectedTerm.value;
      if (!term) return 1;
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const currentWeek = Math.ceil((((now - start) / 86400000) + start.getUTCDay() + 1) / 7);
      const proposed = state.settings.year === now.getUTCFullYear() ? currentWeek - 1 : term.endWeek;
      return Math.max(term.startWeek, Math.min(term.endWeek, proposed));
    }

    function selectedTeacherEndWeek(teacherId) {
      if (!teacherEndWeeks[teacherId]) teacherEndWeeks[teacherId] = defaultTeacherEndWeek();
      return Number(teacherEndWeeks[teacherId]);
    }

    async function reportTeacherAdjustment(document) {
      const amountText = window.prompt("Montant signé de l'écart (ex. 25,00 ou -25,00) :");
      if (!amountText) return;
      const amount = Number(amountText.replace(",", "."));
      if (!Number.isFinite(amount) || amount === 0) return showToast("Le montant doit être non nul", "warning");
      const reason = window.prompt("Motif de la régularisation :");
      if (!reason?.trim()) return;
      const result = await requestResource("POST", `documents/${document.id}/teacher-adjustments`, { amount, reason: reason.trim() }, { successMessage: "Écart reporté sur la prochaine situation", errorMessage: "Écart non enregistré" });
      if (result) await loadBillingSummary();
    }

    async function deleteTeacherAdjustment(adjustment) {
      if (!window.confirm("Supprimer cette régularisation en attente ?")) return;
      const result = await requestResource("DELETE", `teacher-adjustments/${adjustment.id}`, null, { successMessage: "Régularisation supprimée", errorMessage: "Suppression impossible" });
      if (result !== undefined) await loadBillingSummary();
    }

    function replaceLoadedDocument(updated) {
      [studentInvoiceDocuments, teacherInvoiceRequestDocuments].forEach((collection) => {
        const index = collection.value.findIndex((document) => document.id === updated.id);
        if (index >= 0) collection.value.splice(index, 1, updated);
      });
    }

    async function markAllStudentInvoicesSent() {
      if (!can("BILLING_PRINT") || markingStudentInvoicesSent.value || !studentInvoicesToSend.value.length) return;
      if (!ensureYearNotClosed("Le marquage est verrouillé")) return;
      const count = studentInvoicesToSend.value.length;
      const year = state.settings.year;
      const term = selectedTerm.value;
      if (!window.confirm(`Après transmission du PDF global, marquer les ${count} facture(s) individuelle(s) validée(s) de ${term.name} ${year} comme envoyées ?`)) return;
      markingStudentInvoicesSent.value = true;
      try {
        const updated = await requestResource("POST", `accounting-years/${year}/terms/${term.id}/student-invoices/sent`, null, {
          errorMessage: "Les factures n’ont pas pu être marquées comme envoyées",
          preserveApiStatus: true,
        });
        if (updated) {
          if (state.settings.year === year && selectedTerm.value.id === term.id) updated.forEach(replaceLoadedDocument);
          showToast(updated.length ? `${updated.length} facture(s) marquée(s) comme envoyée(s)` : "Aucune nouvelle facture à marquer comme envoyée", "success");
        }
      } finally {
        markingStudentInvoicesSent.value = false;
      }
    }

    async function markDocumentSent(document) {
      if (!window.confirm(`Marquer ${document.documentNumber || 'ce document'} comme envoyé ?`)) return;
      const updated = await requestResource("POST", `documents/${document.id}/sent`, null, { successMessage: "Document marqué comme envoyé", errorMessage: "Transition impossible" });
      if (updated) replaceLoadedDocument(updated);
    }

    async function cancelFinalDocument(document) {
      const reason = window.prompt("Motif obligatoire de l’annulation :");
      if (!reason?.trim()) return;
      const updated = await requestResource("POST", `documents/${document.id}/cancel`, { reason: reason.trim() }, { successMessage: "Document annulé", errorMessage: "Annulation impossible" });
      if (updated) {
        replaceLoadedDocument(updated);
        documentHistory.value.push(updated);
      }
    }

    async function correctFinalDocument(document) {
      const reason = window.prompt("Motif obligatoire de la correction :");
      if (!reason?.trim()) return;
      if (!window.confirm("Créer la chaîne de correction sans modifier le document original ?")) return;
      const result = await requestResource("POST", `documents/${document.id}/correct`, { reason: reason.trim() }, { successMessage: "Correction créée", errorMessage: "Correction impossible" });
      if (!result) return;
      [studentInvoiceDocuments, teacherInvoiceRequestDocuments].forEach((collection) => {
        const index = collection.value.findIndex((entry) => entry.id === document.id);
        if (index >= 0) collection.value.splice(index, 1, result.replacement);
      });
      documentHistory.value.push(result.original, ...(result.creditNote ? [result.creditNote] : []));
    }

    function documentStatusLabel(status) {
      return { DRAFT: "Brouillon", GENERATED: "Validé", SENT: "Envoyé", CANCELLED: "Annulé", CREDITED: "Crédité" }[status] || status;
    }

    function showToast(message, type = "success") {
      const id = createId();
      toasts.value = [...toasts.value, { id, message, type }];
      setTimeout(() => {
        toasts.value = toasts.value.filter((toast) => toast.id !== id);
      }, 3600);
    }

    function ensureStructureMutable() {
      if (!structureLocked.value) return true;
      showToast(`Année ${yearStatusLabel.value.toLowerCase()} : la configuration est verrouillée`, "warning");
      return false;
    }

    function ensureYearNotClosed(message) {
      if (!yearClosed.value) return true;
      showToast(`${message} pour une année clôturée`, "warning");
      return false;
    }

    async function updateYearStatus(status) {
      if (!can("CONFIG_TERMS") || status === yearStatus.value) return;
      if (status === "CLOSED" && !window.confirm(
        `Clôturer définitivement l'année ${state.settings.year} ? Les présences, dépenses et émissions seront verrouillées.`,
      )) return;
      const savedSettings = await requestResource(
        "PUT",
        `accounting-years/${state.settings.year}/status`,
        { status },
        {
          successMessage: status === "CLOSED" ? "Année clôturée" : "Statut annuel mis à jour",
          errorMessage: "Changement de statut refusé",
        },
      );
      if (savedSettings) state.settings = { ...state.settings, ...savedSettings };
    }

    function togglePasswordVisibility(field) {
      passwordVisibility[field] = !passwordVisibility[field];
    }

    function passwordInputType(field) {
      return passwordVisibility[field] ? "text" : "password";
    }

    function roleLabel(role) {
      const configured = authRoles.value.find((item) => item.code === role);
      if (configured?.label) return configured.label;
      const labels = {
        ADMINISTRATOR: "Administrateur",
        MANAGER: "Gestionnaire",
        OBSERVER: "Observateur",
        USER_CREATE: "Création utilisateur",
        USER_UPDATE: "Mise à jour utilisateur",
        USER_DELETE: "Suppression utilisateur",
      };
      return labels[role] || role;
    }

    function roleBadgeClass(role) {
      return `role-badge role-${String(role || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    }

    function setAuthSession(session) {
      sessionTransport.invalidate();
      storeAuthSession(session);
    }

    function storeAuthSession(session) {
      const { refreshToken: _discardedRefreshToken, ...safeSession } = session;
      authSession.value = safeSession;
      currentUser.value = normalizeAuthUser(safeSession.user);
      syncProfileForm();
      apiStatus.value = "connecté";
      loginError.value = "";
    }

    function updateStoredCurrentUser(user) {
      currentUser.value = normalizeAuthUser(user);
      syncProfileForm();
      if (authSession.value) {
        authSession.value = { ...authSession.value, user: currentUser.value };
      }
    }

    function syncProfileForm() {
      profileForm.displayName = currentUser.value?.displayName || "";
      profileForm.email = currentUser.value?.email || "";
      profileForm.locale = currentUser.value?.locale || "fr-FR";
      profileForm.phone = currentUser.value?.phone || "";
    }

    function resetUserAdminForm() {
      Object.assign(userAdminForm, {
        username: "",
        displayName: "",
        email: "",
        roles: ["OBSERVER"],
      });
      generatedTemporaryPassword.value = "";
    }

    function openAccountView() {
      activeView.value = "account";
      if (!mustChangePassword.value && can("ACCOUNT_USER")) loadTwoFactorStatus();
      if (!mustChangePassword.value) loadAuthAdministration();
    }

    function openBilling(tab = billingTab.value) {
      billingTab.value = tab;
      activeView.value = "billing";
    }

    function openNavView(view) {
      // Referme aussi le menu « Plus » quand on choisit l'écran déjà affiché.
      mobileMenuOpen.value = false;
      if (view === "billing") openBilling();
      else activeView.value = view;
    }

    async function switchSeason() {
      seasonPickerOpen.value = false;
      await loadFromApi();
    }

    function normalizeAuthRoleSelection(roles) {
      return [...new Set((roles || []).filter(Boolean))];
    }

    function nextAuthRoles(currentRoles, roleCode, checked) {
      const current = new Set(currentRoles || []);
      if (checked) {
        current.add(roleCode);
      } else {
        current.delete(roleCode);
      }
      return normalizeAuthRoleSelection([...current]);
    }

    function toggleUserAdminRole(roleCode, checked) {
      userAdminForm.roles = nextAuthRoles(userAdminForm.roles, roleCode, checked);
    }

    function toggleAuthUserEditRole(roleCode, checked) {
      authUserEditForm.roles = nextAuthRoles(authUserEditForm.roles, roleCode, checked);
    }

    function startEditAuthUser(user) {
      editingAuthUserId.value = user.id;
      Object.assign(authUserEditForm, {
        username: user.username || "",
        displayName: user.displayName || "",
        email: user.email || "",
        roles: normalizeAuthRoleSelection(user.roles || []),
      });
    }

    function cancelEditAuthUser() {
      editingAuthUserId.value = null;
      Object.assign(authUserEditForm, {
        username: "",
        displayName: "",
        email: "",
        roles: [],
      });
    }

    function isAnonymizedAuthUser(user) {
      const username = String(user?.username || "");
      const email = String(user?.email || "");
      return username.startsWith("anonymized-") || email.startsWith("anonymized-");
    }

    function revokeCurrentAvatarUrl() {
      if (currentUserAvatarUrl.value) {
        URL.revokeObjectURL(currentUserAvatarUrl.value);
        currentUserAvatarUrl.value = "";
      }
    }

    function revokeAuthUserAvatarUrls() {
      Object.entries(authUserAvatarUrls).forEach(([userId, avatarUrl]) => {
        if (avatarUrl) URL.revokeObjectURL(avatarUrl);
        delete authUserAvatarUrls[userId];
      });
    }

    function clearAuthSession() {
      sessionTransport.invalidate();
      avatarUploadSequence += 1;
      avatarCropFile.value = null;
      avatarFile.value = null;
      avatarUploading.value = false;
      avatarUploadError.value = "";
      revokeCurrentAvatarUrl();
      revokeAuthUserAvatarUrls();
      authSession.value = null;
      currentUser.value = null;
      twoFactorStatus.value = null;
      resetMfaForms();
      resetMfaChallenge();
      authUsers.value = [];
      generatedTemporaryPassword.value = "";
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      apiStatus.value = "déconnecté";
    }

    function refreshSession(silent = false) {
      return sessionTransport.refreshSession(silent);
    }

    function apiFetch(resource, options = {}, retry = true) {
      return sessionTransport.apiFetch(resource, options, retry);
    }

    async function loadBillingSummary() {
      const year = Number(state.settings.year);
      const termId = selectedTerm.value?.id;
      if (!authSession.value?.accessToken || !termId || !canAny(["BILLING_READ", "BILLING_PRINT"])) {
        billingSummary.value = null;
        billingSummariesByTerm.value = {};
        billingStatus.value = "idle";
        billingError.value = "";
        return;
      }

      const requestSequence = ++billingRequestSequence;
      billingStatus.value = "loading";
      billingError.value = "";
      try {
        const summaries = await Promise.all(state.settings.terms.map(async (term) => {
          const response = await apiFetch(`accounting-years/${year}/terms/${term.id}/billing`);
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${term.id}`);
          return [term.id, await response.json()];
        }));
        if (requestSequence !== billingRequestSequence) return;
        billingSummariesByTerm.value = Object.fromEntries(summaries);
        billingSummary.value = billingSummariesByTerm.value[termId] || null;
        billingStatus.value = "ready";
        apiStatus.value = "connecté";
        await loadTermDocuments(year, termId);
        await loadTermAttendance(year, termId);
      } catch (error) {
        if (requestSequence !== billingRequestSequence) return;
        console.warn(`API GET billing for ${year}/${termId} failed`, error);
        billingSummary.value = null;
        billingSummariesByTerm.value = {};
        billingStatus.value = "error";
        billingError.value = "Calcul comptable indisponible. Les montants ne sont pas recalculés dans le navigateur.";
      }
    }

    async function loadTermDocuments(year, termId) {
      try {
        const response = await apiFetch(`accounting-years/${year}/terms/${termId}/documents`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const documents = await response.json();
        const activeStatuses = new Set(["DRAFT", "GENERATED", "SENT"]);
        studentInvoiceDocuments.value = documents.filter((document) => document.type === "STUDENT_INVOICE" && document.musicianId && activeStatuses.has(document.status));
        teacherInvoiceRequestDocuments.value = documents.filter((document) => document.type === "TEACHER_INVOICE_REQUEST" && document.teacherId && activeStatuses.has(document.status));
        studentInvoiceSummaryDocument.value = documents.find((document) => document.type === "STUDENT_INVOICE" && !document.musicianId && !document.teacherId && activeStatuses.has(document.status)) || null;
        documentHistory.value = documents.filter((document) => document.type === "CREDIT_NOTE" || ["CANCELLED", "CREDITED"].includes(document.status));
      } catch (error) {
        console.warn(`API GET documents for ${year}/${termId} failed`, error);
      }
    }

    async function loadTermAttendance(year, termId) {
      if (!can("PRESENCE_READ")) return;
      try {
        const response = await apiFetch(`accounting-years/${year}/terms/${termId}/attendance`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const attendance = normalizeAttendanceEntries(await response.json());
        const otherTerms = state.attendance.filter((entry) => entry.termId !== termId);
        state.attendance = [...otherTerms, ...attendance];
      } catch (error) {
        console.warn(`API GET attendance for ${year}/${termId} failed`, error);
      }
    }

    function billingMoney(value) {
      return billingStatus.value === "ready" ? money(value) : "—";
    }

    function resourceAffectsBilling(method, resource) {
      if (!["POST", "PUT", "DELETE"].includes(method)) return false;
      return /^(teachers|musicians|bands|individual-courses)(\/|$)/.test(resource)
        || /^accounting-years\/[^/]+\/settings$/.test(resource);
    }

    async function loadCurrentAvatar() {
      revokeCurrentAvatarUrl();
      const avatarUrl = currentUser.value?.avatar?.url;
      if (!avatarUrl) return;
      try {
        const response = await apiFetch(avatarUrl.replace(/^\/api\/+/, ""));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        currentUserAvatarUrl.value = URL.createObjectURL(await response.blob());
      } catch (error) {
        console.warn("API GET current avatar failed", error);
      }
    }

    function markApiFailure(options = {}) {
      if (!authSession.value) {
        apiStatus.value = "déconnecté";
        if (options.expiredMessage) showToast(options.expiredMessage, "warning");
      } else if (!options.preserveApiStatus) {
        apiStatus.value = "mode demo";
      }
    }

    async function apiErrorMessage(response, fallback) {
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("json")) return fallback;
      try {
        const payload = await response.json();
        const code = payload.code || payload.title;
        if (code === "INVALID_CURRENT_PASSWORD") return "Mot de passe actuel incorrect";
        if (code === "PASSWORD_POLICY_FAILED") {
          const ruleLabels = {
            MIN_LENGTH: "12 caractères minimum",
            LOWERCASE: "une minuscule",
            UPPERCASE: "une majuscule",
            DIGIT: "un chiffre",
            SPECIAL: "un caractère spécial",
          };
          const rule = ruleLabels[payload.params?.rule] || payload.params?.rule;
          return `Nouveau mot de passe refusé${rule ? `: ${rule}` : ""}`;
        }
        if (code === "PRECONDITION_REQUIRED") return "Clé d'idempotence manquante";
        if (code === "TOKEN_EXPIRED") return "Session expirée";
        if (code === "INVALID_CREDENTIALS") return "Identifiant ou mot de passe incorrect";
        if (code === "RATE_LIMITED") return "Trop de tentatives. Patientez avant de réessayer.";
        if (code === "INVALID_MFA_CODE") return "Code de sécurité incorrect ou déjà utilisé";
        if (code === "MFA_CHALLENGE_EXPIRED") return "Le délai de validation est dépassé. Reconnectez-vous.";
        if (code === "MFA_CHALLENGE_INVALID") return "La demande de validation n’est plus valable. Reconnectez-vous.";
        if (code === "MFA_SETUP_REQUIRED") return "L’enrôlement a expiré. Générez un nouveau QR code.";
        if (code === "MFA_ALREADY_ENABLED") return "L’authentification à deux facteurs est déjà active";
        if (code === "MFA_NOT_ENABLED") return "L’authentification à deux facteurs n’est pas active";
        if (code === "MFA_ENROLLMENT_REQUIRED") return "L’authentification à deux facteurs doit être activée pour ce compte administrateur";
        if (code === "PAYLOAD_TOO_LARGE") return "L’image dépasse la taille maximale de 2 Mo";
        if (code === "UNSUPPORTED_MEDIA_TYPE") return "Choisissez une image PNG, JPEG ou WebP";
        if (code === "INVALID_AVATAR_FILE") return "Image illisible ou trop grande (10 millions de pixels maximum)";
        if (code === "AVATAR_PROCESSING_BUSY") return "Le traitement des images est occupé. Réessayez dans un instant.";
        return code || fallback;
      } catch {
        return fallback;
      }
    }

    function resetMfaChallenge() {
      Object.assign(mfaChallenge, { active: false, token: "", expiresAt: "", methods: [], code: "" });
      mfaLoginError.value = "";
      mfaLoginMode.value = "totp";
      mfaLoginDigits.value = emptyTotpDigits();
    }

    function resetMfaForms() {
      mfaSetup.value = null;
      Object.assign(mfaSetupForm, { password: "", code: "" });
      mfaSetupDigits.value = emptyTotpDigits();
      mfaSetupError.value = "";
      Object.assign(mfaRecoveryForm, { code: "" });
      Object.assign(mfaDisableForm, { password: "", code: "" });
      mfaAccountAction.value = "";
    }

    function setMfaLoginMode(mode) {
      mfaLoginMode.value = mode;
      mfaLoginDigits.value = emptyTotpDigits();
      mfaChallenge.code = "";
      mfaLoginError.value = "";
    }

    async function loadTwoFactorStatus() {
      if (!authSession.value?.accessToken || !can("ACCOUNT_USER")) {
        twoFactorStatus.value = null;
        return null;
      }
      twoFactorLoading.value = true;
      try {
        const response = await apiFetch("auth/users/me/2fa");
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        twoFactorStatus.value = await response.json();
        return twoFactorStatus.value;
      } catch (error) {
        console.warn("API GET auth/users/me/2fa failed", error);
        if (isAdministrator.value) loginError.value = error.message || "État 2FA indisponible";
        return null;
      } finally {
        twoFactorLoading.value = false;
      }
    }

    async function initializeAuthenticatedSession() {
      authFlowPending.value = true;
      try {
        if (mustChangePassword.value) return;
        await loadTwoFactorStatus();
        if (mustEnrollMfa.value) return;
        await loadFromApi();
      } finally {
        authFlowPending.value = false;
      }
    }

    async function verifyMfaLogin() {
      mfaLoginError.value = "";
      const code = mfaLoginMode.value === "totp" ? mfaLoginDigits.value.join("") : mfaChallenge.code.trim();
      if (!mfaLoginCodeComplete.value) {
        mfaLoginError.value = mfaLoginMode.value === "totp"
          ? "Saisissez les six chiffres du code de sécurité."
          : "Saisissez un code de récupération.";
        return;
      }
      authLoading.value = true;
      try {
        const response = await fetch(`${apiBase.value}/auth/login/2fa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("mfa-login"),
          },
          credentials: "include",
          body: JSON.stringify({ mfaToken: mfaChallenge.token, code }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        setAuthSession(await response.json());
        resetMfaChallenge();
        await initializeAuthenticatedSession();
      } catch (error) {
        console.warn("API POST auth/login/2fa failed", error);
        mfaLoginError.value = error.message || "Code de sécurité refusé";
      } finally {
        authLoading.value = false;
      }
    }

    async function beginMfaSetup() {
      if (!mfaSetupForm.password) {
        showToast("Saisissez votre mot de passe actuel", "warning");
        return;
      }
      twoFactorLoading.value = true;
      mfaSetupError.value = "";
      try {
        const response = await apiFetch("auth/users/me/2fa/setup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("mfa-setup"),
          },
          body: JSON.stringify({ password: mfaSetupForm.password }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        mfaSetup.value = await response.json();
        mfaSetupForm.password = "";
        mfaSetupForm.code = "";
        mfaSetupDigits.value = emptyTotpDigits();
      } catch (error) {
        console.warn("API POST auth/users/me/2fa/setup failed", error);
        showToast(error.message || "Enrôlement 2FA impossible", "error");
      } finally {
        twoFactorLoading.value = false;
      }
    }

    async function activateTwoFactor() {
      if (!mfaSetupCodeComplete.value) {
        showToast("Saisissez le code à six chiffres affiché par l’application", "warning");
        return;
      }
      const code = mfaSetupCode.value;
      mfaSetupError.value = "";
      twoFactorLoading.value = true;
      try {
        const response = await apiFetch("auth/users/me/2fa/activate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("mfa-activate"),
          },
          body: JSON.stringify({ code }),
        }, false);
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        const payload = await response.json();
        twoFactorStatus.value = { enabled: true, recoveryCodesRemaining: payload.recoveryCodes?.length || 0, activatedAt: payload.generatedAt };
        mfaRecoveryCodes.value = payload.recoveryCodes || [];
        mfaRecoveryRequiresRelogin.value = true;
        resetMfaForms();
      } catch (error) {
        console.warn("API POST auth/users/me/2fa/activate failed", error);
        mfaSetupDigits.value = emptyTotpDigits();
        await nextTick();
        mfaSetupError.value = error.message || "Code de vérification refusé";
        await nextTick();
        document.querySelector(".totp-fieldset.error .totp-digit")?.focus();
        showToast(error.message || "Activation 2FA impossible", "error");
      } finally {
        twoFactorLoading.value = false;
      }
    }

    async function regenerateRecoveryCodes() {
      if (!mfaRecoveryForm.code.trim()) {
        showToast("Saisissez un code TOTP ou de récupération", "warning");
        return;
      }
      twoFactorLoading.value = true;
      try {
        const response = await apiFetch("auth/users/me/2fa/recovery-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("mfa-recovery"),
          },
          body: JSON.stringify({ code: mfaRecoveryForm.code.trim() }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        const payload = await response.json();
        mfaRecoveryCodes.value = payload.recoveryCodes || [];
        mfaRecoveryRequiresRelogin.value = false;
        mfaRecoveryForm.code = "";
        mfaAccountAction.value = "";
        await loadTwoFactorStatus();
      } catch (error) {
        console.warn("API POST auth/users/me/2fa/recovery-codes failed", error);
        showToast(error.message || "Codes non régénérés", "error");
      } finally {
        twoFactorLoading.value = false;
      }
    }

    async function disableTwoFactor() {
      if (!mfaDisableForm.password || !mfaDisableForm.code.trim()) {
        showToast("Le mot de passe et un code de sécurité sont obligatoires", "warning");
        return;
      }
      twoFactorLoading.value = true;
      try {
        const response = await apiFetch("auth/users/me/2fa/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("mfa-disable"),
          },
          body: JSON.stringify({ password: mfaDisableForm.password, code: mfaDisableForm.code.trim() }),
        }, false);
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        clearAuthSession();
        resetMfaForms();
        showToast("Authentification à deux facteurs désactivée. Reconnectez-vous.", "success");
      } catch (error) {
        console.warn("API POST auth/users/me/2fa/disable failed", error);
        showToast(error.message || "Désactivation 2FA impossible", "error");
      } finally {
        twoFactorLoading.value = false;
      }
    }

    async function copyRecoveryCodes() {
      if (!mfaRecoveryCodes.value.length) return;
      const content = mfaRecoveryCodes.value.join("\n");
      try {
        await navigator.clipboard.writeText(content);
        showToast("Codes de récupération copiés", "success");
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        showToast("Codes de récupération copiés", "success");
      }
    }

    function downloadRecoveryCodes() {
      if (!mfaRecoveryCodes.value.length) return;
      const content = `Compta Zik — codes de récupération 2FA\nUtilisateur : ${currentUser.value?.username || ""}\n\n${mfaRecoveryCodes.value.join("\n")}\n`;
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `compta-zik-codes-recuperation-${currentUser.value?.username || "compte"}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }

    function acknowledgeRecoveryCodes() {
      const requiresRelogin = mfaRecoveryRequiresRelogin.value;
      mfaRecoveryCodes.value = [];
      mfaRecoveryRequiresRelogin.value = false;
      if (requiresRelogin) {
        clearAuthSession();
        showToast("2FA activée. Reconnectez-vous avec votre code de sécurité.", "success");
      }
    }

    async function requestResource(method, resource, body = null, options = {}) {
      try {
        const response = await apiFetch(resource, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(toApiPayload(resource, body)) : null,
        });
        if (!response.ok) {
          if (response.status === 409) {
            const problem = await response.json().catch(() => ({}));
            if (resource.includes("teacher-invoice-requests") || resource.includes("teacher-adjustments")) {
              await loadBillingSummary();
            } else {
              await loadFromApi();
              if (selectedTerm.value?.id) await loadTermAttendance(state.settings.year, selectedTerm.value.id);
            }
            showToast(problem.detail || "Ces données ont été modifiées ailleurs. La version récente a été rechargée.", "warning");
            return;
          }
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status} ${errorText}`);
        }
        apiStatus.value = "connecté";
        if (options.successMessage) showToast(options.successMessage, "success");
        if (resourceAffectsBilling(method, resource)) queueMicrotask(loadBillingSummary);
        if (response.status === 204) return null;
        const contentType = response.headers.get("content-type") || "";
        return contentType.includes("application/json") ? response.json() : null;
      } catch (error) {
        console.warn(`API ${method} ${resource} failed`, error);
        markApiFailure(options);
        if (options.errorMessage) showToast(options.errorMessage, "warning");
        return undefined;
      }
    }

    async function persistResource(method, resource, body = null) {
      await requestResource(method, resource, body);
    }

    async function saveAttendance(entry) {
      try {
        const response = await apiFetch("attendance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toApiPayload("attendance", entry)),
        });
        if (!response.ok) {
          if (response.status === 409) {
            const problem = await response.json().catch(() => ({}));
            await loadFromApi();
            if (selectedTerm.value?.id) await loadTermAttendance(state.settings.year, selectedTerm.value.id);
            showToast(problem.detail || "Cette présence a été modifiée ailleurs. Les données ont été rechargées.", "warning");
            return;
          }
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status} ${errorText}`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const savedEntry = await response.json();
          Object.assign(entry, {
            ...savedEntry,
            entityType: apiAttendanceTypeToUi(savedEntry.entityType),
            status: savedEntry.status || (savedEntry.present ? "PRESENT" : "ABSENT"),
          });
        }
        apiStatus.value = "connecté";
        showToast("Présence enregistrée", "success");
        await loadBillingSummary();
      } catch (error) {
        console.warn("API PUT attendance failed", error);
        markApiFailure();
        showToast("Présence conservée en local", "warning");
      }
    }

    async function loadFromApi() {
      try {
        const year = Number(accountingYearInput.value) || new Date().getFullYear();
        localStorage.setItem("compta-zik-year", String(year));
        const response = await apiFetch(`accounting-years/${year}/snapshot`);
        if (!response.ok) throw new Error("API indisponible");
        const snapshot = await response.json();
        Object.assign(state, normalizeSnapshot(snapshot));
        accountingYearInput.value = state.settings.year;
        resetFormsAfterStateLoad();
        apiStatus.value = "connecté";
        await loadCurrentUser();
        await loadBillingSummary();
        showToast(`Année ${state.settings.year} chargée`, "success");
      } catch {
        billingSummary.value = null;
        billingSummariesByTerm.value = {};
        billingStatus.value = "error";
        billingError.value = "Calcul comptable indisponible. Les montants ne sont pas recalculés dans le navigateur.";
        markApiFailure({ expiredMessage: "Session expirée" });
        showToast("Backend indisponible, mode démo actif", "warning");
      }
    }

    async function loadCurrentUser() {
      try {
        const response = await apiFetch("auth/users/me");
        if (!response.ok) throw new Error("Utilisateur indisponible");
        updateStoredCurrentUser(await response.json());
        await loadCurrentAvatar();
        if (!mustChangePassword.value && canAdminUsers.value) await loadAuthAdministration();
      } catch (error) {
        console.warn("API GET auth/users/me failed", error);
        if (!authSession.value) currentUser.value = null;
      }
    }

    async function saveProfile() {
      if (!can("ACCOUNT_USER")) return;
      try {
        const response = await apiFetch("auth/users/me/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": "*",
          },
          body: JSON.stringify({
            displayName: profileForm.displayName.trim(),
            email: profileForm.email.trim(),
            locale: profileForm.locale,
            phone: profileForm.phone.trim() || null,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        updateStoredCurrentUser(await response.json());
        showToast("Profil mis à jour", "success");
      } catch (error) {
        console.warn("API PATCH auth/users/me/profile failed", error);
        showToast("Profil non mis à jour", "warning");
      }
    }

    function selectAvatarFile(event) {
      avatarFile.value = event.target.files?.[0] || null;
      event.target.value = "";
    }

    function openAvatarCrop() {
      if (!can("ACCOUNT_USER") || !avatarFile.value || avatarUploading.value) return;
      avatarUploadError.value = "";
      avatarCropFile.value = avatarFile.value;
    }

    function cancelAvatarCrop() {
      if (avatarUploading.value) return;
      avatarCropFile.value = null;
      avatarUploadError.value = "";
    }

    async function uploadAvatar(croppedImage) {
      if (!can("ACCOUNT_USER") || !avatarCropFile.value || avatarUploading.value || !(croppedImage instanceof Blob)) return;
      const sequence = ++avatarUploadSequence;
      const userId = currentUser.value?.id;
      avatarUploading.value = true;
      avatarUploadError.value = "";
      try {
        const response = await apiFetch("auth/users/me/avatar", {
          method: "PUT",
          headers: {
            "Content-Type": croppedImage.type,
            "If-Match": "*",
          },
          body: croppedImage,
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Avatar non mis à jour"));
        const user = await response.json();
        if (sequence !== avatarUploadSequence || currentUser.value?.id !== userId) return;
        updateStoredCurrentUser(user);
        avatarFile.value = null;
        avatarCropFile.value = null;
        await loadCurrentAvatar();
        if (sequence === avatarUploadSequence) showToast("Avatar mis à jour", "success");
      } catch (error) {
        if (sequence !== avatarUploadSequence) return;
        console.warn("API PUT auth/users/me/avatar failed", error);
        avatarUploadError.value = error.message || "Avatar non mis à jour";
      } finally {
        if (sequence === avatarUploadSequence) avatarUploading.value = false;
      }
    }

    async function deleteAvatar() {
      if (!can("ACCOUNT_USER")) return;
      try {
        const response = await apiFetch("auth/users/me/avatar", {
          method: "DELETE",
          headers: { "If-Match": "*" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        updateStoredCurrentUser(await response.json());
        revokeCurrentAvatarUrl();
        showToast("Avatar supprimé", "success");
      } catch (error) {
        console.warn("API DELETE auth/users/me/avatar failed", error);
        showToast("Avatar non supprimé", "warning");
      }
    }

    async function changePassword() {
      if (!can("ACCOUNT_USER") && !mustChangePassword.value) return;
      if (!passwordForm.currentPassword || !passwordForm.newPassword) {
        showToast("Mot de passe incomplet", "warning");
        return;
      }
      if (!isNewPasswordValid.value) {
        showToast("Le nouveau mot de passe ne respecte pas la politique de sécurité", "warning");
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        showToast("La confirmation ne correspond pas", "warning");
        return;
      }
      const wasForcedPasswordChange = mustChangePassword.value;
      try {
        const response = await apiFetch("auth/password/change", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("password-change"),
          },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
            revokeOtherSessions: passwordForm.revokeOtherSessions,
          }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        Object.assign(passwordForm, {
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
          revokeOtherSessions: false,
        });
        const refreshed = await refreshSession();
        if (refreshed) {
          await initializeAuthenticatedSession();
        } else if (wasForcedPasswordChange) {
          showToast("Mot de passe modifié. Reconnectez-vous pour continuer.", "success");
        }
        showToast("Mot de passe changé", "success");
      } catch (error) {
        console.warn("API POST auth/password/change failed", error);
        showToast(error.message || "Mot de passe non changé", "warning");
      }
    }

    async function loadAuthUsers() {
      if (!canAdminUsers.value) return;
      try {
        const params = new URLSearchParams({
          limit: "50",
          offset: "0",
          sort: "username",
        });
        if (authUserSearch.value.trim()) params.set("search", authUserSearch.value.trim());
        const response = await apiFetch(`auth/users?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        authUsers.value = (payload.items || []).filter((user) => !isAnonymizedAuthUser(user));
        authUsersPage.value = {
          ...(payload.page || { limit: 50, offset: 0 }),
          total: authUsers.value.length,
        };
        await loadAuthUserAvatars(authUsers.value);
      } catch (error) {
        console.warn("API GET auth/users failed", error);
        revokeAuthUserAvatarUrls();
        authUsers.value = currentUser.value ? [currentUser.value] : [];
        authUsersPage.value = { total: authUsers.value.length, limit: 50, offset: 0 };
        showToast("Utilisateurs non chargés", "warning");
      }
    }

    async function loadAuthUserAvatars(users) {
      revokeAuthUserAvatarUrls();
      const usersWithAvatar = (users || []).filter((user) => (
        user?.id
        && user.id !== currentUser.value?.id
        && user.avatar?.url
      ));
      await Promise.all(usersWithAvatar.map(async (user) => {
        try {
          const avatarResource = String(user.avatar.url).replace(/^\/api\/+/, "");
          const response = await apiFetch(avatarResource);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          authUserAvatarUrls[user.id] = URL.createObjectURL(await response.blob());
        } catch (error) {
          console.warn(`API GET avatar for user ${user.id} failed`, error);
        }
      }));
    }

    async function loadAuthRoles() {
      if (!canAdminUsers.value) return;
      try {
        const params = new URLSearchParams({
          limit: "100",
          offset: "0",
        });
        const response = await apiFetch(`auth/roles?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        authRoles.value = payload.items || [];
      } catch (error) {
        console.warn("API GET auth/roles failed", error);
        showToast("Rôles non chargés", "warning");
      }
    }

    async function loadAuthAdministration() {
      await Promise.all([loadAuthUsers(), loadAuthRoles()]);
    }

    async function copyTemporaryPassword() {
      if (!generatedTemporaryPassword.value) return;
      try {
        let copied = false;
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(generatedTemporaryPassword.value);
            copied = true;
          } catch {
            copied = false;
          }
        }
        if (!copied) {
          const input = document.createElement("textarea");
          input.value = generatedTemporaryPassword.value;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.left = "-9999px";
          document.body.append(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
        showToast("Mot de passe copié", "success");
      } catch (error) {
        console.warn("Temporary password copy failed", error);
        showToast("Copie impossible", "warning");
      }
    }

    async function createAuthUser() {
      if (!canCreateUsers.value) return;
      if (!userAdminForm.username.trim() || !userAdminForm.email.trim()) {
        showToast("Identifiant et email obligatoires", "warning");
        return;
      }
      const requestedRoles = normalizeAuthRoleSelection(userAdminForm.roles);
      if (!requestedRoles.length) {
        showToast("Sélectionne au moins un rôle", "warning");
        return;
      }
      try {
        const response = await apiFetch("auth/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("user-create"),
          },
          body: JSON.stringify({
            username: userAdminForm.username.trim(),
            displayName: userAdminForm.displayName.trim() || userAdminForm.username.trim(),
            email: userAdminForm.email.trim(),
            roles: requestedRoles,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const created = await response.json();
        generatedTemporaryPassword.value = created.temporaryPassword || "";
        resetUserAdminForm();
        generatedTemporaryPassword.value = created.temporaryPassword || "";
        await loadAuthUsers();
        showToast("Utilisateur créé", "success");
      } catch (error) {
        console.warn("API POST auth/users failed", error);
        showToast("Utilisateur non créé", "warning");
      }
    }

    async function saveAuthUserRoles() {
      if (!canAdminUsers.value || !editingAuthUserId.value) return;
      const requestedRoles = normalizeAuthRoleSelection(authUserEditForm.roles);
      if (!requestedRoles.length) {
        showToast("Sélectionne au moins un rôle", "warning");
        return;
      }
      try {
        const editedUserId = editingAuthUserId.value;
        const response = await apiFetch(`auth/users/${editingAuthUserId.value}/roles`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "If-Match": "*",
          },
          body: JSON.stringify({ roles: requestedRoles }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        cancelEditAuthUser();
        await loadAuthUsers();
        if (editedUserId === currentUser.value?.id) await loadCurrentUser();
        showToast("Rôles utilisateur modifiés", "success");
      } catch (error) {
        console.warn("API PUT auth/users roles failed", error);
        showToast(error.message || "Rôles utilisateur non modifiés", "warning");
      }
    }

    async function setAuthUserActive(user, active) {
      if (!canAdminUsers.value) return;
      try {
        const response = await apiFetch(`auth/users/${user.id}/activation`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": "*",
          },
          body: JSON.stringify({ active }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await loadAuthUsers();
        showToast(active ? "Utilisateur activé" : "Utilisateur désactivé", "success");
      } catch (error) {
        console.warn("API PATCH auth/users activation failed", error);
        showToast("Statut utilisateur non modifié", "warning");
      }
    }

    async function resetAuthUserPassword(user) {
      if (!canAdminUsers.value) return;
      try {
        const response = await apiFetch(`auth/users/${user.id}/password/reset`, {
          method: "POST",
          headers: { "Idempotency-Key": createId("password-reset") },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        generatedTemporaryPassword.value = payload.temporaryPassword || "";
        showToast("Mot de passe temporaire généré", "success");
      } catch (error) {
        console.warn("API POST auth/users password reset failed", error);
        showToast("Mot de passe non réinitialisé", "warning");
      }
    }

    async function deleteAuthUser(user) {
      if (!canAdminUsers.value) return;
      const confirmed = window.confirm(`Supprimer définitivement ${user.displayName || user.username} ?`);
      if (!confirmed) return;
      try {
        const response = await apiFetch(`auth/users/${user.id}?mode=anonymize`, {
          method: "DELETE",
          headers: { "If-Match": "*" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await loadAuthUsers();
        showToast("Utilisateur supprimé", "success");
      } catch (error) {
        console.warn("API DELETE auth/users failed", error);
        showToast("Utilisateur non supprimé", "warning");
      }
    }

    async function login() {
      loginError.value = "";
      if (!loginForm.username.trim() || !loginForm.password) {
        loginError.value = "Saisis un identifiant et un mot de passe.";
        return;
      }
      authLoading.value = true;
      try {
        const response = await fetch(`${apiBase.value}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("login"),
          },
          credentials: "include",
          body: JSON.stringify({
            username: loginForm.username.trim(),
            password: loginForm.password,
            rememberMe: loginForm.rememberMe,
          }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        const payload = await response.json();
        loginForm.password = "";
        if (payload.mfaRequired) {
          Object.assign(mfaChallenge, {
            active: true,
            token: payload.mfaToken || "",
            expiresAt: payload.expiresAt || "",
            methods: payload.methods || [],
            code: "",
          });
          mfaLoginMode.value = "totp";
          mfaLoginDigits.value = emptyTotpDigits();
          mfaLoginError.value = "";
          return;
        }
        setAuthSession(payload);
        await initializeAuthenticatedSession();
      } catch (error) {
        console.warn("API POST auth/login failed", error);
        clearAuthSession();
        loginError.value = error.message || "Identifiants invalides ou service d'authentification indisponible.";
      } finally {
        authLoading.value = false;
      }
    }

    async function logout() {
      // Revoke the cookie produced by an ongoing rotation before clearing the local session.
      await sessionTransport.waitForRefresh();
      sessionTransport.invalidate();
      try {
        await apiFetch("auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createId("logout"),
          },
          body: "{}",
        }, false);
      } catch (error) {
        console.warn("API POST auth/logout failed", error);
      } finally {
        clearAuthSession();
        showToast("Session fermée", "success");
      }
    }

    function saveApiBase() {
      localStorage.setItem("compta-zik-api", apiBase.value);
      localStorage.setItem("compta-zik-year", String(accountingYearInput.value));
      if (authSession.value) loadFromApi();
    }

    function courseLabel(course) {
      const musician = musiciansById.value[course.musicianId];
      const teacher = teachersById.value[course.teacherId];
      return `${fullName(musician)} - ${course.instrument} - ${course.weekday} ${course.startTime} - ${teacher.firstName}`;
    }

    function invoiceText(row) {
      return `Facture élève: ${fullName(row.musician)} - ${selectedTerm.value.name} ${state.settings.year} - Cours individuels ${money(row.courseDue)} - Cotisation groupe ${money(row.groupFee)} - Total ${money(row.totalDue)}`;
    }

    function teacherRequestText(row) {
      return `Demande de facture: ${fullName(row.teacher)} - ${selectedTerm.value.name} ${state.settings.year} - ${row.individualHours.toFixed(2)} h cours + ${row.workshopHours.toFixed(2)} h groupes - Total ${money(row.totalDue)}`;
    }

    async function loadBackups() {
      if (!can("IMPORT_EXPORT")) return;
      try {
        const response = await apiFetch("data/backups");
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Liste des sauvegardes indisponible"));
        backupFiles.value = await response.json();
        backupListLoaded.value = true;
      } catch (error) {
        backupListLoaded.value = false;
        showToast(error.message, "error");
      }
    }

    async function downloadBackup(fileName) {
      if (!can("IMPORT_EXPORT")) return;
      try {
        const response = await apiFetch(`data/backups/${encodeURIComponent(fileName)}`);
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Téléchargement impossible"));
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function createBackup() {
      if (!can("IMPORT_EXPORT") || transferBusy.value) return;
      transferBusy.value = true;
      try {
        const response = await apiFetch("data/backups", { method: "POST" });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Sauvegarde impossible"));
        const backup = await response.json();
        showToast("Sauvegarde complète créée", "success");
        await loadBackups();
        await downloadBackup(backup.fileName);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        transferBusy.value = false;
      }
    }

    function selectRestoreFile(event) {
      selectedRestoreFile.value = event.target.files?.[0] || null;
      restoreAnalysis.value = null;
      restoreConfirmation.value = "";
    }

    async function analyzeRestore() {
      if (!can("IMPORT_EXPORT") || !selectedRestoreFile.value || transferBusy.value) return;
      if (selectedRestoreFile.value.size > 64 * 1024 * 1024) {
        showToast("L’archive dépasse la limite de 64 Mio", "error");
        return;
      }
      transferBusy.value = true;
      restoreAnalysis.value = null;
      restoreConfirmation.value = "";
      try {
        const response = await apiFetch("data/restore/analyze", {
          method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: selectedRestoreFile.value,
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Archive invalide"));
        restoreAnalysis.value = await response.json();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        transferBusy.value = false;
      }
    }

    async function restoreBackup() {
      if (!can("IMPORT_EXPORT") || transferBusy.value || !selectedRestoreFile.value || !restoreAnalysis.value?.valid) return;
      if (restoreConfirmation.value !== restoreAnalysis.value.confirmationValue) return;
      transferBusy.value = true;
      try {
        const response = await apiFetch("data/restore", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream", "X-Restore-Confirmation": restoreConfirmation.value },
          body: selectedRestoreFile.value,
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Restauration refusée"));
        const result = await response.json();
        restoreAnalysis.value = null;
        restoreConfirmation.value = "";
        selectedRestoreFile.value = null;
        importAnalysis.value = null;
        importPayload.value = null;
        showToast(`Restauration terminée · ${result.documents} documents restaurés`, "success");
        await loadFromApi();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        await loadBackups();
        transferBusy.value = false;
      }
    }

    async function exportData() {
      if (!can("IMPORT_EXPORT")) return;
      try {
        const response = await apiFetch("data/export");
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status} ${errorText}`);
        }
        const payload = await response.json();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `compta-zik-export-${stamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
        apiStatus.value = "connecté";
        showToast("Export JSON généré", "success");
      } catch (error) {
        console.warn("API GET data/export failed", error);
        markApiFailure();
        showToast("Export JSON indisponible côté backend", "warning");
      }
    }

    async function downloadDocument(generatedDocument) {
      if (!generatedDocument?.id) return;
      try {
        const response = await apiFetch(`documents/${generatedDocument.id}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = generatedDocument.fileName || `document-${generatedDocument.id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn("API GET document failed", error);
        markApiFailure();
        showToast("Document indisponible côté backend", "warning");
      }
    }

    function selectImportFile(event) {
      selectedImportFile.value = event.target.files?.[0] || null;
      importPayload.value = null;
      importAnalysis.value = null;
      importConfirmation.value = "";
    }

    async function analyzeImport() {
      if (!can("IMPORT_EXPORT") || transferBusy.value) return;
      if (!selectedImportFile.value) return;
      transferBusy.value = true;
      importAnalysis.value = null;
      importPayload.value = null;
      importConfirmation.value = "";
      try {
        const payload = JSON.parse(await selectedImportFile.value.text());
        const analysis = await requestResource("POST", "data/import/analyze", payload, {
          successMessage: "Analyse de l’import terminée",
          errorMessage: "Analyse de l’import impossible",
        });
        if (analysis) {
          importPayload.value = payload;
          importAnalysis.value = analysis;
        }
      } catch (error) {
        console.warn("Import analysis failed", error);
        showToast("Fichier JSON invalide", "error");
      } finally {
        transferBusy.value = false;
      }
    }

    async function importData() {
      if (!can("IMPORT_EXPORT") || transferBusy.value || !importAnalysis.value?.valid || !importPayload.value) return;
      if (importConfirmation.value !== importAnalysis.value.confirmationValue) return;
      transferBusy.value = true;
      try {
        const response = await apiFetch("data/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Import-Confirmation": importConfirmation.value },
          body: JSON.stringify(importPayload.value),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, `HTTP ${response.status}`));
        const result = await response.json();
        showToast("Import terminé · sauvegarde ZIP disponible ci-dessus", "success");
        restoreAnalysis.value = null;
        restoreConfirmation.value = "";
        await loadFromApi();
        selectedImportFile.value = null;
        importPayload.value = null;
        importAnalysis.value = null;
        importConfirmation.value = "";
      } catch (error) {
        console.warn("Import JSON failed", error);
        showToast(error.message || "Import JSON refusé côté backend", "error");
      } finally {
        await loadBackups();
        transferBusy.value = false;
      }
    }

    async function loadAuditEvents() {
      const events = await requestResource("GET", "audit-events?limit=100", null, { errorMessage: "Journal d’audit indisponible" });
      if (events) auditEvents.value = events;
    }

    function auditActionLabel(action) {
      return { CREATED: "Création", UPDATED: "Modification", DELETED: "Suppression", SETTINGS_UPDATED: "Configuration modifiée", STATUS_CHANGED: "Cycle modifié", RESTORED: "Sauvegarde restaurée", SENT: "Document envoyé", CANCELLED: "Document annulé", CORRECTED: "Document corrigé" }[action] || action;
    }

    function auditUserLabel(event) {
      if (!event?.userId) return "Système";
      if (event.userId === currentUser.value?.id) return currentUser.value.displayName || currentUser.value.username;
      return event.userId;
    }

    selectGroup(selectedGroupId.value);
    watch(selectedTermId, () => {
      preparedStudentInvoices.value = false;
      studentInvoiceDocuments.value = [];
      studentInvoiceSummaryDocument.value = null;
      teacherInvoiceRequestDocuments.value = [];
      documentHistory.value = [];
      loadBillingSummary();
    });
    refreshSession(true).then(async (restored) => {
      if (!restored) return;
      await initializeAuthenticatedSession();
    }).finally(() => {
      authFlowPending.value = false;
    });

    return {
      state,
      isAuthenticated,
      activeView,
      selectedTermId,
      selectedTerm,
      automaticTerm,
      dashboardDateLabel,
      yearStatus,
      yearStatusLabel,
      navGroups,
      attendanceGroups,
      currentAttendanceWeek,
      attendanceWeekSummary,
      attendanceTotalPresent,
      attendanceSaving,
      DAY_ENTRY_CHOICES,
      dayEntryDay,
      dayEntryWeekValue,
      dayEntryDays,
      dayEntryDayValue,
      dayEntrySessions,
      dayEntryTitle,
      dayEntryWeekLabel,
      dayEntryRecorded,
      shiftDayEntryWeek,
      setAttendanceStatus,
      mobileMenuOpen,
      mobileTabs,
      termEyebrow,
      attendanceCellLabel,
      attendanceCellTitle,
      seasonPickerOpen,
      themePreference,
      setThemePreference,
      THEME_CHOICES,
      openNavView,
      switchSeason,
      structureLocked,
      yearClosed,
      isFirstTerm,
      weeks,
      allYearWeeks,
      apiBase,
      accountingYearInput,
      copySourceYear,
      apiStatus,
      authLoading,
      authFlowPending,
      authGateActive,
      authGateTitle,
      login,
      verifyMfaLogin,
      logout,
      loginError,
      loginForm,
      mfaChallenge,
      mfaLoginError,
      mfaLoginMode,
      mfaLoginDigits,
      mfaLoginCodeComplete,
      setMfaLoginMode,
      twoFactorStatus,
      twoFactorLoading,
      mfaSetup,
      mfaSetupDigits,
      mfaSetupError,
      mfaSetupCodeComplete,
      mfaQrSvg,
      mfaRecoveryCodes,
      mfaSetupForm,
      mfaRecoveryForm,
      mfaDisableForm,
      mfaAccountAction,
      isAdministrator,
      mustEnrollMfa,
      beginMfaSetup,
      activateTwoFactor,
      regenerateRecoveryCodes,
      disableTwoFactor,
      copyRecoveryCodes,
      downloadRecoveryCodes,
      acknowledgeRecoveryCodes,
      loadTwoFactorStatus,
      resetMfaChallenge,
      currentUser,
      currentUserAvatarUrl,
      avatarFile,
      avatarCropFile,
      avatarUploading,
      avatarUploadError,
      profileForm,
      passwordForm,
      passwordVisibility,
      passwordRequirements,
      passwordStrength,
      mustChangePassword,
      isPasswordConfirmationValid,
      isPasswordChangeReady,
      passwordChangeHelp,
      userAdminForm,
      authUserEditForm,
      editingAuthUserId,
      authUsers,
      authUserAvatarUrls,
      authRoles,
      visibleAuthRoles,
      authUsersPage,
      authUserSearch,
      generatedTemporaryPassword,
      can,
      canAny,
      canReadBusinessData,
      canUseAccount,
      canCreateUsers,
      canAdminUsers,
      canAccessSettings,
      currentUserLabel,
      currentUserDetail,
      currentUserInitials,
      authUserInitials,
      authUserAvatarUrl,
      pageTitle,
      openAccountView,
      openBilling,
      billingTab,
      viewUsesTerm,
      search,
      groupSearch,
      groupListSearch,
      musicianFilter,
      musicianFilters,
      activeMusicianFilter,
      filteredArchivedMusicians,
      sortedIndependentBands,
      sortedWorkshopBands,
      bandScheduleLabel,
      courseTimeLabel,
      personInitials,
      courseSummary,
      groupSections,
      bandMemberPreview,
      groupMemberRows,
      groupFormDirty,
      musicianFormDirty,
      musicianSheetSummary,
      toggleMusicianBand,
      setMusicianWorkshop,
      toggleGroupMember,
      pickGroup,
      startNewGroup,
      cancelGroupEdit,
      openGroupInSlots,
      selectedGroupId,
      selectedGroup,
      holidayWeekToAdd,
      preparedStudentInvoices,
      studentInvoiceDocuments,
      studentInvoiceSummaryDocument,
      teacherInvoiceRequestDocuments,
      teacherEndWeeks,
      documentHistory,
      billingStatus,
      billingError,
      dashboardTerms,
      annualDashboardTotals,
      dashboardOutflowTotal,
      dashboardSubsidyShare,
      dashboardChartScale,
      dashboardChartSummary,
      dashboardKpiTiles,
      DASHBOARD_SERIES,
      DASHBOARD_PHASE_LABELS,
      dashboardTeacherActivity,
      dashboardTeacherActivityTotals,
      dashboardBarHeight,
      wholeEuros,
      dashboardSeriesValue,
      loadBillingSummary,
      copyAnnualConfiguration,
      updateYearStatus,
      billingMoney,
      studentTotal,
      selectedImportFile,
      importAnalysis,
      importConfirmation,
      backupFiles, backupListLoaded, transferBusy, selectedRestoreFile, restoreAnalysis, restoreConfirmation,
      createBackup, loadBackups, downloadBackup, selectRestoreFile, analyzeRestore, restoreBackup,
      musicianForm,
      teacherForm,
      groupForm,
      expenseForm,
      editingMusicianId,
      editingTeacherId,
      musicianFormOpen,
      teacherFormOpen,
      editingExpenseId,
      workshopBands,
      independentBands,
      musiciansById,
      teachersById,
      coursesById,
      bandsById,
      activeMusicians,
      archivedMusicians,
      timeSlots,
      AGENDA_ROWS,
      agendaTemplateRows,
      printSlots,
      slotsHighlightedTeacher,
      slotsPrintDate,
      agendaDays,
      slotsTeacherFilter,
      slotsSelection,
      slotSelectionInfo,
      slotBandToPlaceId,
      slotsDay,
      isNarrowScreen,
      unplacedBands,
      fittingUnplacedBands,
      selectFreeSlot,
      closeSlotSelection,
      placeBand,
      newCourseAt,
      newGroupAt,
      openBandInGroups,
      groupStartOptions,
      groupStartWarning,
      courseSlotReason,
      durationLabel,
      durationMinutes,
      GROUP_DURATIONS,
      musicianRows,
      billableStudentRows,
      attendanceCourseRows,
      attendanceWorkshopRows,
      selectedHolidayWeeks,
      availableHolidayWeeks,
      toasts,
      auditEvents,
      attendanceTeacherFilterId,
      teacherRows,
      expenseRows,
      expenseTotalsByCategory,
      teacherWeeklyRows,
      teacherBillingSections,
      signatureSheetSections,
      totals,
      WEEKDAYS,
      EXPENSE_CATEGORIES,
      money,
      hoursLabel,
      formatDate,
      formatDateTime,
      categoryLabel,
      fullName,
      countPresences,
      memberCount,
      isPresent,
      attendanceStatus,
      isAttendanceLocked,
      attendanceTitle,
      attendanceDateLabel,
      isAttendanceSaving,
      toggleAttendance,
      isHolidayWeek,
      addHolidayWeek,
      removeHolidayWeek,
      saveSettings,
      resetMusicianForm,
      startNewMusician,
      editMusician,
      saveMusician,
      deleteMusician,
      restoreMusician,
      resetTeacherForm,
      startNewTeacher,
      editTeacher,
      saveTeacher,
      deleteTeacher,
      teacherUsageCount,
      teacherDeleteActionLabel,
      selectGroup,
      resetGroupForm,
      saveGroup,
      deleteGroup,
      resetExpenseForm,
      editExpense,
      saveExpense,
      deleteExpense,
      prepareAllStudentInvoices,
      prepareTeacherInvoiceRequest,
      finalizeAllStudentInvoices,
      finalizeTeacherInvoiceRequest,
      documentsForTeacher,
      draftForTeacher,
      finalizedDocumentsForTeacher,
      selectedTeacherEndWeek,
      reportTeacherAdjustment,
      deleteTeacherAdjustment,
      documentDownloadUrl,
      downloadDocument,
      documentForMusician,
      documentForTeacher,
      markDocumentSent,
      markAllStudentInvoicesSent,
      markingStudentInvoicesSent,
      studentInvoicesToSend,
      cancelFinalDocument,
      correctFinalDocument,
      documentStatusLabel,
      isSlotDisabled,
      slotTakenByOtherMusician,
      saveApiBase,
      saveProfile,
      selectAvatarFile,
      openAvatarCrop,
      cancelAvatarCrop,
      uploadAvatar,
      deleteAvatar,
      togglePasswordVisibility,
      passwordInputType,
      roleLabel,
      roleBadgeClass,
      changePassword,
      loadAuthUsers,
      loadAuthRoles,
      loadAuthAdministration,
      createAuthUser,
      toggleUserAdminRole,
      startEditAuthUser,
      cancelEditAuthUser,
      toggleAuthUserEditRole,
      saveAuthUserRoles,
      copyTemporaryPassword,
      resetUserAdminForm,
      setAuthUserActive,
      resetAuthUserPassword,
      deleteAuthUser,
      courseLabel,
      invoiceText,
      teacherRequestText,
      signatureWeekDate,
      signatureWeekNumber,
      printPage,
      exportData,
      selectImportFile,
      analyzeImport,
      importData,
      loadAuditEvents,
      auditActionLabel,
      auditUserLabel,
      countLabel,
    };
  },
  template: `
    <svg class="icon-sprite" aria-hidden="true" focusable="false">
      <symbol id="icon-edit" viewBox="0 0 24 24">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </symbol>
      <symbol id="icon-trash" viewBox="0 0 24 24">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </symbol>
      <symbol id="icon-key" viewBox="0 0 24 24">
        <circle cx="7.5" cy="14.5" r="3.5" />
        <path d="M10 12l10-10" />
        <path d="M15 7l2 2" />
        <path d="M17 5l2 2" />
      </symbol>
      <symbol id="icon-copy" viewBox="0 0 24 24">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </symbol>
      <symbol id="icon-user-check" viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M16 11l2 2 4-4" />
      </symbol>
      <symbol id="icon-user-x" viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M17 8l5 5" />
        <path d="M22 8l-5 5" />
      </symbol>
      <symbol id="icon-log-out" viewBox="0 0 24 24">
        <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
      </symbol>
      <symbol id="icon-note" viewBox="0 0 24 24">
        <path d="M9 18V5l10-2v12" />
        <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
        <circle cx="16.5" cy="15" r="2.5" fill="currentColor" />
      </symbol>
      <symbol id="icon-lock" viewBox="0 0 24 24">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </symbol>
      <symbol id="icon-arrow-right" viewBox="0 0 24 24">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </symbol>
      <symbol id="icon-chevron-left" viewBox="0 0 24 24">
        <path d="M15 6l-6 6 6 6" />
      </symbol>
      <symbol id="icon-chevron-right" viewBox="0 0 24 24">
        <path d="M9 6l6 6-6 6" />
      </symbol>
      <symbol id="icon-more" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </symbol>
      <symbol id="icon-chevron-down" viewBox="0 0 24 24">
        <path d="M7 10l5 5 5-5" />
      </symbol>
      <symbol id="icon-nav-dashboard" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </symbol>
      <symbol id="icon-nav-attendance" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4M8.5 15l2.5 2.5 4.5-5" />
      </symbol>
      <symbol id="icon-nav-signatures" viewBox="0 0 24 24">
        <path d="M4 21h16M6 17l10-10 3 3-10 10H6v-3z" />
      </symbol>
      <symbol id="icon-nav-people" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .7 3.2 2.5 3.5 5.2" />
      </symbol>
      <symbol id="icon-nav-slots" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </symbol>
      <symbol id="icon-nav-groups" viewBox="0 0 24 24">
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </symbol>
      <symbol id="icon-nav-expenses" viewBox="0 0 24 24">
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </symbol>
      <symbol id="icon-nav-billing" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </symbol>
      <symbol id="icon-nav-data-transfer" viewBox="0 0 24 24">
        <path d="M7 9l5-5 5 5M12 4v11M5 20h14" />
      </symbol>
      <symbol id="icon-nav-settings" viewBox="0 0 24 24">
        <path d="M4 6h10M4 12h4M12 12h8M4 18h12" />
        <circle cx="17" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </symbol>
      <symbol id="icon-print" viewBox="0 0 24 24">
        <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <rect x="7" y="14" width="10" height="7" rx="1" />
      </symbol>
      <symbol id="icon-check" viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </symbol>
      <symbol id="icon-x" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6L6 18" />
      </symbol>
      <symbol id="icon-warning" viewBox="0 0 24 24">
        <path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4.5M12 17h.01" />
      </symbol>
      <symbol id="icon-download" viewBox="0 0 24 24">
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </symbol>
      <symbol id="icon-shield-check" viewBox="0 0 24 24">
        <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </symbol>
      <symbol id="icon-shield-warning" viewBox="0 0 24 24">
        <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />
        <path d="M12 8v4.5M12 16h.01" />
      </symbol>
      <symbol id="icon-device-mobile" viewBox="0 0 24 24">
        <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
        <path d="M11 18h2" />
      </symbol>
    </svg>
    <main v-if="authGateActive" class="login-shell">
      <section class="login-panel" :class="{ 'password-change-panel': mustChangePassword, 'mfa-panel': mustEnrollMfa || mfaChallenge.active }" aria-labelledby="login-title">
        <div class="login-brand">
          <div class="sidebar-brand">
            <span class="sidebar-mark" aria-hidden="true"><svg><use href="#icon-note"></use></svg></span>
            <span class="wordmark">Compta <em>Zik</em></span>
          </div>
          <div>
            <p class="eyebrow">Comptabilité activité musique</p>
            <h1 id="login-title">{{ authGateTitle }}</h1>
          </div>
        </div>
        <div v-if="authFlowPending" class="auth-pending" role="status">
          <span class="loading-ring" aria-hidden="true"></span>
          <p>Contrôle des paramètres de sécurité du compte…</p>
        </div>
        <section v-else-if="mfaRecoveryCodes.length" class="mfa-recovery-screen">
          <div class="security-callout warning">
            <svg class="icon" aria-hidden="true"><use href="#icon-warning"></use></svg>
            <div>
              <strong>Enregistrez ces codes maintenant</strong>
              <p>Ils ne seront plus affichés. Chaque code permet une connexion si votre application d’authentification est indisponible.</p>
            </div>
          </div>
          <ol class="recovery-code-grid" aria-label="Codes de récupération">
            <li v-for="code in mfaRecoveryCodes" :key="code"><code>{{ code }}</code></li>
          </ol>
          <div class="mfa-actions">
            <button class="ghost-button" type="button" @click="copyRecoveryCodes"><svg class="icon" aria-hidden="true"><use href="#icon-copy"></use></svg> Copier</button>
            <button class="ghost-button" type="button" @click="downloadRecoveryCodes"><svg class="icon" aria-hidden="true"><use href="#icon-download"></use></svg> Télécharger</button>
            <button class="primary-button" type="button" @click="acknowledgeRecoveryCodes">J’ai enregistré les codes</button>
          </div>
        </section>
        <section v-else-if="mustEnrollMfa" class="mfa-enrollment">
          <div class="security-callout">
            <svg class="icon" aria-hidden="true"><use href="#icon-shield-check"></use></svg>
            <div>
              <strong>Protection obligatoire pour les administrateurs</strong>
              <p>Associez ce compte à une application TOTP avant d’accéder aux données comptables.</p>
            </div>
          </div>
          <div v-if="twoFactorStatus === null" class="mfa-status-unavailable">
            <p>{{ loginError || 'Vérification de la configuration 2FA impossible.' }}</p>
            <div class="mfa-actions">
              <button class="primary-button" type="button" :disabled="twoFactorLoading" @click="loadTwoFactorStatus">Réessayer</button>
              <button class="ghost-button" type="button" @click="logout">Se déconnecter</button>
            </div>
          </div>
          <form v-else-if="!mfaSetup" class="login-form" @submit.prevent="beginMfaSetup">
            <label>
              Confirmez votre mot de passe
              <input v-model="mfaSetupForm.password" type="password" autocomplete="current-password" autofocus />
            </label>
            <div class="mfa-actions">
              <button class="primary-button" type="submit" :disabled="twoFactorLoading">{{ twoFactorLoading ? 'Préparation…' : 'Générer mon QR code' }}</button>
              <button class="ghost-button" type="button" @click="logout">Se déconnecter</button>
            </div>
          </form>
          <form v-else class="mfa-enrollment-grid" @submit.prevent="activateTwoFactor">
            <div class="mfa-qr" v-html="mfaQrSvg" aria-label="QR code TOTP"></div>
            <div class="mfa-steps">
              <ol>
                <li>Scannez le QR code avec votre application d’authentification.</li>
                <li>Saisissez le code à six chiffres affiché.</li>
                <li>Conservez ensuite les codes de récupération.</li>
              </ol>
              <details>
                <summary>Saisie manuelle</summary>
                <code class="mfa-secret">{{ mfaSetup.secret }}</code>
              </details>
              <totp-code-input
                v-model="mfaSetupDigits"
                label="Code de vérification"
                :error="Boolean(mfaSetupError)"
                autofocus
              ></totp-code-input>
              <p v-if="mfaSetupError" class="form-warning">{{ mfaSetupError }}</p>
              <div class="mfa-actions">
                <button class="primary-button" type="submit" :disabled="twoFactorLoading || !mfaSetupCodeComplete">{{ twoFactorLoading ? 'Activation…' : 'Activer la double authentification' }}</button>
                <button class="ghost-button" type="button" @click="mfaSetup = null">Recommencer</button>
              </div>
            </div>
          </form>
        </section>
        <form v-if="!authFlowPending && !mfaRecoveryCodes.length && !mustEnrollMfa && mfaChallenge.active" class="login-form mfa-challenge-form" @submit.prevent="verifyMfaLogin">
          <div class="security-callout">
            <svg class="icon" aria-hidden="true"><use href="#icon-device-mobile"></use></svg>
            <div>
              <strong>Deuxième étape de connexion</strong>
              <p>Saisissez le code de votre application d’authentification ou un code de récupération.</p>
            </div>
          </div>
          <totp-code-input
            v-if="mfaLoginMode === 'totp'"
            v-model="mfaLoginDigits"
            label="Code de sécurité"
            :error="Boolean(mfaLoginError)"
            autofocus
          ></totp-code-input>
          <label v-else>
            Code de récupération
            <input v-model="mfaChallenge.code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" autofocus @input="mfaLoginError = ''" />
          </label>
          <button class="mfa-mode-toggle" type="button" @click="setMfaLoginMode(mfaLoginMode === 'totp' ? 'recovery' : 'totp')">
            {{ mfaLoginMode === 'totp' ? 'Utiliser un code de récupération' : 'Utiliser un code à six chiffres' }}
          </button>
          <p v-if="mfaLoginError" class="form-warning">{{ mfaLoginError }}</p>
          <button class="primary-button login-submit" type="submit" :disabled="authLoading || !mfaLoginCodeComplete">{{ authLoading ? 'Vérification…' : 'Valider la connexion' }}</button>
          <button class="ghost-button" type="button" @click="resetMfaChallenge">Utiliser un autre compte</button>
        </form>
        <form v-if="!authFlowPending && !mfaRecoveryCodes.length && !mustEnrollMfa && !mfaChallenge.active && !mustChangePassword" class="login-form" @submit.prevent="login">
          <label>
            Identifiant
            <input v-model="loginForm.username" autocomplete="username" autofocus />
          </label>
          <label>
            Mot de passe
            <input v-model="loginForm.password" type="password" autocomplete="current-password" />
          </label>
          <label class="check-label login-remember">
            <input v-model="loginForm.rememberMe" type="checkbox" />
            <span>Conserver la session</span>
          </label>
          <p v-if="loginError" class="form-warning">{{ loginError }}</p>
          <button class="primary-button login-submit" type="submit" :disabled="authLoading">
            {{ authLoading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>
        <form v-if="!authFlowPending && mustChangePassword" class="login-form forced-password-form" @submit.prevent="changePassword">
          <p class="form-warning password-required-note">Ce compte utilise un mot de passe temporaire. Choisis un nouveau mot de passe pour accéder à Compta Zik.</p>
          <div class="password-grid login-password-grid">
            <label>
              Mot de passe actuel
              <span class="password-input-wrap">
                <input
                  v-model="passwordForm.currentPassword"
                  :type="passwordInputType('currentPassword')"
                  autocomplete="current-password"
                  autofocus
                />
                <button
                  type="button"
                  class="password-eye"
                  :class="{ active: passwordVisibility.currentPassword }"
                  :aria-label="passwordVisibility.currentPassword ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'"
                  @click="togglePasswordVisibility('currentPassword')"
                >
                  <span class="eye-icon" aria-hidden="true"></span>
                </button>
              </span>
            </label>
            <label>
              Nouveau mot de passe
              <span class="password-input-wrap">
                <input
                  v-model="passwordForm.newPassword"
                  :type="passwordInputType('newPassword')"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="password-eye"
                  :class="{ active: passwordVisibility.newPassword }"
                  :aria-label="passwordVisibility.newPassword ? 'Masquer le nouveau mot de passe' : 'Afficher le nouveau mot de passe'"
                  @click="togglePasswordVisibility('newPassword')"
                >
                  <span class="eye-icon" aria-hidden="true"></span>
                </button>
              </span>
            </label>
            <label>
              Confirmation
              <span class="password-input-wrap">
                <input
                  v-model="passwordForm.confirmPassword"
                  :type="passwordInputType('confirmPassword')"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="password-eye"
                  :class="{ active: passwordVisibility.confirmPassword }"
                  :aria-label="passwordVisibility.confirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'"
                  @click="togglePasswordVisibility('confirmPassword')"
                >
                  <span class="eye-icon" aria-hidden="true"></span>
                </button>
              </span>
            </label>
            <div class="password-strength" aria-live="polite">
              <div class="password-strength-head">
                <span>Contraintes du mot de passe</span>
                <strong>{{ passwordStrength }}/5</strong>
              </div>
              <div class="password-bars" role="meter" aria-label="Contraintes du mot de passe" aria-valuemin="0" aria-valuemax="5" :aria-valuenow="passwordStrength">
                <span
                  v-for="(rule, index) in passwordRequirements"
                  :key="rule.key"
                  :class="{ active: index < passwordStrength }"
                  :title="rule.label"
                ></span>
              </div>
              <small>{{ passwordStrength === 5 ? 'Toutes les contraintes sont remplies' : passwordRequirements.filter(rule => !rule.valid).map(rule => rule.label).join(' - ') }}</small>
            </div>
            <div
              class="password-confirmation"
              :class="{ valid: isPasswordConfirmationValid, empty: !passwordForm.confirmPassword }"
            >
              <span class="rule-icon">{{ isPasswordConfirmationValid ? '✓' : '' }}</span>
              {{ passwordForm.confirmPassword ? 'Confirmation identique' : 'Confirmez le nouveau mot de passe' }}
            </div>
          </div>
          <div class="login-password-actions">
            <button class="primary-button login-submit" type="submit" :disabled="!isPasswordChangeReady" :title="isPasswordChangeReady ? '' : passwordChangeHelp">Changer le mot de passe</button>
            <button class="ghost-button" type="button" @click="logout">Se déconnecter</button>
          </div>
        </form>
        <div v-if="!isAuthenticated && !mfaChallenge.active" class="api-form login-api">
          <input v-model="apiBase" aria-label="Base API" />
          <input type="number" v-model.number="accountingYearInput" min="2000" max="2100" aria-label="Année" />
          <button @click="saveApiBase">Appliquer</button>
        </div>
      </section>
      <div class="toast-stack" aria-live="polite">
        <div v-for="toast in toasts" :key="toast.id" :class="['toast', toast.type]">
          <span class="toast-badge" aria-hidden="true"><svg><use :href="toast.type === 'success' ? '#icon-check' : toast.type === 'error' ? '#icon-x' : '#icon-warning'"></use></svg></span>
          <span>{{ toast.message }}</span>
        </div>
      </div>
    </main>
    <main v-else :class="['shell', { 'menu-open': mobileMenuOpen }]">
      <aside id="app-menu" class="sidebar" @keydown.esc="mobileMenuOpen = false">
        <button type="button" class="sidebar-close" aria-label="Fermer le menu" @click="mobileMenuOpen = false">
          <svg aria-hidden="true"><use href="#icon-x"></use></svg>
        </button>
        <div class="sidebar-brand">
          <span class="sidebar-mark" aria-hidden="true"><svg><use href="#icon-note"></use></svg></span>
          <span class="wordmark">Compta <em>Zik</em></span>
        </div>
        <div v-if="!mustChangePassword" class="season-picker" @keydown.esc="seasonPickerOpen = false">
          <button type="button" class="season-button" :aria-expanded="seasonPickerOpen ? 'true' : 'false'" aria-controls="season-panel" @click="seasonPickerOpen = !seasonPickerOpen">
            <span class="season-copy"><small>Saison</small><strong>{{ state.settings.year }}</strong></span>
            <span class="season-meta">
              <span :class="['year-pill', yearStatus.toLowerCase()]">{{ yearStatusLabel }}</span>
              <svg aria-hidden="true"><use href="#icon-chevron-down"></use></svg>
            </span>
          </button>
          <form v-if="seasonPickerOpen" id="season-panel" class="season-panel" @submit.prevent="switchSeason">
            <label>Changer de saison
              <input type="number" v-model.number="accountingYearInput" min="2000" max="2100" />
            </label>
            <button type="submit" class="primary-button">Charger</button>
          </form>
        </div>
        <nav class="nav" aria-label="Navigation principale">
          <div v-for="group in navGroups" :key="group.label" class="nav-group">
            <span class="nav-group-label">{{ group.label }}</span>
            <button
              v-for="item in group.items"
              :key="item.view"
              type="button"
              :class="{ active: activeView === item.view }"
              :aria-current="activeView === item.view ? 'page' : null"
              @click="openNavView(item.view)"
            >
              <svg aria-hidden="true"><use :href="'#icon-nav-' + item.view"></use></svg>
              {{ item.label }}
            </button>
          </div>
        </nav>
        <div class="user-box">
          <component
            :is="canUseAccount ? 'button' : 'div'"
            :type="canUseAccount ? 'button' : null"
            :class="['user-identity', { active: activeView === 'account' }]"
            :aria-current="activeView === 'account' ? 'page' : null"
            :title="canUseAccount ? 'Mon compte' : null"
            @click="canUseAccount && openAccountView()"
          >
            <span class="user-avatar-wrap">
              <img v-if="currentUserAvatarUrl" class="user-avatar image" :src="currentUserAvatarUrl" alt="" />
              <span v-else class="user-avatar" aria-hidden="true">{{ currentUserInitials }}</span>
              <span :class="['status', 'avatar-status', apiStatus === 'connecté' ? 'ok' : 'demo']"></span>
            </span>
            <span class="user-copy">
              <strong>{{ currentUserLabel }}</strong>
              <small v-if="currentUserDetail">{{ currentUserDetail }}</small>
            </span>
          </component>
          <button type="button" class="sidebar-icon-button" @click="logout" aria-label="Se déconnecter" title="Se déconnecter">
            <svg aria-hidden="true"><use href="#icon-log-out"></use></svg>
          </button>
        </div>
      </aside>

      <section class="content">
        <div class="mobile-header">
          <span class="wordmark">Compta <em>Zik</em></span>
          <button type="button" class="mobile-avatar" :aria-label="canUseAccount ? 'Mon compte' : 'Ouvrir le menu'" @click="canUseAccount ? openAccountView() : (mobileMenuOpen = true)">
            <img v-if="currentUserAvatarUrl" :src="currentUserAvatarUrl" alt="" />
            <span v-else aria-hidden="true">{{ currentUserInitials }}</span>
          </button>
        </div>
        <header class="topbar">
          <div class="topbar-title">
            <p v-if="activeView === 'dashboard'" class="eyebrow">Situation consolidée au {{ dashboardDateLabel }}</p>
            <p v-else-if="viewUsesTerm && termEyebrow" class="eyebrow">{{ termEyebrow }}</p>
            <p v-else class="eyebrow">Comptabilité activité musique</p>
            <h1>{{ pageTitle }}</h1>
          </div>
          <div class="topbar-actions">
            <span v-if="activeView === 'attendance' && can('PRESENCE_WRITE')" :class="['save-indicator', { saving: attendanceSaving }]" role="status">
              {{ attendanceSaving ? 'Enregistrement…' : 'Enregistré automatiquement' }}
            </span>
            <div v-if="viewUsesTerm && dashboardTerms.length" class="segmented" role="group" aria-label="Trimestre">
              <button
                v-for="term in dashboardTerms"
                :key="term.id"
                type="button"
                :aria-pressed="term.selected ? 'true' : 'false'"
                @click="selectedTermId = term.id"
              >
                {{ term.name }}
                <span v-if="term.phase === 'current'" class="segmented-dot" aria-hidden="true"></span>
                <span v-if="term.phase === 'current'" class="visually-hidden">(en cours)</span>
              </button>
            </div>
            <div v-else-if="viewUsesTerm" class="term-control">
              <label for="term">Période</label>
              <select id="term" v-model="selectedTermId">
                <option v-for="term in state.settings.terms" :key="term.id" :value="term.id">
                  {{ term.name }}{{ term.id === automaticTerm?.id ? ' — automatique' : '' }}
                </option>
              </select>
            </div>
            <button
              v-if="activeView === 'dashboard' && canAny(['BILLING_READ', 'BILLING_PRINT'])"
              type="button"
              class="primary-button billing-review-button"
              @click="openBilling('providers')"
            >
              Préparer la facturation {{ selectedTerm?.name }}
              <svg aria-hidden="true"><use href="#icon-arrow-right"></use></svg>
            </button>
          </div>
        </header>

        <section v-if="activeView === 'dashboard' && !mustChangePassword" class="view-stack dashboard-view">
          <div v-if="billingStatus !== 'ready'" class="billing-state" :class="{ error: billingStatus === 'error' }" role="status">
            <span>{{ billingStatus === 'loading' ? 'Calcul comptable en cours…' : (billingError || 'Connectez le backend pour charger les montants comptables.') }}</span>
            <button v-if="billingStatus === 'error'" class="ghost-button" @click="loadBillingSummary">Réessayer</button>
          </div>

          <section class="kpi-tiles" aria-label="Totaux annuels">
            <article v-for="tile in dashboardKpiTiles" :key="tile.key" :class="['kpi-tile', { emphasis: tile.emphasis }]">
              <div class="kpi-tile-copy">
                <span>{{ tile.label }}</span>
                <strong>{{ tile.value }}</strong>
                <small>{{ tile.detail }}</small>
              </div>
              <div v-if="tile.available" class="kpi-mini-bars" aria-hidden="true">
                <span v-for="bar in tile.bars" :key="bar.id" :class="bar.phase" :style="{ height: bar.height + 'px' }"></span>
              </div>
            </article>
          </section>

          <div class="dashboard-grid">
            <section class="panel chart-panel" aria-labelledby="chart-title">
              <div class="chart-heading">
                <div>
                  <h2 id="chart-title">Évolution par trimestre</h2>
                  <span>Chaque trimestre, un mouvement</span>
                </div>
                <div class="chart-legend" aria-hidden="true">
                  <span v-for="series in DASHBOARD_SERIES" :key="series.key"><i :class="series.className"></i>{{ series.label }}</span>
                </div>
              </div>
              <div class="staff-chart" role="img" :aria-label="'Montants par trimestre. ' + dashboardChartSummary">
                <div class="staff-axis">
                  <span v-for="(tick, index) in dashboardChartScale.ticks" :key="tick" :style="{ '--i': index }">{{ wholeEuros(tick) }}</span>
                </div>
                <div class="staff-plot">
                  <div class="staff-lines"><i v-for="line in 5" :key="line"></i></div>
                  <div class="staff-groups" :style="{ gridTemplateColumns: 'repeat(' + dashboardTerms.length + ', minmax(0, 1fr))' }">
                    <div v-for="term in dashboardTerms" :key="term.id" :class="['staff-group', { current: term.phase === 'current' }]">
                      <div v-for="series in DASHBOARD_SERIES" :key="series.key" class="staff-bar">
                        <span class="staff-value">{{ dashboardSeriesValue(term, series) === null ? '' : wholeEuros(dashboardSeriesValue(term, series)) }}</span>
                        <span :class="['staff-fill', series.className]" :style="{ height: dashboardBarHeight(dashboardSeriesValue(term, series)) }"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="staff-terms" :style="{ '--terms': dashboardTerms.length, gridTemplateColumns: '52px repeat(' + dashboardTerms.length + ', minmax(0, 1fr))' }">
                <span></span>
                <div v-for="term in dashboardTerms" :key="term.id" class="staff-term">
                  <strong>{{ term.name }}</strong>
                  <span>S{{ term.startWeek }} → S{{ term.endWeek }}</span>
                  <em :class="term.phase">{{ DASHBOARD_PHASE_LABELS[term.phase] }}</em>
                </div>
              </div>
            </section>

            <section class="panel outflow-panel" aria-labelledby="outflow-title">
              <div>
                <h2 id="outflow-title">Répartition des sorties</h2>
                <span class="panel-subtitle">Cumul annuel à ce jour</span>
              </div>
              <div class="outflow-total">
                <strong>{{ billingMoney(dashboardOutflowTotal) }}</strong>
                <span>Total des sorties</span>
              </div>
              <div v-if="billingStatus === 'ready'" class="outflow-bar" role="img" :aria-label="'Subvention ' + dashboardSubsidyShare.toFixed(0) + ' %, dépenses ' + (dashboardOutflowTotal > 0 ? 100 - dashboardSubsidyShare : 0).toFixed(0) + ' %'">
                <span v-if="dashboardSubsidyShare > 0" class="subsidy" :style="{ width: dashboardSubsidyShare + '%' }"></span>
                <span v-if="dashboardOutflowTotal > 0 && dashboardSubsidyShare < 100" class="expenses" :style="{ width: (100 - dashboardSubsidyShare) + '%' }"></span>
              </div>
              <div class="outflow-list">
                <div>
                  <span><i class="subsidy"></i>Subvention calculée</span>
                  <span><strong>{{ billingMoney(annualDashboardTotals.subsidy) }}</strong><span v-if="billingStatus === 'ready'" class="muted"> · {{ dashboardSubsidyShare.toFixed(0) }} %</span></span>
                </div>
                <div>
                  <span><i class="expenses"></i>Dépenses</span>
                  <span><strong>{{ money(annualDashboardTotals.expenses) }}</strong><span v-if="billingStatus === 'ready'" class="muted"> · {{ (dashboardOutflowTotal > 0 ? 100 - dashboardSubsidyShare : 0).toFixed(0) }} %</span></span>
                </div>
              </div>
            </section>
          </div>

          <section class="panel provider-activity-panel" aria-labelledby="provider-activity-title">
            <div class="provider-activity-heading">
              <div>
                <span class="section-kicker">{{ selectedTerm?.name }} · semaines {{ selectedTerm?.startWeek }} à {{ selectedTerm?.endWeek }}</span>
                <h2 id="provider-activity-title">Activité des prestataires</h2>
              </div>
              <dl class="provider-activity-totals">
                <div><dt>Heures données</dt><dd>{{ hoursLabel(dashboardTeacherActivityTotals.hours) }}</dd></div>
                <div><dt>Déjà facturé</dt><dd>{{ billingMoney(dashboardTeacherActivityTotals.issued) }}</dd></div>
                <div class="remaining"><dt>À facturer</dt><dd>{{ billingMoney(dashboardTeacherActivityTotals.remaining) }}</dd></div>
              </dl>
            </div>

            <table v-if="dashboardTeacherActivity.length" class="provider-table">
              <thead>
                <tr>
                  <th scope="col">Prestataire</th>
                  <th scope="col" class="num">Heures</th>
                  <th scope="col" class="num">Déjà facturé</th>
                  <th scope="col" class="num">À facturer</th>
                  <th scope="col" class="progress-col">Avancement</th>
                  <th scope="col"><span class="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(activity, index) in dashboardTeacherActivity" :key="activity.teacherId">
                  <td data-label="Prestataire">
                    <span class="provider-identity">
                      <span :class="['provider-avatar', { alt: index % 2 === 1 }]" aria-hidden="true">{{ activity.teacher.firstName?.charAt(0) }}{{ activity.teacher.lastName?.charAt(0) }}</span>
                      <span><strong>{{ fullName(activity.teacher) }}</strong><small>{{ activity.teacher.instrument || 'Prestataire' }}</small></span>
                    </span>
                  </td>
                  <td class="num" data-label="Heures">{{ hoursLabel(activity.totalHours) }}</td>
                  <td class="num" data-label="Déjà facturé">{{ billingMoney(activity.issuedAmount) }}</td>
                  <td class="num remaining" data-label="À facturer">{{ billingMoney(activity.remainingAmount) }}</td>
                  <td data-label="Avancement">
                    <span class="provider-progress">
                      <span class="provider-progress-track" role="progressbar" :aria-label="'Facturation de ' + fullName(activity.teacher)" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="activity.issuedPercent.toFixed(0)">
                        <i :style="{ width: activity.issuedPercent + '%' }"></i>
                      </span>
                      <strong>{{ activity.issuedPercent.toFixed(0) }} %</strong>
                    </span>
                  </td>
                  <td class="action">
                    <button v-if="canAny(['BILLING_READ', 'BILLING_PRINT'])" type="button" class="link-button" @click="openBilling('providers')">Facturer</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="provider-activity-empty">
              <strong>Aucune heure enregistrée</strong>
              <span>Les heures réalisées par les prestataires apparaîtront ici.</span>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'attendance' && !mustChangePassword && can('PRESENCE_READ')" class="view-stack attendance-view">
          <div class="attendance-toolbar">
            <label class="attendance-teacher-filter">
              <span class="visually-hidden">Professeur</span>
              <select v-model="attendanceTeacherFilterId" aria-label="Filtrer les présences par professeur">
                <option value="">Tous les professeurs</option>
                <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ fullName(teacher) }}</option>
              </select>
            </label>
            <ul class="attendance-legend" aria-label="Légende des présences">
              <li><span class="att-glyph present" aria-hidden="true"></span>Présent</li>
              <li><span class="att-glyph absent" aria-hidden="true"></span>Absent</li>
              <li><span class="att-glyph cancelled" aria-hidden="true"></span>Annulé</li>
              <li><span class="att-glyph unrecorded" aria-hidden="true"></span>Non renseigné</li>
              <li><span class="legend-hatch" aria-hidden="true"></span>Vacances (saisie possible)</li>
              <li><svg class="att-lock" aria-hidden="true"><use href="#icon-lock"></use></svg>Facturée</li>
            </ul>
            <span v-if="can('PRESENCE_WRITE')" class="attendance-hint">Un clic fait défiler : présent → absent → annulé</span>
          </div>

          <section class="attendance-card" aria-label="Grille des présences du trimestre">
            <div v-if="attendanceGroups.length" class="attendance-scroll">
              <table class="attendance-grid" :style="{ '--weeks': weeks.length }">
                <colgroup>
                  <col class="col-session" />
                  <col v-for="week in weeks" :key="week" />
                  <col class="col-total" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" class="session-head">Séance</th>
                    <th
                      v-for="week in weeks"
                      :key="week"
                      scope="col"
                      :class="['week-head', { current: week === currentAttendanceWeek, holiday: isHolidayWeek(week) }]"
                      :title="isHolidayWeek(week) ? 'Semaine ' + week + ' · vacances' : 'Semaine ' + week"
                    >
                      <span class="visually-hidden">Semaine </span>{{ week === currentAttendanceWeek ? 'S' + week : week }}
                    </th>
                    <th scope="col" class="total-head">Total</th>
                  </tr>
                </thead>
                <tbody v-for="group in attendanceGroups" :key="group.key">
                  <tr class="attendance-group-row">
                    <th :colspan="weeks.length + 2" scope="colgroup">
                      <strong>{{ group.title }}</strong>
                      <span>{{ group.subtitle }}</span>
                    </th>
                  </tr>
                  <tr v-for="row in group.rows" :key="row.key" class="attendance-row">
                    <th scope="row" class="session-cell">
                      <span class="session-time">{{ row.time }}</span>
                      <span class="session-copy">
                        <strong>{{ row.name }}</strong>
                        <span>{{ row.detail }}</span>
                      </span>
                    </th>
                    <td
                      v-for="week in weeks"
                      :key="week"
                      :class="['att-cell', { current: week === currentAttendanceWeek, holiday: isHolidayWeek(week) }]"
                    >
                      <button
                        type="button"
                        :class="['att-button', { locked: isAttendanceLocked(row.entityType, row.entityId, week), saving: isAttendanceSaving(row.entityType, row.entityId, week) }]"
                        :disabled="!can('PRESENCE_WRITE') || isAttendanceSaving(row.entityType, row.entityId, week) || isAttendanceLocked(row.entityType, row.entityId, week)"
                        :aria-label="attendanceCellLabel(row, week)"
                        :title="attendanceCellTitle(row, week)"
                        @click="toggleAttendance(row.entityType, row.entityId, week)"
                      >
                        <span :class="['att-glyph', attendanceStatus(row.entityType, row.entityId, week).toLowerCase()]" aria-hidden="true"></span>
                        <svg v-if="isAttendanceLocked(row.entityType, row.entityId, week)" class="att-lock" aria-hidden="true"><use href="#icon-lock"></use></svg>
                      </button>
                    </td>
                    <td class="total-cell">
                      <strong>{{ row.count }}</strong>
                      <span>{{ row.count > 1 ? 'séances' : 'séance' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="attendance-empty">
              <strong>Aucune séance à afficher</strong>
              <span>{{ attendanceTeacherFilterId ? 'Ce professeur n’a ni cours ni atelier sur le trimestre.' : 'Ajoutez des cours individuels ou des ateliers pour remplir la grille.' }}</span>
            </div>
            <footer v-if="attendanceGroups.length" class="attendance-footer">
              <span v-if="attendanceWeekSummary">
                Semaine {{ attendanceWeekSummary.week }} ·
                <strong>{{ countLabel(attendanceWeekSummary.PRESENT, 'présent') }}</strong> ·
                {{ countLabel(attendanceWeekSummary.ABSENT, 'absent') }} ·
                {{ attendanceWeekSummary.UNRECORDED }} à renseigner
              </span>
              <span v-else></span>
              <span class="attendance-total">
                Séances présentes du trimestre
                <strong>{{ attendanceTotalPresent }}</strong>
              </span>
            </footer>
          </section>
        </section>

        <section v-if="activeView === 'signatures' && !mustChangePassword && can('PRESENCE_READ')" class="view-stack printable-view">
          <section v-if="dayEntryWeekValue" class="day-entry" aria-label="Émargement du jour">
            <div class="day-entry-week">
              <button type="button" class="day-entry-arrow" aria-label="Semaine précédente" :disabled="weeks.indexOf(dayEntryWeekValue) <= 0" @click="shiftDayEntryWeek(-1)">
                <svg aria-hidden="true"><use href="#icon-chevron-left"></use></svg>
              </button>
              <span class="day-entry-week-label">
                <strong>Semaine {{ dayEntryWeekValue }}</strong>
                <span>{{ dayEntryWeekLabel }}</span>
              </span>
              <button type="button" class="day-entry-arrow" aria-label="Semaine suivante" :disabled="weeks.indexOf(dayEntryWeekValue) >= weeks.length - 1" @click="shiftDayEntryWeek(1)">
                <svg aria-hidden="true"><use href="#icon-chevron-right"></use></svg>
              </button>
            </div>
            <div class="day-entry-days" role="group" aria-label="Jour">
              <button
                v-for="day in dayEntryDays"
                :key="day.name"
                type="button"
                :aria-pressed="day.name === dayEntryDayValue ? 'true' : 'false'"
                :aria-label="day.name + ' ' + day.number + (day.pending ? ', séances à renseigner' : '')"
                @click="dayEntryDay = day.name"
              >
                <span>{{ day.short }}</span>
                <strong>{{ day.number }}</strong>
                <i v-if="day.pending" class="day-pending-dot" aria-hidden="true"></i>
              </button>
            </div>
            <div class="day-entry-title">
              <h2>{{ dayEntryTitle }}</h2>
              <span>{{ countLabel(dayEntrySessions.length, 'séance') }}</span>
            </div>
            <p v-if="isHolidayWeek(dayEntryWeekValue)" class="day-entry-note">Semaine de vacances : la saisie reste possible.</p>
            <article
              v-for="session in dayEntrySessions"
              :key="session.key"
              :class="['day-card', { pending: attendanceStatus(session.entityType, session.entityId, dayEntryWeekValue) === 'UNRECORDED' }]"
            >
              <div class="day-card-head">
                <span class="day-card-time">{{ session.time }}</span>
                <span class="day-card-copy">
                  <strong>{{ session.name }}</strong>
                  <span>{{ session.detail }}</span>
                </span>
                <span v-if="isAttendanceLocked(session.entityType, session.entityId, dayEntryWeekValue)" class="day-card-pill locked" :title="attendanceTitle(session.entityType, session.entityId, dayEntryWeekValue)">
                  <svg class="att-lock" aria-hidden="true"><use href="#icon-lock"></use></svg>Facturée
                </span>
                <span v-else-if="attendanceStatus(session.entityType, session.entityId, dayEntryWeekValue) === 'UNRECORDED'" class="day-card-pill">À renseigner</span>
              </div>
              <div class="day-card-choices" role="group" :aria-label="'Présence : ' + session.name">
                <button
                  v-for="choice in DAY_ENTRY_CHOICES"
                  :key="choice.value"
                  type="button"
                  :class="['day-choice', choice.value.toLowerCase()]"
                  :aria-pressed="attendanceStatus(session.entityType, session.entityId, dayEntryWeekValue) === choice.value ? 'true' : 'false'"
                  :disabled="!can('PRESENCE_WRITE') || isAttendanceLocked(session.entityType, session.entityId, dayEntryWeekValue) || isAttendanceSaving(session.entityType, session.entityId, dayEntryWeekValue)"
                  @click="setAttendanceStatus(session.entityType, session.entityId, dayEntryWeekValue, choice.value)"
                >{{ choice.label }}</button>
              </div>
            </article>
            <p v-if="!dayEntrySessions.length" class="day-entry-empty">Aucune séance ce jour-là.</p>
            <div v-if="dayEntrySessions.length" class="day-entry-footer">
              <span><strong>{{ dayEntryRecorded }} sur {{ dayEntrySessions.length }}</strong> séances renseignées</span>
              <span v-if="can('PRESENCE_WRITE')" :class="['save-indicator', { saving: attendanceSaving }]" role="status">
                {{ attendanceSaving ? 'Enregistrement…' : 'Enregistré automatiquement' }}
              </span>
            </div>
          </section>
          <section class="panel signature-page">
            <div class="panel-head">
              <div>
                <h2>Feuilles d'émargement</h2>
                <span>{{ selectedTerm.name }} {{ state.settings.year }} - une feuille par professeur</span>
              </div>
              <button class="primary-button no-print" @click="printPage">
                <svg aria-hidden="true"><use href="#icon-print"></use></svg>
                Imprimer
              </button>
            </div>

            <div v-if="signatureSheetSections.length" class="signature-stack">
              <article v-for="section in signatureSheetSections" :key="section.teacher.id" class="signature-sheet">
                <div class="signature-head">
                  <div>
                    <h3>{{ fullName(section.teacher) }}</h3>
                    <span>{{ section.teacher.instrument }}</span>
                  </div>
                  <strong>{{ selectedTerm.name }} · {{ state.settings.year }}</strong>
                </div>
                <div class="signature-table-wrap">
                  <table class="signature-table" :style="{ '--weeks': weeks.length }">
                    <thead>
                      <tr>
                        <th class="signature-week-col">Semaine</th>
                        <th v-for="item in section.columns" :key="item.key" :class="{ 'workshop-signature-col': item.type === 'workshop' }">
                          <template v-if="item.type === 'individual'">
                            <span>{{ item.course.weekday }} {{ item.course.startTime }}</span>
                            <strong>{{ fullName(item.musician) }}</strong>
                            <small>{{ item.course.instrument }}</small>
                          </template>
                          <template v-else>
                            <span>{{ item.band.weekday || 'Groupe' }}</span>
                            <strong>{{ item.band.name }}</strong>
                            <small class="signature-kind">Atelier</small>
                          </template>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="week in weeks" :key="week">
                        <th scope="row" :class="{ holiday: isHolidayWeek(week) }">
                          <span>{{ signatureWeekDate(week) }}</span>
                          <small>{{ signatureWeekNumber(week) }}</small>
                        </th>
                        <td v-for="item in section.columns" :key="item.key + '-' + week" :class="['signature-cell', { holiday: isHolidayWeek(week), workshop: item.type === 'workshop' }]">
                          <span v-if="isHolidayWeek(week)">Vacances</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
            <p v-else class="empty-state">Aucun cours individuel à émarger pour cette période.</p>
          </section>
        </section>

        <section v-if="activeView === 'slots' && !mustChangePassword && canAny(['MUSICIENS_READ', 'MUSICIENS_WRITE'])" class="view-stack slots-view">
          <header class="slots-print-head" aria-hidden="true">
            <div>
              <h1>Planning de la salle</h1>
              <span>Année {{ state.settings.year }}<template v-if="slotsPrintDate"> · imprimé le {{ slotsPrintDate }}</template></span>
            </div>
            <span v-if="slotsHighlightedTeacher">Mis en avant : {{ fullName(slotsHighlightedTeacher) }}</span>
          </header>
          <div class="slots-toolbar">
            <label class="slots-teacher-filter no-print">
              <span class="visually-hidden">Professeur</span>
              <select v-model="slotsTeacherFilter" aria-label="Mettre en avant les réservations d’un professeur">
                <option value="">Tous les professeurs</option>
                <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ fullName(teacher) }}</option>
              </select>
            </label>
            <ul class="slots-legend" aria-label="Légende du planning">
              <li><span class="slot-swatch course" aria-hidden="true"></span>Cours · {{ durationLabel(durationMinutes(state.settings, 'course')) }}</li>
              <li><span class="slot-swatch workshop" aria-hidden="true"></span>Atelier · {{ durationLabel(durationMinutes(state.settings, 'workshop')) }}</li>
              <li><span class="slot-swatch group" aria-hidden="true"></span>Groupe · 1 h 15 ou 1 h 30</li>
              <li><span class="slot-swatch free" aria-hidden="true"></span>Libre</li>
            </ul>
            <span class="slots-hint no-print">Salle unique · 11:30–14:00 et 16:30–20:00 · cliquez sur un créneau libre pour l’allouer</span>
            <button type="button" class="ghost-button no-print slots-print" @click="printSlots">
              <svg aria-hidden="true"><use href="#icon-print"></use></svg>
              Imprimer
            </button>
          </div>

          <div v-if="isNarrowScreen" class="segmented slots-days no-print" role="group" aria-label="Jour affiché">
            <button
              v-for="day in WEEKDAYS"
              :key="day"
              type="button"
              :aria-pressed="slotsDay === day ? 'true' : 'false'"
              @click="slotsDay = day"
            >{{ day.slice(0, 3) }}</button>
          </div>

          <div class="slots-layout">
            <section class="agenda-card" aria-label="Planning hebdomadaire de la salle">
              <div class="agenda" :style="{ gridTemplateColumns: '56px repeat(' + agendaDays.length + ', minmax(0, 1fr))', gridTemplateRows: agendaTemplateRows }">
                <div
                  v-for="(day, index) in agendaDays"
                  :key="'head-' + day.name"
                  :class="['agenda-day-head', { today: day.isToday }]"
                  :style="{ gridRow: 1, gridColumn: index + 2 }"
                >
                  <strong>{{ day.name }}</strong>
                  <span>{{ day.freeLabel }}</span>
                </div>
                <template v-for="(row, index) in AGENDA_ROWS" :key="'row-' + index">
                  <div v-if="row.type === 'pause'" class="agenda-pause" :style="{ gridRow: index + 2, gridColumn: '1 / -1' }">
                    Pause · {{ row.from }} → {{ row.to }}
                  </div>
                  <template v-else>
                    <span v-if="row.mark !== 'quarter'" :class="['agenda-time', row.mark]" :style="{ gridRow: index + 2, gridColumn: 1 }">{{ row.time }}</span>
                    <div :class="['agenda-line', row.mark, { last: index === AGENDA_ROWS.length - 1 }]" :style="{ gridRow: index + 2, gridColumn: '2 / -1' }"></div>
                  </template>
                </template>
                <span class="agenda-time hour end" :style="{ gridRow: AGENDA_ROWS.length + 1, gridColumn: 1 }">20:00</span>
                <template v-for="(day, dayIndex) in agendaDays" :key="'day-' + day.name">
                  <button
                    v-for="cell in day.freeCells"
                    :key="day.name + cell.time"
                    type="button"
                    :class="['agenda-free', { selected: slotsSelection && slotsSelection.day === day.name && slotsSelection.time === cell.time }]"
                    :style="{ gridRow: cell.row, gridColumn: dayIndex + 2 }"
                    :aria-label="'Créneau libre ' + day.name + ' ' + cell.time"
                    @click="selectFreeSlot(day.name, cell.time)"
                  >
                    <span aria-hidden="true">+ {{ cell.time }}</span>
                  </button>
                  <article
                    v-for="block in day.blocks"
                    :key="block.key"
                    :class="['agenda-block', block.kind, { compact: block.compact, dimmed: block.dimmed }]"
                    :style="{ gridRow: block.row + ' / span ' + block.span, gridColumn: dayIndex + 2 }"
                    :title="block.description"
                    :aria-label="block.description"
                  >
                    <strong>{{ block.title }}</strong>
                    <span class="agenda-block-meta"><span class="agenda-block-time">{{ block.timeLabel }}</span><template v-if="block.detail"> · {{ block.detail }}</template></span>
                    <em v-if="!block.compact" class="agenda-chip">{{ block.chip }}</em>
                  </article>
                </template>
              </div>
            </section>

            <aside class="slots-side no-print">
              <section v-if="slotSelectionInfo" class="panel slot-allocation" aria-live="polite">
                <span class="eyebrow">Créneau libre</span>
                <h2>{{ slotSelectionInfo.day }} · {{ slotSelectionInfo.time }}</h2>
                <p class="muted">Libre jusqu’à {{ slotSelectionInfo.until }} · {{ slotSelectionInfo.freeLabel }}</p>
                <div v-if="can('GROUPS_WRITE') && fittingUnplacedBands.length" class="slot-place">
                  <label>
                    Placer un groupe
                    <select v-model="slotBandToPlaceId">
                      <option v-for="band in fittingUnplacedBands" :key="band.id" :value="band.id">
                        {{ band.name }} · {{ band.type === 'workshop' ? 'Atelier' : 'Groupe' }}
                      </option>
                    </select>
                  </label>
                  <button type="button" class="primary-button" :disabled="!slotBandToPlaceId" @click="placeBand">Placer ici</button>
                </div>
                <p v-else-if="unplacedBands.length" class="muted">Aucun groupe à placer ne tient dans ce créneau.</p>
                <div class="slot-actions">
                  <button v-if="can('MUSICIENS_WRITE')" type="button" class="ghost-button" @click="newCourseAt(slotSelectionInfo.day, slotSelectionInfo.time)">Nouveau cours ici</button>
                  <button v-if="can('GROUPS_WRITE')" type="button" class="ghost-button" @click="newGroupAt(slotSelectionInfo.day, slotSelectionInfo.time)">Nouveau groupe ici</button>
                  <button type="button" class="link-button" @click="closeSlotSelection">Fermer</button>
                </div>
              </section>

              <section class="panel slots-unplaced">
                <div class="panel-head">
                  <div>
                    <h2>À placer</h2>
                    <span>{{ unplacedBands.length ? countLabel(unplacedBands.length, 'groupe') + ' sans horaire' : 'Tous les groupes ont un horaire' }}</span>
                  </div>
                </div>
                <ul v-if="unplacedBands.length" class="unplaced-list">
                  <li v-for="band in unplacedBands" :key="band.id">
                    <span>
                      <strong>{{ band.name }}</strong>
                      <small>{{ band.type === 'workshop' ? 'Atelier' : 'Groupe' }} · {{ durationLabel(durationMinutes(state.settings, band.type === 'workshop' ? 'workshop' : 'group', band.durationMinutes)) }}</small>
                    </span>
                    <button v-if="canAny(['GROUPS_READ', 'GROUPS_WRITE'])" type="button" class="link-button" @click="openBandInGroups(band.id)">Ouvrir</button>
                  </li>
                </ul>
                <p v-else class="muted">Choisissez un créneau libre dans le planning pour y créer un cours ou un groupe.</p>
              </section>
            </aside>
          </div>
        </section>

        <section v-if="activeView === 'people' && !mustChangePassword && canAny(['MUSICIENS_READ', 'MUSICIENS_WRITE', 'MUSICIENS_ARCHIVED'])" class="view-stack repertoire-view">
          <div class="repertoire-toolbar">
            <input v-model="search" class="search" type="search" placeholder="Rechercher un musicien" aria-label="Rechercher un musicien" />
            <div v-if="musicianFilters.length > 1" class="segmented repertoire-filters" role="group" aria-label="Filtrer les musiciens">
              <button
                v-for="filter in musicianFilters"
                :key="filter.value"
                type="button"
                :aria-pressed="activeMusicianFilter === filter.value ? 'true' : 'false'"
                @click="musicianFilter = filter.value"
              >{{ filter.label }}<small>{{ filter.count }}</small></button>
            </div>
            <button v-if="can('MUSICIENS_WRITE')" type="button" class="primary-button repertoire-new" @click="startNewMusician">Nouveau musicien</button>
          </div>

          <div :class="['repertoire-layout', { 'with-sheet': can('MUSICIENS_WRITE') && activeMusicianFilter !== 'archived', 'sheet-open': musicianFormOpen }]">
            <section v-if="activeMusicianFilter !== 'archived'" class="repertoire-card" aria-label="Musiciens actifs">
              <div class="musician-row musician-row-head" aria-hidden="true">
                <span></span>
                <span>Musicien</span>
                <span>Cours individuel</span>
                <span>Groupes</span>
                <span class="num">À payer · {{ selectedTerm?.name || 'trimestre' }}</span>
              </div>
              <ul v-if="musicianRows.length" class="musician-list">
                <li v-for="row in musicianRows" :key="row.musician.id">
                  <component
                    :is="can('MUSICIENS_WRITE') ? 'button' : 'div'"
                    :type="can('MUSICIENS_WRITE') ? 'button' : undefined"
                    :class="['musician-row', { selected: musicianFormOpen && editingMusicianId === row.musician.id }]"
                    :aria-current="musicianFormOpen && editingMusicianId === row.musician.id ? 'true' : undefined"
                    @click="editMusician(row.musician)"
                  >
                    <span class="person-avatar" aria-hidden="true">{{ personInitials(row.musician) }}</span>
                    <span class="musician-name">
                      <strong>{{ fullName(row.musician) }}</strong>
                      <small>{{ row.musician.email || '—' }}</small>
                    </span>
                    <span class="musician-course">
                      <template v-if="row.course && row.course.active !== false">
                        {{ courseSummary(row.musician) }}
                        <small>{{ courseTimeLabel(row.course) }}</small>
                      </template>
                      <span v-else class="muted">Pas de cours</span>
                    </span>
                    <span class="band-chips">
                      <span v-for="band in row.bands" :key="band.id" :class="['band-chip', band.type]">{{ band.name }}</span>
                      <span v-if="!row.bands.length" class="muted">Aucun groupe</span>
                    </span>
                    <span class="musician-due num">{{ billingMoney(row.totalDue) }}</span>
                  </component>
                </li>
              </ul>
              <p v-else class="empty-state">{{ search ? 'Aucun musicien ne correspond à la recherche.' : 'Aucun musicien dans cette catégorie.' }}</p>
            </section>

            <section v-else class="repertoire-card" aria-label="Musiciens archivés">
              <ul v-if="filteredArchivedMusicians.length" class="musician-list">
                <li v-for="musician in filteredArchivedMusicians" :key="musician.id">
                  <div class="musician-row archived">
                    <span class="person-avatar" aria-hidden="true">{{ personInitials(musician) }}</span>
                    <span class="musician-name">
                      <strong>{{ fullName(musician) }}</strong>
                      <small>{{ musician.email || '—' }}</small>
                    </span>
                    <button type="button" class="ghost-button" @click="restoreMusician(musician.id)">
                      <svg aria-hidden="true"><use href="#icon-user-check"></use></svg>
                      Désarchiver
                    </button>
                  </div>
                </li>
              </ul>
              <p v-else class="empty-state">Aucun musicien archivé.</p>
            </section>

            <aside v-if="can('MUSICIENS_WRITE') && activeMusicianFilter !== 'archived'" id="musician-editor-panel" class="repertoire-card repertoire-sheet" aria-label="Fiche musicien">
              <template v-if="musicianFormOpen">
                <header class="sheet-head">
                  <span class="person-avatar large" aria-hidden="true">{{ personInitials(musicianForm) }}</span>
                  <div>
                    <span class="eyebrow">{{ editingMusicianId ? 'Fiche musicien' : 'Nouveau musicien' }}</span>
                    <h2>{{ (musicianForm.firstName + ' ' + musicianForm.lastName).trim() || 'Sans nom' }}</h2>
                    <small>{{ musicianSheetSummary }}</small>
                  </div>
                </header>

                <section class="sheet-section">
                  <h3>Identité</h3>
                  <div class="sheet-fields">
                    <label>
                      Prénom
                      <input v-model="musicianForm.firstName" placeholder="Prénom" />
                    </label>
                    <label>
                      Nom
                      <input v-model="musicianForm.lastName" placeholder="Nom" />
                    </label>
                    <label class="full">
                      Adresse mail
                      <input type="email" v-model="musicianForm.email" placeholder="nom@exemple.fr" />
                    </label>
                  </div>
                </section>

                <section class="sheet-section">
                  <label class="sheet-section-head">
                    <h3>Cours individuel</h3>
                    <input type="checkbox" class="switch" v-model="musicianForm.hasIndividualCourse" aria-label="Inscrit à un cours individuel" />
                  </label>
                  <template v-if="musicianForm.hasIndividualCourse">
                    <div class="sheet-fields">
                      <label>
                        Professeur
                        <select v-model="musicianForm.teacherId">
                          <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ fullName(teacher) }}</option>
                        </select>
                      </label>
                      <label>
                        Instrument
                        <input v-model="musicianForm.instrument" />
                      </label>
                      <label>
                        Jour
                        <select v-model="musicianForm.weekday">
                          <option v-for="day in WEEKDAYS" :key="day" :value="day">{{ day }}</option>
                        </select>
                      </label>
                      <label>
                        Créneau
                        <select v-model="musicianForm.startTime">
                          <option v-for="slot in timeSlots" :key="slot" :value="slot" :disabled="isSlotDisabled(slot) && slot !== musicianForm.startTime">
                            {{ slot }}{{ isSlotDisabled(slot) ? ' · ' + courseSlotReason(slot) : '' }}
                          </option>
                        </select>
                      </label>
                      <label class="check-label inline-check full">
                        <input type="checkbox" v-model="musicianForm.sharedSlot" />
                        Créneau partagé
                      </label>
                    </div>
                    <p v-if="slotTakenByOtherMusician()" class="form-warning">Ce créneau n’est pas disponible : {{ courseSlotReason(musicianForm.startTime) }}. Un créneau partagé n’est possible qu’entre deux cours qui commencent à la même heure.</p>
                    <p v-else class="sheet-ok">
                      <svg aria-hidden="true"><use href="#icon-check"></use></svg>
                      Salle libre · {{ courseTimeLabel(musicianForm) }}
                    </p>
                  </template>
                  <p v-else class="sheet-note">Pas de créneau hebdomadaire.</p>
                </section>

                <section class="sheet-section">
                  <h3>Groupes musicaux</h3>
                  <div v-if="sortedIndependentBands.length" class="toggle-chips" role="group" aria-label="Groupes musicaux">
                    <button
                      v-for="band in sortedIndependentBands"
                      :key="band.id"
                      type="button"
                      class="toggle-chip"
                      :aria-pressed="musicianForm.bandIds.includes(band.id) ? 'true' : 'false'"
                      @click="toggleMusicianBand(band.id)"
                    >{{ band.name }}<small>{{ bandScheduleLabel(band) || 'à placer' }}</small></button>
                  </div>
                  <p v-else class="sheet-note">Aucun groupe musical cette année.</p>
                </section>

                <section class="sheet-section">
                  <h3>Atelier</h3>
                  <div v-if="sortedWorkshopBands.length" class="segmented sheet-segmented" role="group" aria-label="Atelier">
                    <button type="button" :aria-pressed="musicianForm.inWorkshop ? 'false' : 'true'" @click="setMusicianWorkshop('')">Aucun</button>
                    <button
                      v-for="band in sortedWorkshopBands"
                      :key="band.id"
                      type="button"
                      :aria-pressed="musicianForm.inWorkshop && musicianForm.workshopBandId === band.id ? 'true' : 'false'"
                      @click="setMusicianWorkshop(band.id)"
                    >{{ band.name }}</button>
                  </div>
                  <p v-else class="sheet-note">Aucun atelier cette année.</p>
                </section>

                <div class="sheet-actions">
                  <button class="primary-button" @click="saveMusician" :disabled="slotTakenByOtherMusician()">
                    {{ editingMusicianId ? 'Enregistrer' : 'Créer le musicien' }}
                  </button>
                  <button class="ghost-button" @click="resetMusicianForm">{{ musicianFormDirty ? 'Annuler' : 'Fermer' }}</button>
                  <span v-if="musicianFormDirty" class="dirty-flag">Non enregistré</span>
                  <button v-if="editingMusicianId" type="button" class="link-button danger-link" @click="deleteMusician(editingMusicianId)">Archiver</button>
                </div>
              </template>
              <div v-else class="sheet-empty">
                <svg aria-hidden="true"><use href="#icon-nav-people"></use></svg>
                <p>Choisissez un musicien dans la liste pour ouvrir sa fiche, ou créez-en un.</p>
                <button type="button" class="ghost-button" @click="startNewMusician">Nouveau musicien</button>
              </div>
            </aside>
          </div>
        </section>

        <section v-if="activeView === 'groups' && !mustChangePassword && canAny(['GROUPS_READ', 'GROUPS_WRITE'])" class="view-stack repertoire-view">
          <div class="repertoire-toolbar">
            <input v-model="groupListSearch" class="search" type="search" placeholder="Rechercher un groupe" aria-label="Rechercher un groupe" />
            <button v-if="can('GROUPS_WRITE')" type="button" class="primary-button repertoire-new" @click="startNewGroup">Nouveau groupe</button>
          </div>

          <div class="groups-layout">
            <nav class="group-list" aria-label="Groupes et ateliers">
              <section v-for="section in groupSections" :key="section.key" class="group-list-section">
                <h2 class="group-list-label"><span>{{ section.label }}</span><span>{{ section.bands.length }}</span></h2>
                <button
                  v-for="band in section.bands"
                  :key="band.id"
                  type="button"
                  :class="['group-card', { active: selectedGroupId === band.id }]"
                  :aria-current="selectedGroupId === band.id ? 'true' : undefined"
                  @click="pickGroup(band.id)"
                >
                  <span class="group-card-top">
                    <strong>{{ band.name }}</strong>
                    <span v-if="bandScheduleLabel(band)" class="group-card-when">{{ bandScheduleLabel(band) }}</span>
                    <span v-else class="todo-pill">À placer</span>
                  </span>
                  <span class="group-card-bottom">
                    <span>{{ band.type === 'workshop' ? (teachersById[band.teacherId] ? fullName(teachersById[band.teacherId]) : 'Sans professeur') : durationLabel(durationMinutes(state.settings, 'group', band.durationMinutes)) }}</span>
                    <span class="avatar-stack">
                      <span v-for="musician in bandMemberPreview(band).shown" :key="musician.id" class="person-avatar small" aria-hidden="true">{{ personInitials(musician) }}</span>
                      <span v-if="bandMemberPreview(band).more" class="person-avatar small more" aria-hidden="true">+{{ bandMemberPreview(band).more }}</span>
                      <span class="visually-hidden">{{ countLabel(memberCount(band), 'membre') }}</span>
                      <span v-if="!memberCount(band)" class="muted" aria-hidden="true">Aucun membre</span>
                    </span>
                  </span>
                </button>
              </section>
              <p v-if="!groupSections.length" class="empty-state">{{ state.bands.length ? 'Aucun groupe ne correspond à la recherche.' : 'Aucun groupe cette année.' }}</p>
            </nav>

            <section v-if="selectedGroupId || can('GROUPS_WRITE')" class="repertoire-card group-detail" aria-label="Fiche du groupe">
              <header class="group-detail-head">
                <div>
                  <span class="eyebrow">{{ selectedGroupId ? (groupForm.type === 'workshop' ? 'Atelier' : 'Groupe musical') : 'Nouveau groupe' }}</span>
                  <h2>{{ groupForm.name.trim() || 'Sans nom' }}</h2>
                </div>
                <span class="group-detail-when">{{ bandScheduleLabel(groupForm) || 'À placer' }} · {{ durationLabel(durationMinutes(state.settings, groupForm.type === 'workshop' ? 'workshop' : 'group', groupForm.durationMinutes)) }}</span>
                <button v-if="selectedGroupId && canAny(['MUSICIENS_READ', 'MUSICIENS_WRITE'])" type="button" class="link-button group-slots-link" @click="openGroupInSlots">
                  Voir dans Créneaux
                  <svg aria-hidden="true"><use href="#icon-arrow-right"></use></svg>
                </button>
              </header>

              <div class="group-detail-body">
                <section class="group-settings">
                  <h3>Réglages</h3>
                  <div class="segmented sheet-segmented" role="group" aria-label="Type">
                    <button type="button" :aria-pressed="groupForm.type === 'independent' ? 'true' : 'false'" :disabled="!can('GROUPS_WRITE')" @click="groupForm.type = 'independent'">Groupe musical</button>
                    <button type="button" :aria-pressed="groupForm.type === 'workshop' ? 'true' : 'false'" :disabled="!can('GROUPS_WRITE')" @click="groupForm.type = 'workshop'">Atelier</button>
                  </div>
                  <div class="sheet-fields">
                    <label class="full">
                      Nom
                      <input v-model="groupForm.name" placeholder="Nom du groupe" :disabled="!can('GROUPS_WRITE')" />
                    </label>
                    <label v-if="groupForm.type === 'workshop'" class="full">
                      Professeur
                      <select v-model="groupForm.teacherId" :disabled="!can('GROUPS_WRITE')">
                        <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ fullName(teacher) }}</option>
                      </select>
                    </label>
                    <div v-else class="full sheet-field">
                      <span>Durée</span>
                      <div class="segmented sheet-segmented" role="group" aria-label="Durée">
                        <button
                          v-for="minutes in GROUP_DURATIONS"
                          :key="minutes"
                          type="button"
                          :aria-pressed="groupForm.durationMinutes === minutes ? 'true' : 'false'"
                          :disabled="!can('GROUPS_WRITE')"
                          @click="groupForm.durationMinutes = minutes"
                        >{{ durationLabel(minutes) }}</button>
                      </div>
                    </div>
                    <label>
                      Jour
                      <select v-model="groupForm.weekday" :disabled="!can('GROUPS_WRITE')">
                        <option v-for="day in WEEKDAYS" :key="day" :value="day">{{ day }}</option>
                      </select>
                    </label>
                    <label>
                      Horaire
                      <select v-model="groupForm.startTime" :disabled="!can('GROUPS_WRITE')">
                        <option value="">À placer (sans horaire)</option>
                        <option v-for="option in groupStartOptions" :key="option.time" :value="option.time" :disabled="Boolean(option.reason) && option.time !== groupForm.startTime">
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <p v-if="groupStartWarning" class="form-warning">Cet horaire n’est pas disponible : {{ groupStartWarning }}. Choisissez-en un autre ou laissez le groupe à placer.</p>
                </section>

                <section class="group-members">
                  <h3>Membres · {{ groupForm.memberIds.length }}</h3>
                  <input v-model="groupSearch" class="search" type="search" placeholder="Filtrer les musiciens" aria-label="Filtrer les musiciens" />
                  <ul v-if="groupMemberRows.length" class="member-checklist">
                    <template v-for="row in groupMemberRows" :key="row.musician.id">
                      <li v-if="row.firstOther" class="member-separator" aria-hidden="true">Autres musiciens</li>
                      <li>
                        <label :class="['member-check', { checked: row.checked }]">
                          <input type="checkbox" :checked="row.checked" :disabled="!can('GROUPS_WRITE')" @change="toggleGroupMember(row.musician.id)" />
                          <span class="person-avatar" aria-hidden="true">{{ personInitials(row.musician) }}</span>
                          <span class="member-name">
                            {{ fullName(row.musician) }}
                            <small>{{ row.course || 'Pas de cours' }}</small>
                          </span>
                          <span v-if="row.otherBands" class="member-other">{{ row.otherBands }}</span>
                        </label>
                      </li>
                    </template>
                  </ul>
                  <p v-else class="empty-state">Aucun musicien ne correspond.</p>
                </section>
              </div>

              <div v-if="can('GROUPS_WRITE')" class="sheet-actions">
                <button class="primary-button" @click="saveGroup">{{ selectedGroupId ? 'Enregistrer le groupe' : 'Créer le groupe' }}</button>
                <button class="ghost-button" :disabled="!groupFormDirty" @click="cancelGroupEdit">Annuler</button>
                <span v-if="groupFormDirty" class="dirty-flag">Modifications non enregistrées</span>
                <button v-if="selectedGroupId" type="button" class="link-button danger-link" @click="deleteGroup(selectedGroupId)">Supprimer le groupe</button>
              </div>
            </section>
          </div>
        </section>

        <section v-if="activeView === 'expenses' && !mustChangePassword && canAny(['EXPENSES_READ', 'EXPENSES_WRITE', 'EXPENSES_DELETE'])" class="view-stack">
          <section class="kpi-tiles expense-kpi-tiles" aria-label="Totaux des dépenses">
            <article class="kpi-tile">
              <div class="kpi-tile-copy">
                <span>Total annuel</span>
                <strong>{{ money(totals.annualExpenses) }}</strong>
                <small>{{ state.settings.year }}</small>
              </div>
            </article>
            <article v-for="category in expenseTotalsByCategory" :key="category.value" class="kpi-tile">
              <div class="kpi-tile-copy">
                <span>{{ category.label }}</span>
                <strong>{{ money(category.total) }}</strong>
                <small>Dépenses saisies</small>
              </div>
            </article>
          </section>

          <section v-if="can('EXPENSES_WRITE')" class="panel">
            <div class="panel-head">
              <h2>{{ editingExpenseId ? 'Modifier une dépense' : 'Ajouter une dépense' }}</h2>
              <span>{{ state.expenses.length }} dépenses</span>
            </div>
            <div class="expense-editor">
              <label>
                Date
                <input type="date" v-model="expenseForm.date" />
              </label>
              <label>
                Catégorie
                <select v-model="expenseForm.category">
                  <option v-for="category in EXPENSE_CATEGORIES" :key="category.value" :value="category.value">{{ category.label }}</option>
                </select>
              </label>
              <label>
                Libellé
                <input v-model="expenseForm.label" placeholder="Achat, réparation, location..." />
              </label>
              <label>
                Montant
                <input type="number" v-model.number="expenseForm.amount" min="0" step="0.01" />
              </label>
              <label class="expense-notes">
                Notes
                <input v-model="expenseForm.notes" placeholder="Optionnel" />
              </label>
            </div>
            <div class="form-actions">
              <button class="primary-button" @click="saveExpense">{{ editingExpenseId ? 'Enregistrer' : 'Ajouter' }}</button>
              <button class="ghost-button" @click="resetExpenseForm">Réinitialiser</button>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Dépenses de l'année</h2>
              <span>{{ money(totals.annualExpenses) }}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Catégorie</th>
                  <th>Libellé</th>
                  <th class="num">Montant</th>
                  <th v-if="canAny(['EXPENSES_WRITE', 'EXPENSES_DELETE'])" class="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="expense in expenseRows" :key="expense.id">
                  <td>{{ formatDate(expense.date) }}</td>
                  <td>{{ categoryLabel(expense.category) }}</td>
                  <td>
                    <strong>{{ expense.label }}</strong>
                    <small v-if="expense.notes">{{ expense.notes }}</small>
                  </td>
                  <td class="num">{{ money(expense.amount) }}</td>
                  <td v-if="canAny(['EXPENSES_WRITE', 'EXPENSES_DELETE'])">
                    <div class="row-actions">
                      <button v-if="can('EXPENSES_WRITE')" class="action-button" @click="editExpense(expense)" :aria-label="'Modifier la dépense ' + expense.label" :title="'Modifier la dépense ' + expense.label">
                        <svg aria-hidden="true"><use href="#icon-edit"></use></svg>
                      </button>
                      <button v-if="can('EXPENSES_DELETE')" class="action-button danger" @click="deleteExpense(expense.id)" :aria-label="'Supprimer la dépense ' + expense.label" :title="'Supprimer la dépense ' + expense.label">
                        <svg aria-hidden="true"><use href="#icon-trash"></use></svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="expenseRows.length === 0">
                  <td :colspan="canAny(['EXPENSES_WRITE', 'EXPENSES_DELETE']) ? 5 : 4" class="muted">Aucune dépense saisie pour cette année.</td>
                </tr>
              </tbody>
            </table>
          </section>
        </section>

        <section v-if="activeView === 'billing' && !mustChangePassword && canAny(['BILLING_READ', 'BILLING_PRINT'])" class="view-stack">
          <div class="document-workflow-note">
            <strong>1. Prévisualiser et corriger</strong>
            <span>Les PDF restent des brouillons régénérables.</span>
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>
            <strong>2. Valider définitivement</strong>
            <span>Les documents validés sont ensuite figés.</span>
          </div>
          <div v-if="billingStatus !== 'ready'" class="billing-state" :class="{ error: billingStatus === 'error' }" role="status">
            <span>{{ billingStatus === 'loading' ? 'Calcul comptable en cours…' : (billingError || 'Calcul comptable non chargé.') }}</span>
            <button v-if="billingStatus === 'error'" class="ghost-button" @click="loadBillingSummary">Réessayer</button>
          </div>
          <div class="billing-tabs" role="tablist" aria-label="Sections de facturation">
            <button
              type="button"
              role="tab"
              :aria-selected="billingTab === 'students'"
              :class="['billing-tab', { active: billingTab === 'students' }]"
              @click="billingTab = 'students'"
            >
              Factures élèves
              <span>{{ studentInvoiceDocuments.length || billableStudentRows.length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="billingTab === 'providers'"
              :class="['billing-tab', { active: billingTab === 'providers' }]"
              @click="billingTab = 'providers'"
            >
              Demandes prestataires
              <span>{{ teacherInvoiceRequestDocuments.length || teacherBillingSections.length }}</span>
            </button>
          </div>
          <section v-if="billingTab === 'students'" class="panel">
            <div class="panel-head">
              <div>
                <h2>Factures élèves</h2>
                <span>{{ studentInvoiceDocuments.length || billableStudentRows.length }} factures</span>
              </div>
              <div class="document-actions">
                <a v-if="studentInvoiceSummaryDocument" class="document-link" href="#" @click.prevent="downloadDocument(studentInvoiceSummaryDocument)">
                  PDF global
                </a>
                <button v-if="can('BILLING_PRINT')" class="primary-button" @click="prepareAllStudentInvoices">Prévisualiser les factures</button>
                <button v-if="can('BILLING_PRINT') && studentInvoiceDocuments.some(document => document.status === 'DRAFT')" class="danger-outline-button" @click="finalizeAllStudentInvoices">Valider définitivement</button>
                <button v-if="can('BILLING_PRINT')" class="ghost-button" @click="markAllStudentInvoicesSent" :disabled="markingStudentInvoicesSent || yearClosed || !studentInvoicesToSend.length" :title="yearClosed ? 'L’année est clôturée.' : !studentInvoicesToSend.length ? 'Aucune facture individuelle validée à marquer comme envoyée.' : 'Marquer les factures individuelles validées du trimestre comme envoyées.'">{{ markingStudentInvoicesSent ? 'Marquage en cours…' : 'Tout marquer comme envoyé' }}</button>
              </div>
            </div>
            <div class="invoice-summary">
              <article>
                <span>Montant global élèves</span>
                <strong>{{ billingMoney(studentTotal) }}</strong>
              </article>
              <article>
                <span>Cours individuels</span>
                <strong>{{ billingMoney(totals.studentBilling) }}</strong>
              </article>
              <article>
                <span>Cotisations groupe</span>
                <strong>{{ billingMoney(totals.groupFees) }}</strong>
                <small>{{ isFirstTerm ? 'Cotisation annuelle appliquée' : 'Cotisation annuelle déjà traitée au T1' }}</small>
              </article>
            </div>
            <p v-if="can('BILLING_PRINT') && studentInvoiceDocuments.length" class="muted">Après transmission du PDF global au service de facturation, vous pouvez marquer toutes les factures individuelles validées comme envoyées.</p>
            <p v-if="preparedStudentInvoices" class="success-note">{{ studentInvoiceDocuments.length }} brouillons disponibles pour {{ selectedTerm.name }} {{ state.settings.year }}. Vous pouvez les régénérer jusqu’à leur validation définitive.</p>
            <div class="attendance-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th class="num">Cours</th>
                    <th class="num">Cotisation</th>
                    <th class="num">Total</th>
                    <th>Document</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in billableStudentRows" :key="row.musician.id">
                    <td><strong>{{ fullName(row.musician) }}</strong></td>
                    <td class="num">{{ billingMoney(row.courseDue) }}</td>
                    <td class="num">{{ billingMoney(row.groupFee) }}</td>
                    <td class="num">{{ billingMoney(row.totalDue) }}</td>
                    <td>
                      <span v-if="documentForMusician(row.musician.id)" class="document-cell">
                        <span :class="['doc-pill', documentForMusician(row.musician.id).status.toLowerCase()]">{{ documentStatusLabel(documentForMusician(row.musician.id).status) }}</span>
                        <a v-if="documentForMusician(row.musician.id).fileName" class="document-link" href="#" @click.prevent="downloadDocument(documentForMusician(row.musician.id))">PDF</a>
                        <span v-else class="muted">à régénérer</span>
                      </span>
                      <span v-else class="muted">Non généré</span>
                      <div v-if="documentForMusician(row.musician.id) && can('BILLING_PRINT')" class="document-row-actions">
                        <button v-if="documentForMusician(row.musician.id).status === 'GENERATED'" @click="markDocumentSent(documentForMusician(row.musician.id))" :disabled="markingStudentInvoicesSent">Marquer envoyé</button>
                        <button v-if="documentForMusician(row.musician.id).status === 'GENERATED'" @click="cancelFinalDocument(documentForMusician(row.musician.id))">Annuler</button>
                        <button v-if="['GENERATED', 'SENT'].includes(documentForMusician(row.musician.id).status)" @click="correctFinalDocument(documentForMusician(row.musician.id))">Corriger</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section v-if="billingTab === 'providers'" class="panel">
            <div class="panel-head">
              <div>
                <h2>Demandes de facture prestataires</h2>
                <span>{{ countLabel(teacherInvoiceRequestDocuments.length || teacherBillingSections.length, 'demande') }}</span>
              </div>
              <div class="document-actions">
                <span class="muted">Prévisualisation et validation par prestataire</span>
              </div>
            </div>
            <div class="teacher-billing-list">
              <article v-for="section in teacherBillingSections" :key="section.teacher.id" class="teacher-billing-card">
                <div class="teacher-billing-head">
                  <div>
                    <h3>{{ fullName(section.teacher) }}</h3>
                    <span>{{ section.teacher.instrument }}</span>
                  </div>
                  <div class="document-actions">
                    <label class="week-cutoff">Jusqu’à la semaine
                      <select v-model.number="teacherEndWeeks[section.teacher.id]">
                        <option v-for="week in weeks" :key="week" :value="week">S{{ week }}</option>
                      </select>
                    </label>
                    <a v-if="draftForTeacher(section.teacher.id)?.fileName" class="document-link" href="#" @click.prevent="downloadDocument(draftForTeacher(section.teacher.id))">
                      PDF du brouillon · Situation {{ draftForTeacher(section.teacher.id).installmentNumber || 'à régénérer' }}
                    </a>
                    <div v-if="can('BILLING_PRINT')" class="document-actions">
                      <button
                        v-if="section.installmentsAvailable"
                        class="ghost-button"
                        @click="prepareTeacherInvoiceRequest(section.teacher.id)"
                      >{{ draftForTeacher(section.teacher.id) ? 'Régénérer le brouillon' : 'Prévisualiser' }}</button>
                      <button
                        v-if="draftForTeacher(section.teacher.id)?.installmentNumber"
                        class="danger-outline-button"
                        @click="finalizeTeacherInvoiceRequest(section.teacher.id)"
                      >Valider cette demande</button>
                    </div>
                    <span v-if="!section.installmentsAvailable" class="muted">Trimestre historique : acomptes disponibles au prochain trimestre</span>
                  </div>
                </div>
                <div class="teacher-financial-metrics">
                  <div><span>Montant acquis</span><strong>{{ billingMoney(section.accruedAmount) }}</strong></div>
                  <div><span>Déjà émis</span><strong>{{ billingMoney(section.issuedAmount) }}</strong></div>
                  <div><span>Régularisations</span><strong>{{ billingMoney(section.pendingAdjustmentAmount) }}</strong></div>
                  <div class="remaining"><span>Restant à émettre</span><strong>{{ billingMoney(section.remainingAmount) }}</strong></div>
                </div>
                <div class="attendance-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Semaine</th>
                        <th>Début de semaine</th>
                        <th class="num">Nombre d'heures</th>
                        <th class="num">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in section.rows" :key="row.key">
                        <td><strong>S{{ row.week }}</strong></td>
                        <td><strong>{{ row.dateLabel }}</strong></td>
                        <td class="num">{{ row.hours.toFixed(2) }} h</td>
                        <td class="num">{{ billingMoney(row.totalAmount) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="section.adjustments.length" class="pending-adjustments">
                  <strong>Régularisations en attente</strong>
                  <div v-for="adjustment in section.adjustments" :key="adjustment.id">
                    <span>{{ adjustment.reason }} · {{ billingMoney(adjustment.amount) }}</span>
                    <button v-if="can('BILLING_PRINT')" class="ghost-button" @click="deleteTeacherAdjustment(adjustment)">Supprimer</button>
                  </div>
                </div>
                <div v-if="finalizedDocumentsForTeacher(section.teacher.id).length" class="installment-history">
                  <strong>Historique des situations</strong>
                  <div v-for="document in finalizedDocumentsForTeacher(section.teacher.id)" :key="document.id" class="installment-row">
                    <span>Situation n°{{ document.installmentNumber || 'historique' }} · S{{ document.periodStartWeek || selectedTerm.startWeek }}–S{{ document.periodEndWeek || selectedTerm.endWeek }}</span>
                    <span :class="['doc-pill', document.status.toLowerCase()]">{{ documentStatusLabel(document.status) }}</span>
                    <a v-if="document.fileName" class="document-link" href="#" @click.prevent="downloadDocument(document)">{{ document.documentNumber }}</a>
                    <div v-if="can('BILLING_PRINT')" class="document-row-actions">
                      <button v-if="document.status === 'GENERATED'" @click="markDocumentSent(document)">Marquer envoyé</button>
                      <button v-if="document.status === 'GENERATED'" @click="cancelFinalDocument(document)">Annuler</button>
                      <button v-if="document.status === 'SENT'" @click="reportTeacherAdjustment(document)">Reporter un écart</button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
          <section v-if="documentHistory.length" class="panel">
            <div class="panel-head"><div><h2>Historique des corrections</h2><span>Les originaux et avoirs restent consultables</span></div></div>
            <div class="document-history-list">
              <article v-for="document in documentHistory" :key="document.id">
                <div><strong>{{ document.documentNumber }} <span :class="['doc-pill', document.status.toLowerCase()]">{{ documentStatusLabel(document.status) }}</span></strong><span>{{ document.correctionReason }}</span></div>
                <a v-if="document.fileName" class="document-link" href="#" @click.prevent="downloadDocument(document)">PDF</a>
              </article>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'data-transfer' && !mustChangePassword && can('IMPORT_EXPORT')" class="view-stack">
          <section class="panel">
            <div class="panel-head">
              <div><h2>Sauvegarde complète</h2><span>Archive ZIP avec les données et les PDF originaux</span></div>
              <button class="primary-button" @click="createBackup" :disabled="transferBusy">Créer et télécharger une sauvegarde</button>
            </div>
            <p class="muted">Les documents, leurs statuts, les présences facturées, les ajustements et le journal d’audit sont inclus. Une archive est créée automatiquement avant chaque import ou restauration.</p>
            <p v-if="transferBusy" role="status">Opération en cours…</p>
            <div class="panel-head">
              <h3>Archives disponibles sur le serveur</h3>
              <button class="ghost-button" @click="loadBackups" :disabled="transferBusy">Actualiser</button>
            </div>
            <p v-if="backupListLoaded && !backupFiles.length" class="muted">Aucune sauvegarde ZIP disponible.</p>
            <ul v-if="backupFiles.length" class="backup-list">
              <li v-for="backup in backupFiles" :key="backup.fileName">
                <button class="ghost-button" @click="downloadBackup(backup.fileName)">{{ backup.fileName }}</button>
                <small>{{ new Date(backup.createdAt).toLocaleString('fr-FR') }} · {{ (backup.sizeBytes / 1024 / 1024).toFixed(2) }} Mio</small>
              </li>
            </ul>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div><h2>Restaurer une sauvegarde complète</h2><span>Rétablit les données et les PDF sans recalculer les factures</span></div>
              <button class="primary-button" @click="analyzeRestore" :disabled="!selectedRestoreFile || transferBusy">Vérifier l’archive</button>
            </div>
            <label class="premium-file-picker">
              <input class="visually-hidden-file" type="file" accept="application/zip,.zip" @change="selectRestoreFile" :disabled="transferBusy" />
              <span class="premium-file-button">Choisir une archive ZIP</span>
              <span class="premium-file-name">{{ selectedRestoreFile?.name || 'Aucune archive sélectionnée' }}</span>
            </label>
            <p class="form-help">ZIP de 64 Mio maximum, créé avec cette version du schéma. La vérification ne modifie aucune donnée.</p>
            <div v-if="restoreAnalysis?.valid" class="import-analysis">
              <strong>Archive vérifiée · {{ restoreAnalysis.documents }} documents · {{ restoreAnalysis.pdfs }} PDF</strong>
              <p class="form-warning">La restauration remplacera toutes les données métier. Le journal d’audit existant sera conservé et complété.</p>
              <div class="import-confirmation">
                <label for="restore-confirmation">Saisissez <code>{{ restoreAnalysis.confirmationValue }}</code> pour confirmer</label>
                <input id="restore-confirmation" v-model="restoreConfirmation" autocomplete="off" :disabled="transferBusy" />
                <button class="danger-outline-button" @click="restoreBackup" :disabled="transferBusy || restoreConfirmation !== restoreAnalysis.confirmationValue">Restaurer toutes les données et les PDF</button>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Export JSON</h2>
                <span>Données de saisie, sans documents ni liens de facturation</span>
              </div>
              <button class="primary-button" @click="exportData">Exporter</button>
            </div>
            <p class="muted">Le fichier contient la configuration annuelle, les professeurs, musiciens, groupes, créneaux individuels et présences.</p>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Import JSON</h2>
                <span>Analyse obligatoire avant le remplacement des données</span>
              </div>
              <button class="primary-button" @click="analyzeImport" :disabled="!selectedImportFile || transferBusy" :title="selectedImportFile ? '' : 'Sélectionnez d’abord un fichier JSON.'">Analyser le fichier</button>
            </div>
            <div class="premium-file-row">
              <label class="premium-file-picker">
                <input class="visually-hidden-file" type="file" accept="application/json,.json" @change="selectImportFile" :disabled="transferBusy" />
                <span class="premium-file-button">Choisir un fichier JSON</span>
                <span class="premium-file-name">{{ selectedImportFile?.name || 'Aucun fichier sélectionné' }}</span>
              </label>
              <small class="form-help" :class="{ ready: selectedImportFile }">
                {{ selectedImportFile ? 'Le fichier est prêt à être analysé.' : 'Sélectionnez un export JSON pour activer l’analyse.' }}
              </small>
            </div>
            <p class="form-warning">Aucune donnée n’est modifiée pendant l’analyse. L’import final remplacera toutes les données métier dans une transaction unique.</p>

            <div v-if="importAnalysis" class="import-analysis" :class="{ invalid: !importAnalysis.valid }">
              <div class="import-analysis-head">
                <strong>{{ importAnalysis.valid ? 'Analyse réussie' : 'Import refusé' }}</strong>
                <span>{{ importAnalysis.valid ? 'Toutes les références sont cohérentes.' : importAnalysis.errors.length + ' erreur(s) à corriger.' }}</span>
              </div>
              <ul v-if="!importAnalysis.valid" class="import-errors">
                <li v-for="error in importAnalysis.errors" :key="error">{{ error }}</li>
              </ul>
              <div v-else class="import-impact-grid">
                <article><span>Données actuelles supprimées</span><strong>{{ importAnalysis.current.musicians }} musiciens · {{ importAnalysis.current.attendance }} présences · {{ importAnalysis.current.documents }} documents</strong></article>
                <article><span>Données importées</span><strong>{{ importAnalysis.incoming.musicians }} musiciens · {{ importAnalysis.incoming.attendance }} présences · {{ importAnalysis.incoming.documents }} document</strong></article>
              </div>
              <div v-if="importAnalysis.valid" class="import-confirmation">
                <label for="import-confirmation">Saisissez <code>{{ importAnalysis.confirmationValue }}</code> pour confirmer</label>
                <input id="import-confirmation" v-model="importConfirmation" autocomplete="off" />
                <button class="danger-outline-button" @click="importData" :disabled="transferBusy || importConfirmation !== importAnalysis.confirmationValue">Remplacer toutes les données</button>
                <small>Une sauvegarde ZIP complète (données et PDF) sera créée avant le remplacement. Si elle échoue, l’import est annulé.</small>
              </div>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'account' && canUseAccount" class="view-stack">
          <section v-if="can('ACCOUNT_USER') && !mustChangePassword" class="panel">
            <div class="panel-head">
              <div>
                <h2>Profil</h2>
                <span>{{ currentUser?.username }}</span>
              </div>
              <button class="primary-button" @click="saveProfile">Enregistrer</button>
            </div>
            <div class="account-profile">
              <div class="account-avatar">
                <img v-if="currentUserAvatarUrl" :src="currentUserAvatarUrl" alt="" />
                <span v-else>{{ currentUserInitials }}</span>
              </div>
              <div class="form-grid compact">
                <label>
                  Nom affiché
                  <input v-model="profileForm.displayName" />
                </label>
                <label>
                  Email
                  <input v-model="profileForm.email" type="email" />
                </label>
                <label>
                  Langue
                  <select v-model="profileForm.locale">
                    <option value="fr-FR">Français</option>
                    <option value="en-US">English</option>
                  </select>
                </label>
                <label>
                  Téléphone
                  <input v-model="profileForm.phone" />
                </label>
              </div>
            </div>
            <div class="form-actions">
              <label class="premium-file-picker avatar-file-picker">
                <input class="visually-hidden-file" type="file" accept="image/png,image/jpeg,image/webp" @change="selectAvatarFile" />
                <span class="premium-file-button">Choisir une image</span>
                <span class="premium-file-name">{{ avatarFile?.name || 'Aucune image sélectionnée' }}</span>
              </label>
              <button class="ghost-button" @click="openAvatarCrop" :disabled="!avatarFile || avatarUploading" :title="avatarFile ? '' : 'Choisissez une image avant de changer l’avatar.'">Changer l'avatar</button>
              <button class="ghost-button danger-button" @click="deleteAvatar" :disabled="!currentUser?.avatar" :title="currentUser?.avatar ? '' : 'Aucun avatar enregistré à supprimer.'">Supprimer l'avatar</button>
            </div>
            <p class="form-help" :class="{ ready: avatarFile }">{{ avatarFile ? 'Cliquez sur « Changer l’avatar » pour recadrer la photo avant de l’envoyer.' : 'Choisissez une image PNG, JPEG ou WebP (10 Mo maximum).' }}</p>
          </section>

          <section v-if="!mustChangePassword" class="panel appearance-panel">
            <div class="panel-head">
              <div>
                <h2>Apparence</h2>
                <span>Auto suit le réglage clair ou sombre du système · choix mémorisé sur cet appareil</span>
              </div>
              <div class="segmented" role="group" aria-label="Thème de l’interface">
                <button
                  v-for="choice in THEME_CHOICES"
                  :key="choice.value"
                  type="button"
                  :aria-pressed="themePreference === choice.value ? 'true' : 'false'"
                  @click="setThemePreference(choice.value)"
                >{{ choice.label }}</button>
              </div>
            </div>
          </section>

          <section v-if="can('ACCOUNT_USER') && !mustChangePassword" class="panel security-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Sécurité du compte</p>
                <h2>Authentification à deux facteurs</h2>
                <span>Codes temporaires compatibles avec les applications TOTP</span>
              </div>
              <span :class="['security-status', twoFactorStatus?.enabled ? 'enabled' : 'disabled']">
                <svg class="icon" aria-hidden="true"><use :href="twoFactorStatus?.enabled ? '#icon-shield-check' : '#icon-shield-warning'"></use></svg>
                {{ twoFactorStatus?.enabled ? 'Activée' : 'Non activée' }}
              </span>
            </div>

            <div v-if="twoFactorLoading && !twoFactorStatus" class="auth-pending compact" role="status">
              <span class="loading-ring" aria-hidden="true"></span>
              <p>Chargement de la configuration…</p>
            </div>

            <template v-else-if="twoFactorStatus?.enabled">
              <div class="security-summary">
                <div>
                  <span>Protection active depuis</span>
                  <strong>{{ formatDateTime(twoFactorStatus.activatedAt) }}</strong>
                </div>
                <div>
                  <span>Codes de récupération disponibles</span>
                  <strong>{{ twoFactorStatus.recoveryCodesRemaining }}</strong>
                </div>
              </div>
              <div v-if="isAdministrator" class="security-callout compact">
                <svg class="icon" aria-hidden="true"><use href="#icon-lock"></use></svg>
                <div><strong>Protection obligatoire</strong><p>La double authentification ne peut pas être désactivée durablement sur un compte administrateur.</p></div>
              </div>
              <div class="mfa-actions">
                <button class="ghost-button" type="button" @click="mfaAccountAction = mfaAccountAction === 'recovery' ? '' : 'recovery'">Régénérer les codes de récupération</button>
                <button v-if="!isAdministrator" class="danger-outline-button" type="button" @click="mfaAccountAction = mfaAccountAction === 'disable' ? '' : 'disable'">Désactiver la 2FA</button>
              </div>
              <form v-if="mfaAccountAction === 'recovery'" class="security-inline-form" @submit.prevent="regenerateRecoveryCodes">
                <label>
                  Code TOTP ou code de récupération
                  <input v-model="mfaRecoveryForm.code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" />
                </label>
                <button class="primary-button" type="submit" :disabled="twoFactorLoading">Générer de nouveaux codes</button>
              </form>
              <form v-if="mfaAccountAction === 'disable' && !isAdministrator" class="security-inline-form security-disable-form" @submit.prevent="disableTwoFactor">
                <label>
                  Mot de passe actuel
                  <input v-model="mfaDisableForm.password" type="password" autocomplete="current-password" />
                </label>
                <label>
                  Code TOTP ou de récupération
                  <input v-model="mfaDisableForm.code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" />
                </label>
                <button class="danger-outline-button" type="submit" :disabled="twoFactorLoading">Confirmer la désactivation</button>
              </form>
            </template>

            <template v-else>
              <div class="security-callout optional">
                <svg class="icon" aria-hidden="true"><use href="#icon-device-mobile"></use></svg>
                <div>
                  <strong>{{ isAdministrator ? 'Activation requise' : 'Renforcez la sécurité de votre compte' }}</strong>
                  <p>{{ isAdministrator ? 'Terminez l’enrôlement pour poursuivre.' : 'Cette protection est facultative pour un compte non administrateur et fortement recommandée.' }}</p>
                </div>
              </div>
              <button v-if="mfaAccountAction !== 'setup'" class="primary-button" type="button" @click="mfaAccountAction = 'setup'">Activer la double authentification</button>
              <form v-else-if="!mfaSetup" class="security-inline-form" @submit.prevent="beginMfaSetup">
                <label>
                  Confirmez votre mot de passe
                  <input v-model="mfaSetupForm.password" type="password" autocomplete="current-password" />
                </label>
                <div class="mfa-actions">
                  <button class="primary-button" type="submit" :disabled="twoFactorLoading">Générer mon QR code</button>
                  <button class="ghost-button" type="button" @click="mfaAccountAction = ''">Annuler</button>
                </div>
              </form>
              <form v-else class="mfa-enrollment-grid account-mfa-grid" @submit.prevent="activateTwoFactor">
                <div class="mfa-qr" v-html="mfaQrSvg" aria-label="QR code TOTP"></div>
                <div class="mfa-steps">
                  <ol>
                    <li>Scannez le QR code avec votre application TOTP.</li>
                    <li>Saisissez le code à six chiffres affiché.</li>
                  </ol>
                  <details><summary>Saisie manuelle</summary><code class="mfa-secret">{{ mfaSetup.secret }}</code></details>
                  <totp-code-input
                    v-model="mfaSetupDigits"
                    label="Code de vérification"
                    :error="Boolean(mfaSetupError)"
                  ></totp-code-input>
                  <p v-if="mfaSetupError" class="form-warning">{{ mfaSetupError }}</p>
                  <div class="mfa-actions">
                    <button class="primary-button" type="submit" :disabled="twoFactorLoading || !mfaSetupCodeComplete">Activer</button>
                    <button class="ghost-button" type="button" @click="mfaSetup = null">Recommencer</button>
                  </div>
                </div>
              </form>
            </template>
          </section>

          <section v-if="can('ACCOUNT_USER') || mustChangePassword" class="panel">
            <div class="panel-head">
              <div>
                <h2>Mot de passe</h2>
                <span>Modification de la session courante</span>
              </div>
              <button class="primary-button" @click="changePassword" :disabled="!isPasswordChangeReady" :title="isPasswordChangeReady ? '' : passwordChangeHelp">Changer</button>
            </div>
            <p v-if="mustChangePassword" class="form-warning password-required-note">Ce compte utilise un mot de passe temporaire. Choisis un nouveau mot de passe pour continuer.</p>
            <div class="password-grid">
              <label>
                Mot de passe actuel
                <span class="password-input-wrap">
                  <input
                    v-model="passwordForm.currentPassword"
                    :type="passwordInputType('currentPassword')"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="password-eye"
                    :class="{ active: passwordVisibility.currentPassword }"
                    :aria-label="passwordVisibility.currentPassword ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'"
                    @click="togglePasswordVisibility('currentPassword')"
                  >
                    <span class="eye-icon" aria-hidden="true"></span>
                  </button>
                </span>
              </label>
              <label class="field-toggle">
                Sessions
                <span class="check-label">
                  <input type="checkbox" v-model="passwordForm.revokeOtherSessions" />
                  Révoquer les sessions existantes
                </span>
              </label>
              <label>
                Nouveau mot de passe
                <span class="password-input-wrap">
                  <input
                    v-model="passwordForm.newPassword"
                    :type="passwordInputType('newPassword')"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="password-eye"
                    :class="{ active: passwordVisibility.newPassword }"
                    :aria-label="passwordVisibility.newPassword ? 'Masquer le nouveau mot de passe' : 'Afficher le nouveau mot de passe'"
                    @click="togglePasswordVisibility('newPassword')"
                  >
                    <span class="eye-icon" aria-hidden="true"></span>
                  </button>
                </span>
              </label>
              <label>
                Confirmation
                <span class="password-input-wrap">
                  <input
                    v-model="passwordForm.confirmPassword"
                    :type="passwordInputType('confirmPassword')"
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    class="password-eye"
                    :class="{ active: passwordVisibility.confirmPassword }"
                    :aria-label="passwordVisibility.confirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'"
                    @click="togglePasswordVisibility('confirmPassword')"
                  >
                    <span class="eye-icon" aria-hidden="true"></span>
                  </button>
                </span>
              </label>
              <div class="password-strength" aria-live="polite">
                <div class="password-strength-head">
                  <span>Contraintes du mot de passe</span>
                  <strong>{{ passwordStrength }}/5</strong>
                </div>
                <div class="password-bars" role="meter" aria-label="Contraintes du mot de passe" aria-valuemin="0" aria-valuemax="5" :aria-valuenow="passwordStrength">
                  <span
                    v-for="(rule, index) in passwordRequirements"
                    :key="rule.key"
                    :class="{ active: index < passwordStrength }"
                    :title="rule.label"
                  ></span>
                </div>
                <small>{{ passwordStrength === 5 ? 'Toutes les contraintes sont remplies' : passwordRequirements.filter(rule => !rule.valid).map(rule => rule.label).join(' - ') }}</small>
              </div>
              <div
                class="password-confirmation"
                :class="{ valid: isPasswordConfirmationValid, empty: !passwordForm.confirmPassword }"
              >
                <span class="rule-icon">{{ isPasswordConfirmationValid ? '✓' : '' }}</span>
                {{ passwordForm.confirmPassword ? 'Confirmation identique' : 'Confirmez le nouveau mot de passe' }}
              </div>
            </div>
            <p class="form-help password-action-help" :class="{ ready: isPasswordChangeReady }" aria-live="polite">{{ passwordChangeHelp }}</p>
          </section>

          <section v-if="!mustChangePassword && (canCreateUsers || canAdminUsers)" class="panel">
            <div class="panel-head">
              <div>
                <h2>Administration utilisateurs</h2>
                <span>{{ authUsersPage.total || authUsers.length }} comptes</span>
              </div>
              <button class="ghost-button" @click="loadAuthAdministration">Actualiser</button>
            </div>
            <div v-if="canCreateUsers" class="form-grid compact user-admin-grid">
              <label>
                Identifiant
                <input v-model="userAdminForm.username" />
              </label>
              <label>
                Nom affiché
                <input v-model="userAdminForm.displayName" />
              </label>
              <label>
                Email
                <input v-model="userAdminForm.email" type="email" />
              </label>
              <label class="field-toggle">
                Rôles
                <span v-for="role in visibleAuthRoles" :key="role.code" class="check-label">
                  <input
                    type="checkbox"
                    :value="role.code"
                    :checked="userAdminForm.roles.includes(role.code)"
                    @change="toggleUserAdminRole(role.code, $event.target.checked)"
                  />
                  {{ roleLabel(role.code) }}
                </span>
              </label>
            </div>
            <div v-if="canCreateUsers" class="form-actions">
              <button class="primary-button" @click="createAuthUser">Créer avec mot de passe temporaire</button>
              <button class="ghost-button" @click="resetUserAdminForm">Réinitialiser</button>
            </div>
            <p v-if="generatedTemporaryPassword" class="success-note temporary-password-note">
              <span>Mot de passe temporaire: <strong>{{ generatedTemporaryPassword }}</strong></span>
              <button
                class="action-button copy-button"
                type="button"
                @click="copyTemporaryPassword"
                aria-label="Copier le mot de passe temporaire"
                title="Copier le mot de passe temporaire"
              >
                <svg aria-hidden="true"><use href="#icon-copy"></use></svg>
              </button>
            </p>
            <div v-if="canAdminUsers && editingAuthUserId" class="inline-editor auth-user-editor">
              <div class="inline-editor-head">
                <div>
                  <strong>Modifier les rôles</strong>
                  <span>{{ authUserEditForm.displayName || authUserEditForm.username }}</span>
                </div>
                <button class="ghost-button" type="button" @click="cancelEditAuthUser">Fermer</button>
              </div>
              <div class="form-grid compact user-admin-grid">
                <label>
                  Identifiant
                  <input v-model="authUserEditForm.username" disabled />
                </label>
                <label>
                  Nom affiché
                  <input v-model="authUserEditForm.displayName" disabled />
                </label>
                <label>
                  Email
                  <input v-model="authUserEditForm.email" type="email" disabled />
                </label>
                <label class="field-toggle">
                  Rôles
                  <span v-for="role in visibleAuthRoles" :key="role.code" class="check-label">
                    <input
                      type="checkbox"
                      :value="role.code"
                      :checked="authUserEditForm.roles.includes(role.code)"
                      @change="toggleAuthUserEditRole(role.code, $event.target.checked)"
                    />
                    {{ roleLabel(role.code) }}
                  </span>
                </label>
              </div>
              <div class="form-actions">
                <button class="primary-button" type="button" @click="saveAuthUserRoles">Enregistrer les rôles</button>
                <button class="ghost-button" type="button" @click="cancelEditAuthUser">Annuler</button>
              </div>
            </div>
            <div v-if="canAdminUsers" class="api-form account-search">
              <input v-model="authUserSearch" placeholder="Rechercher un utilisateur" @keyup.enter="loadAuthAdministration" />
              <button @click="loadAuthAdministration">Rechercher</button>
            </div>
            <div v-if="canAdminUsers" class="attendance-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôles</th>
                    <th>Statut</th>
                    <th class="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in authUsers" :key="user.id">
                    <td>
                      <div class="auth-user-identity">
                        <span class="auth-user-avatar" aria-hidden="true">
                          <img v-if="authUserAvatarUrl(user)" :src="authUserAvatarUrl(user)" alt="" />
                          <span v-else>{{ authUserInitials(user) }}</span>
                        </span>
                        <span class="auth-user-copy">
                          <strong>{{ user.displayName || user.username }}</strong>
                          <small class="muted">{{ user.username }}</small>
                        </span>
                      </div>
                    </td>
                    <td>{{ user.email }}</td>
                    <td>
                      <div class="role-badges">
                        <span v-for="role in (user.roles || [])" :key="role" :class="roleBadgeClass(role)">
                          {{ roleLabel(role) }}
                        </span>
                        <span v-if="!(user.roles || []).length" class="muted">Aucun rôle</span>
                      </div>
                    </td>
                    <td>{{ user.active ? 'Actif' : 'Inactif' }}</td>
                    <td>
                      <div class="row-actions">
                        <button class="action-button" @click="startEditAuthUser(user)" :aria-label="'Modifier les rôles de ' + (user.displayName || user.username)" :title="'Modifier les rôles de ' + (user.displayName || user.username)">
                          <svg aria-hidden="true"><use href="#icon-edit"></use></svg>
                        </button>
                        <button class="action-button" @click="resetAuthUserPassword(user)" :aria-label="'Réinitialiser le mot de passe de ' + (user.displayName || user.username)" :title="'Réinitialiser le mot de passe de ' + (user.displayName || user.username)">
                          <svg aria-hidden="true"><use href="#icon-key"></use></svg>
                        </button>
                        <button v-if="user.active" class="action-button warning" @click="setAuthUserActive(user, false)" :aria-label="'Désactiver ' + (user.displayName || user.username)" :title="'Désactiver ' + (user.displayName || user.username)">
                          <svg aria-hidden="true"><use href="#icon-user-x"></use></svg>
                        </button>
                        <button v-else class="action-button success" @click="setAuthUserActive(user, true)" :aria-label="'Activer ' + (user.displayName || user.username)" :title="'Activer ' + (user.displayName || user.username)">
                          <svg aria-hidden="true"><use href="#icon-user-check"></use></svg>
                        </button>
                        <button class="action-button danger" @click="deleteAuthUser(user)" :aria-label="'Supprimer ' + (user.displayName || user.username)" :title="'Supprimer ' + (user.displayName || user.username)">
                          <svg aria-hidden="true"><use href="#icon-trash"></use></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="authUsers.length === 0">
                    <td colspan="5" class="muted">Aucun utilisateur trouvé.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'settings' && !mustChangePassword && canAccessSettings" class="view-stack">
          <section v-if="can('CONFIG_FINANCIALS')" class="panel lifecycle-panel">
            <div>
              <span class="eyebrow">Cycle comptable</span>
              <h2 class="lifecycle-title">Saison {{ state.settings.year }} <span :class="['year-pill', yearStatus.toLowerCase()]">{{ yearStatusLabel }}</span></h2>
              <p v-if="yearStatus === 'OPEN'" class="muted">Configuration, présences, dépenses et documents modifiables.</p>
              <p v-else-if="yearStatus === 'REVIEWED'" class="muted">Configuration verrouillée ; présences, dépenses et émission encore disponibles.</p>
              <p v-else class="muted">Année définitivement clôturée ; toutes les données annuelles sont en lecture seule.</p>
            </div>
            <div class="lifecycle-actions">
              <button v-if="yearStatus === 'OPEN'" class="primary-button" @click="updateYearStatus('REVIEWED')">Passer en revue</button>
              <button v-if="yearStatus === 'REVIEWED'" class="ghost-button" @click="updateYearStatus('OPEN')">Rouvrir</button>
              <button v-if="yearStatus === 'REVIEWED'" class="danger-button" @click="updateYearStatus('CLOSED')">Clôturer définitivement</button>
              <span v-if="yearStatus === 'CLOSED'" class="status-pill closed">Clôturée</span>
            </div>
          </section>
          <section v-if="can('CONFIG_FINANCIALS')" class="panel">
            <div class="panel-head">
              <div>
                <h2>Nouvelle année comptable</h2>
                <span>Copier groupes, adhésions, cours, tarifs et trimestres sans modifier l'année source</span>
              </div>
            </div>
            <div class="api-form">
              <label>
                Année source
                <input type="number" v-model.number="copySourceYear" min="2000" max="2100" />
              </label>
              <strong>→ {{ state.settings.year }}</strong>
              <button class="primary-button" @click="copyAnnualConfiguration">Copier la configuration</button>
            </div>
            <p class="muted">La copie est autorisée uniquement si l'année cible ne contient encore aucun groupe ni cours individuel.</p>
          </section>
          <section v-if="can('CONFIG_TEACHER')" class="panel">
            <div class="panel-head">
              <div>
                <h2>Professeurs</h2>
                <span>Création et mise à jour des intervenants</span>
              </div>
              <button class="ghost-button" @click="startNewTeacher">Nouveau professeur</button>
            </div>
            <div v-if="teacherFormOpen" class="collapsible-editor compact-editor">
            <div class="form-grid">
              <label>
                Prénom
                <input v-model="teacherForm.firstName" />
              </label>
              <label>
                Nom
                <input v-model="teacherForm.lastName" />
              </label>
              <label>
                Instrument
                <input v-model="teacherForm.instrument" />
              </label>
              <label class="field-toggle">
                Statut
                <span class="check-label">
                  <input type="checkbox" v-model="teacherForm.active" />
                  Actif
                </span>
              </label>
            </div>
            <div class="form-actions">
              <button class="primary-button" @click="saveTeacher">
                {{ editingTeacherId ? 'Enregistrer' : 'Créer le professeur' }}
              </button>
              <button class="ghost-button" @click="resetTeacherForm">Annuler</button>
            </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Professeur</th>
                  <th>Instrument</th>
                  <th>Statut</th>
                  <th class="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="teacher in state.teachers" :key="teacher.id">
                  <td><strong>{{ fullName(teacher) }}</strong></td>
                  <td>{{ teacher.instrument }}</td>
                  <td>{{ teacher.active === false ? 'Inactif' : 'Actif' }}</td>
                  <td class="row-actions">
                    <button class="action-button" @click="editTeacher(teacher)" :aria-label="'Modifier ' + fullName(teacher)" :title="'Modifier ' + fullName(teacher)">
                      <svg aria-hidden="true"><use href="#icon-edit"></use></svg>
                    </button>
                    <button
                      :class="['action-button', teacherUsageCount(teacher.id) > 0 ? 'warning' : 'danger']"
                      @click="deleteTeacher(teacher.id)"
                      :disabled="teacherUsageCount(teacher.id) > 0 && teacher.active === false"
                      :aria-label="teacherDeleteActionLabel(teacher)"
                      :title="teacherDeleteActionLabel(teacher)"
                    >
                      <svg aria-hidden="true"><use :href="teacherUsageCount(teacher.id) > 0 ? '#icon-user-x' : '#icon-trash'"></use></svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section v-if="can('CONFIG_FINANCIALS')" class="panel">
            <div class="panel-head">
              <div>
                <h2>Paramètres financiers</h2>
                <span>Configuration numérique</span>
              </div>
              <button class="primary-button" @click="saveSettings">Enregistrer</button>
            </div>
            <div class="form-grid">
              <label>
                Taux horaire par défaut
                <input type="number" v-model.number="state.settings.teacherHourlyRate" min="0" step="0.5" />
              </label>
              <label>
                Cotisation groupe annuelle
                <input type="number" v-model.number="state.settings.groupMembershipFee" min="0" step="1" />
              </label>
              <label>
                Durée d’un cours individuel (heures)
                <input type="number" v-model.number="state.settings.individualCourseHours" min="0.01" max="24" step="0.05" :disabled="yearStatus !== 'OPEN'" />
              </label>
              <label>
                Durée d’un atelier (heures)
                <input type="number" v-model.number="state.settings.workshopHours" min="0.01" max="24" step="0.05" :disabled="yearStatus !== 'OPEN'" />
              </label>

            </div>
          </section>

          <section v-if="can('CONFIG_TERMS')" class="panel">
            <div class="panel-head">
              <h2>Trimestres</h2>
              <span>Semaines numériques modifiables</span>
            </div>
            <div class="term-grid">
              <article v-for="term in state.settings.terms" :key="term.id">
                <strong class="term-grid-name">{{ term.name }}</strong>
                <label>Début <input type="number" v-model.number="term.startWeek" min="1" max="53" /></label>
                <label>Fin <input type="number" v-model.number="term.endWeek" min="1" max="53" /></label>
              </article>
            </div>
            <div class="form-actions">
              <button class="primary-button" @click="saveSettings">Enregistrer les trimestres</button>
            </div>
          </section>

          <section v-if="can('CONFIG_HOLIDAYS')" class="panel">
            <div class="panel-head">
              <div>
                <h2>Vacances scolaires</h2>
                <span>Semaines sans cours prévues, les présences restent saisissables</span>
              </div>
            </div>
            <div class="bucket-picker">
              <div class="bucket-source">
                <div class="bucket-add">
                  <select v-model="holidayWeekToAdd">
                    <option value="">Choisir une semaine</option>
                    <option v-for="week in availableHolidayWeeks" :key="week" :value="week">Semaine {{ week }}</option>
                  </select>
                  <button class="icon-button" @click="addHolidayWeek" :disabled="!holidayWeekToAdd">+</button>
                </div>
                <small>{{ availableHolidayWeeks.length }} semaines disponibles</small>
              </div>
              <div class="bucket-target">
                <h3>Semaines de vacances</h3>
                <div class="bucket-list holiday-bucket">
                  <article v-for="week in selectedHolidayWeeks" :key="week" class="bucket-item holiday-item">
                    <span>Semaine {{ week }}</span>
                    <button @click="removeHolidayWeek(week)" :aria-label="'Retirer la semaine ' + week"><svg aria-hidden="true"><use href="#icon-x"></use></svg></button>
                  </article>
                  <p v-if="!selectedHolidayWeeks.length" class="empty-state">Aucune semaine de vacances</p>
                </div>
              </div>
            </div>
          </section>

          <section v-if="can('CONFIG_AUDIT')" class="panel">
            <div class="panel-head">
              <div><h2>Journal d’audit</h2><span>Événements comptables immuables</span></div>
              <button class="ghost-button" @click="loadAuditEvents">Actualiser</button>
            </div>
            <div v-if="auditEvents.length" class="attendance-table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Utilisateur</th><th>Ressource</th><th>Action</th></tr></thead>
                <tbody>
                  <tr v-for="event in auditEvents" :key="event.id">
                    <td>{{ new Date(event.createdAt).toLocaleString('fr-FR') }}</td>
                    <td>{{ auditUserLabel(event) }}</td>
                    <td>{{ event.entityType }}</td>
                    <td>{{ auditActionLabel(event.action) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="muted">Cliquez sur « Actualiser » pour charger les derniers événements.</p>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Backend</h2>
              <span>Quarkus / Kotlin</span>
            </div>
            <div class="api-form">
              <input v-model="apiBase" />
              <input type="number" v-model.number="accountingYearInput" min="2000" max="2100" />
              <button @click="saveApiBase">Reconnecter</button>
            </div>
          </section>
        </section>
        <div class="toast-stack" aria-live="polite">
          <div v-for="toast in toasts" :key="toast.id" :class="['toast', toast.type]">
            <span class="toast-badge" aria-hidden="true"><svg><use :href="toast.type === 'success' ? '#icon-check' : toast.type === 'error' ? '#icon-x' : '#icon-warning'"></use></svg></span>
            <span>{{ toast.message }}</span>
          </div>
        </div>
      </section>
      <nav class="tab-bar" aria-label="Navigation mobile">
        <button
          v-for="tab in mobileTabs"
          :key="tab.view"
          type="button"
          :class="{ active: activeView === tab.view && !mobileMenuOpen }"
          :aria-current="activeView === tab.view ? 'page' : null"
          @click="openNavView(tab.view)"
        >
          <svg aria-hidden="true"><use :href="'#icon-nav-' + tab.view"></use></svg>
          {{ tab.label }}
        </button>
        <button
          type="button"
          :class="['tab-more', { active: mobileMenuOpen }]"
          aria-controls="app-menu"
          :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg aria-hidden="true"><use href="#icon-more"></use></svg>
          Plus
        </button>
      </nav>
      <avatar-crop-dialog :file="avatarCropFile" :busy="avatarUploading" :error="avatarUploadError" @cancel="cancelAvatarCrop" @confirm="uploadAvatar"></avatar-crop-dialog>
    </main>
  `,
});

app.component("totp-code-input", TotpCodeInput);
app.component("avatar-crop-dialog", AvatarCropDialog);
app.mount("#app");
