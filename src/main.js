import { createApp, computed, reactive, ref } from "./vendor/vue.esm-browser.prod.js";

const API_BASE = localStorage.getItem("compta-zik-api") || "https://compta-zik.local/api";
const ACCOUNTING_YEAR = Number(localStorage.getItem("compta-zik-year")) || new Date().getFullYear();
const DEFAULT_TEACHER_HOURLY_RATE = 54;
const DEFAULT_GROUP_MEMBERSHIP_FEE = 30;
const COURSE_DURATION_HOURS = 0.5;
const WORKSHOP_DURATION_HOURS = 1.25;
const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const TIME_WINDOWS = [
  { start: "11:30", end: "14:00" },
  { start: "16:30", end: "18:00" },
];
const FRENCH_DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
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

const demoState = {
  settings: {
    year: ACCOUNTING_YEAR,
    teacherHourlyRate: DEFAULT_TEACHER_HOURLY_RATE,
    groupMembershipFee: DEFAULT_GROUP_MEMBERSHIP_FEE,
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

function normalizeSnapshot(snapshot) {
  const settings = snapshot.settings || {};
  return {
    ...snapshot,
    settings: {
      ...settings,
      teacherHourlyRate: Number(settings.teacherHourlyRate) || DEFAULT_TEACHER_HOURLY_RATE,
      groupMembershipFee: Number(settings.groupMembershipFee) || DEFAULT_GROUP_MEMBERSHIP_FEE,
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
    attendance: (snapshot.attendance || []).map((entry) => ({
      ...entry,
      entityType: apiAttendanceTypeToUi(entry.entityType),
    })),
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
      termId: body.termId,
      week: body.week,
      entityType: uiAttendanceTypeToApi(body.entityType),
      entityId: body.entityId,
      present: body.present,
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

function formatDate(value) {
  if (!value) return "";
  return SHORT_DATE.format(new Date(`${value}T00:00:00`));
}

function categoryLabel(category) {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label || category;
}

function sortByName(items) {
  return [...items].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function buildTimeSlots() {
  return TIME_WINDOWS.flatMap((window) => {
    const slots = [];
    for (let minutes = timeToMinutes(window.start); minutes < timeToMinutes(window.end); minutes += 30) {
      slots.push(minutesToTime(minutes));
    }
    return slots;
  });
}

function firstDayOfBusinessWeek(year, week) {
  if (week === 1) return new Date(year, 0, 1);
  const date = new Date(year, 0, 1);
  const day = date.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday + ((week - 2) * 7));
  return date;
}

const app = createApp({
  setup() {
    const state = reactive(structuredClone(demoState));
    const selectedTermId = ref("t1");
    const activeView = ref("dashboard");
    const apiStatus = ref("mode demo");
    const currentUser = ref(null);
    const apiBase = ref(API_BASE);
    const accountingYearInput = ref(state.settings.year);
    const search = ref("");
    const groupSearch = ref("");
    const selectedGroupId = ref("band-1");
    const musicianBandToAddId = ref("");
    const groupMemberToAddId = ref("");
    const holidayWeekToAdd = ref("");
    const preparedStudentInvoices = ref(false);
    const studentInvoiceDocuments = ref([]);
    const studentInvoiceSummaryDocument = ref(null);
    const teacherInvoiceRequestDocuments = ref([]);
    const selectedImportFile = ref(null);
    const toasts = ref([]);
    const editingMusicianId = ref(null);
    const editingTeacherId = ref(null);
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
    });
    const expenseForm = reactive({
      date: `${state.settings.year}-01-01`,
      category: "EQUIPMENT",
      label: "",
      amount: 0,
      notes: "",
    });

    const selectedTerm = computed(() => state.settings.terms.find((term) => term.id === selectedTermId.value) || state.settings.terms[0]);
    const isFirstTerm = computed(() => selectedTerm.value?.id === state.settings.terms[0]?.id);
    const weeks = computed(() => weeksForTerm(selectedTerm.value));
    const allYearWeeks = computed(() => Array.from({ length: 53 }, (_, index) => index + 1));
    const workshopBands = computed(() => state.bands.filter((band) => band.type === "workshop"));
    const independentBands = computed(() => state.bands.filter((band) => band.type === "independent"));
    const musiciansById = computed(() => Object.fromEntries(state.musicians.map((musician) => [musician.id, musician])));
    const activeMusicians = computed(() => state.musicians.filter((musician) => musician.active !== false));
    const teachersById = computed(() => Object.fromEntries(state.teachers.map((teacher) => [teacher.id, teacher])));
    const coursesById = computed(() => Object.fromEntries(state.individualCourses.map((course) => [course.id, course])));
    const bandsById = computed(() => Object.fromEntries(state.bands.map((band) => [band.id, band])));
    const timeSlots = computed(() => buildTimeSlots());

    const filteredMusicians = computed(() => {
      const q = search.value.trim().toLowerCase();
      const musicians = sortByName(activeMusicians.value);
      if (!q) return musicians;
      return musicians.filter((musician) => fullName(musician).toLowerCase().includes(q));
    });

    const selectedGroup = computed(() => state.bands.find((band) => band.id === selectedGroupId.value) || state.bands[0]);

    const filteredGroupMusicians = computed(() => {
      const q = groupSearch.value.trim().toLowerCase();
      const musicians = sortByName(activeMusicians.value);
      if (!q) return musicians;
      return musicians.filter((musician) => fullName(musician).toLowerCase().includes(q));
    });

    const musicianSelectedBands = computed(() => independentBands.value
      .filter((band) => musicianForm.bandIds.includes(band.id))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")));

    const musicianAvailableBands = computed(() => independentBands.value
      .filter((band) => !musicianForm.bandIds.includes(band.id))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")));

    const selectedGroupMembers = computed(() => sortByName(
      groupForm.memberIds.map((id) => musiciansById.value[id]).filter(Boolean),
    ));

    const availableGroupMembers = computed(() => {
      const q = groupSearch.value.trim().toLowerCase();
      const musicians = sortByName(activeMusicians.value.filter((musician) => !groupForm.memberIds.includes(musician.id)));
      if (!q) return musicians;
      return musicians.filter((musician) => fullName(musician).toLowerCase().includes(q));
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

    const musicianRows = computed(() => filteredMusicians.value.map((musician) => {
      return buildMusicianAccountingRow(musician);
    }));

    const studentBillingRows = computed(() => state.musicians.map((musician) => {
      return buildMusicianAccountingRow(musician);
    }));

    function buildMusicianAccountingRow(musician) {
      const course = state.individualCourses.find((item) => item.musicianId === musician.id);
      const bands = state.bands.filter((band) => band.memberIds.includes(musician.id));
      const courseCount = course ? countPresences("individualCourse", course.id) : 0;
      const courseDue = course ? courseCount * COURSE_DURATION_HOURS * state.settings.teacherHourlyRate : 0;
      const groupFee = isFirstTerm.value && bands.length > 0 ? state.settings.groupMembershipFee : 0;
      return {
        musician,
        course,
        bands,
        courseCount,
        courseDue,
        groupFee,
        totalDue: courseDue + groupFee,
      };
    }

    const attendanceCourseRows = computed(() => state.individualCourses
      .map((course) => {
        const musician = musiciansById.value[course.musicianId];
        const teacher = teachersById.value[course.teacherId];
        return { course, musician, teacher, count: countPresences("individualCourse", course.id) };
      })
      .filter((row) => row.musician && row.teacher && (isActiveCourse(row.course) || hasTermAttendance("individualCourse", row.course.id)))
      .sort((a, b) => `${a.course.weekday} ${a.course.startTime} ${fullName(a.musician)}`.localeCompare(`${b.course.weekday} ${b.course.startTime} ${fullName(b.musician)}`, "fr")));

    const attendanceWorkshopRows = computed(() => workshopBands.value
      .map((band) => ({ band, teacher: teachersById.value[band.teacherId], count: countPresences("workshop", band.id) }))
      .sort((a, b) => a.band.name.localeCompare(b.band.name, "fr")));

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
        individualHours: individualCount * COURSE_DURATION_HOURS,
        workshopHours: workshopCount * WORKSHOP_DURATION_HOURS,
        totalDue: (individualCount * COURSE_DURATION_HOURS * hourlyRate) + (workshopCount * WORKSHOP_DURATION_HOURS * hourlyRate),
      };
    }));

    const totals = computed(() => {
      const studentBilling = studentBillingRows.value.reduce((sum, row) => sum + row.courseDue, 0);
      const groupFees = studentBillingRows.value.reduce((sum, row) => sum + row.groupFee, 0);
      const teacherDue = teacherRows.value.reduce((sum, row) => sum + row.totalDue, 0);
      const annualExpenses = state.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      return {
        studentBilling,
        groupFees,
        teacherDue,
        annualExpenses,
        subsidy: teacherDue - (studentBilling / 2) - groupFees,
      };
    });

    const expenseRows = computed(() => [...state.expenses].sort((a, b) => (
      String(b.date).localeCompare(String(a.date)) || a.label.localeCompare(b.label, "fr")
    )));

    const expenseTotalsByCategory = computed(() => EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      total: state.expenses
        .filter((expense) => expense.category === category.value)
        .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    })).filter((category) => category.total > 0));

    const currentUserLabel = computed(() => {
      if (apiStatus.value !== "connecté") return "Utilisateur non connecté";
      if (!currentUser.value?.authenticated) return "Utilisateur non identifié";
      return currentUser.value.displayName || currentUser.value.username || "Utilisateur connecté";
    });

    const currentUserDetail = computed(() => {
      if (apiStatus.value !== "connecté") return "";
      if (!currentUser.value?.authenticated) return "Proxy d'authentification absent";
      return currentUser.value.email || currentUser.value.username || "";
    });

    const billableStudentRows = computed(() => studentBillingRows.value.filter((item) => item.totalDue > 0));

    const teacherWeeklyRows = computed(() => state.teachers.flatMap((teacher) => weeks.value.map((week) => {
      const individualCount = state.individualCourses
        .filter((course) => course.teacherId === teacher.id && isPresent("individualCourse", course.id, week))
        .length;
      const workshopCount = workshopBands.value
        .filter((band) => band.teacherId === teacher.id && isPresent("workshop", band.id, week))
        .length;
      const hourlyRate = state.settings.teacherHourlyRate;
      const individualAmount = individualCount * COURSE_DURATION_HOURS * hourlyRate;
      const workshopAmount = workshopCount * WORKSHOP_DURATION_HOURS * hourlyRate;
      return {
        key: `${teacher.id}-${week}`,
        teacher,
        week,
        date: firstDayOfBusinessWeek(state.settings.year, week),
        dateLabel: FRENCH_DATE.format(firstDayOfBusinessWeek(state.settings.year, week)),
        hours: (individualCount * COURSE_DURATION_HOURS) + (workshopCount * WORKSHOP_DURATION_HOURS),
        totalAmount: individualAmount + workshopAmount,
      };
    })).filter((row) => row.totalAmount > 0));

    const teacherBillingSections = computed(() => state.teachers.map((teacher) => {
      const rows = teacherWeeklyRows.value.filter((row) => row.teacher.id === teacher.id);
      return {
        teacher,
        rows,
        totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
        totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0),
      };
    }).filter((section) => section.rows.length > 0));

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

    const scheduleRows = computed(() => {
      return timeSlots.value.map((slot) => ({
        slot,
        days: WEEKDAYS.map((weekday) => {
          const courses = state.individualCourses.filter((item) => (
            isActiveCourse(item)
            && item.weekday === weekday
            && item.startTime === slot
          ));
          return {
            key: `${weekday}-${slot}`,
            teachers: courses.map((course) => teachersById.value[course.teacherId]).filter(Boolean),
            weekday,
            slot,
            courses,
            musicians: courses.map((course) => musiciansById.value[course.musicianId]).filter(Boolean),
            sharedSlot: courses.some((course) => course.sharedSlot),
          };
        }),
      }));
    });

    function attendanceFor(entityType, entityId, week) {
      return attendanceIndex.value.get(`${selectedTerm.value.id}:${entityType}:${entityId}:${week}`);
    }

    function isPresent(entityType, entityId, week) {
      return Boolean(attendanceFor(entityType, entityId, week)?.present);
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
      const week = Number(holidayWeekToAdd.value);
      if (!week || isHolidayWeek(week)) return;
      state.settings.schoolHolidayWeeks = [...selectedHolidayWeeks.value, week].sort((a, b) => a - b);
      holidayWeekToAdd.value = availableHolidayWeeks.value[0] || "";
      saveSettings();
    }

    function removeHolidayWeek(week) {
      state.settings.schoolHolidayWeeks = selectedHolidayWeeks.value.filter((item) => item !== week);
      holidayWeekToAdd.value = availableHolidayWeeks.value[0] || "";
      saveSettings();
    }

    async function saveSettings() {
      const payload = {
        year: state.settings.year,
        teacherHourlyRate: Number(state.settings.teacherHourlyRate) || 0,
        groupMembershipFee: Number(state.settings.groupMembershipFee) || 0,
        schoolHolidayWeeks: selectedHolidayWeeks.value,
        terms: state.settings.terms.map((term, index) => ({
          id: term.id,
          name: term.name,
          startWeek: Number(term.startWeek) || 1,
          endWeek: Number(term.endWeek) || 1,
          displayOrder: Number(term.displayOrder) || index + 1,
        })),
      };

      const savedSettings = await requestResource("PUT", `accounting-years/${state.settings.year}/settings`, payload, {
        successMessage: "Configuration enregistrée",
        errorMessage: "Configuration conservée en local",
      });
      if (savedSettings) {
        state.settings = savedSettings;
        selectedTermId.value = state.settings.terms[0]?.id || "";
      }
    }

    function toggleAttendance(entityType, entityId, week) {
      const existing = attendanceFor(entityType, entityId, week);
      if (existing) {
        existing.present = !existing.present;
        saveAttendance(existing);
        return;
      }
      const entry = {
        id: createId(),
        termId: selectedTerm.value.id,
        week,
        entityType,
        entityId,
        present: true,
      };
      state.attendance.push(entry);
      saveAttendance(entry);
    }

    function resetMusicianForm() {
      editingMusicianId.value = null;
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
      musicianBandToAddId.value = musicianAvailableBands.value[0]?.id || "";
    }

    function resetTeacherForm() {
      editingTeacherId.value = null;
      Object.assign(teacherForm, {
        firstName: "",
        lastName: "",
        instrument: "",
        active: true,
      });
    }

    function editTeacher(teacher) {
      editingTeacherId.value = teacher.id;
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

    async function saveTeacher() {
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
      if (teacherUsageCount(teacherId) > 0) return;
      state.teachers = state.teachers.filter((teacher) => teacher.id !== teacherId);
      await requestResource("DELETE", `teachers/${teacherId}`, null, {
        successMessage: "Professeur supprimé",
        errorMessage: "Professeur supprimé localement",
      });
      if (editingTeacherId.value === teacherId) resetTeacherForm();
    }

    function editMusician(musician) {
      const course = state.individualCourses.find((item) => item.musicianId === musician.id);
      const workshopBand = workshopBands.value.find((band) => band.memberIds.includes(musician.id));
      editingMusicianId.value = musician.id;
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
      musicianBandToAddId.value = musicianAvailableBands.value[0]?.id || "";
      activeView.value = "people";
    }

    function addMusicianBand() {
      if (!musicianBandToAddId.value || musicianForm.bandIds.includes(musicianBandToAddId.value)) return;
      musicianForm.bandIds = [...musicianForm.bandIds, musicianBandToAddId.value];
      musicianBandToAddId.value = musicianAvailableBands.value[0]?.id || "";
    }

    function removeMusicianBand(bandId) {
      musicianForm.bandIds = musicianForm.bandIds.filter((id) => id !== bandId);
      musicianBandToAddId.value = musicianAvailableBands.value[0]?.id || "";
    }

    function slotTakenByOtherMusician() {
      if (!musicianForm.hasIndividualCourse) return false;
      if (musicianForm.sharedSlot) {
        return false;
      }
      return state.individualCourses.some((course) => (
        course.id !== musicianForm.courseId
        && isActiveCourse(course)
        && course.weekday === musicianForm.weekday
        && course.startTime === musicianForm.startTime
        && !course.sharedSlot
      ));
    }

    function isSlotDisabled(slot) {
      if (musicianForm.sharedSlot) {
        return false;
      }
      return state.individualCourses.some((course) => (
        course.id !== musicianForm.courseId
        && isActiveCourse(course)
        && course.weekday === musicianForm.weekday
        && course.startTime === slot
        && !course.sharedSlot
      ));
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

      resetMusicianForm();
    }

    async function deleteMusician(musicianId) {
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
        memberIds: uniqueIds(band.memberIds),
      });
      groupMemberToAddId.value = availableGroupMembers.value[0]?.id || "";
    }

    function resetGroupForm() {
      selectedGroupId.value = "";
      Object.assign(groupForm, {
        name: "",
        type: "independent",
        teacherId: state.teachers[0]?.id || "",
        weekday: "Mardi",
        memberIds: [],
      });
      groupMemberToAddId.value = availableGroupMembers.value[0]?.id || "";
    }

    function resetFormsAfterStateLoad() {
      selectedTermId.value = state.settings.terms[0]?.id || "";
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
      if (!groupForm.name.trim()) return;
      const existing = selectedGroupId.value ? state.bands.find((band) => band.id === selectedGroupId.value) : null;
      const teacherId = teachersById.value[groupForm.teacherId]
        ? groupForm.teacherId
        : state.teachers[0]?.id;
      const payload = {
        name: groupForm.name.trim(),
        type: groupForm.type,
        teacherId: groupForm.type === "workshop" ? teacherId : undefined,
        weekday: groupForm.type === "workshop" ? groupForm.weekday : undefined,
        memberIds: uniqueIds(groupForm.memberIds),
      };
      const savedBand = await requestResource(
        existing ? "PUT" : "POST",
        existing ? `bands/${existing.id}` : "bands",
        existing ? { ...payload, id: existing.id } : payload,
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
      if (!existing) {
        state.bands.push(band);
        selectedGroupId.value = band.id;
      }
    }

    async function deleteGroup(groupId) {
      state.bands = state.bands.filter((band) => band.id !== groupId);
      state.attendance = state.attendance.filter((entry) => !(entry.entityType === "workshop" && entry.entityId === groupId));
      await requestResource("DELETE", `bands/${groupId}`, null, {
        successMessage: "Groupe supprimé",
        errorMessage: "Groupe supprimé localement",
      });
      resetGroupForm();
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
      const deleted = await requestResource("DELETE", `expenses/${expenseId}`, null, {
        successMessage: "Dépense supprimée",
        errorMessage: "Dépense non supprimée côté backend",
        preserveApiStatus: true,
      });
      if (deleted === undefined) return;
      state.expenses = state.expenses.filter((expense) => expense.id !== expenseId);
      if (editingExpenseId.value === expenseId) resetExpenseForm();
    }

    function addGroupMember() {
      if (!groupMemberToAddId.value || groupForm.memberIds.includes(groupMemberToAddId.value)) return;
      groupForm.memberIds = uniqueIds([...groupForm.memberIds, groupMemberToAddId.value]);
      groupMemberToAddId.value = availableGroupMembers.value[0]?.id || "";
    }

    function removeGroupMember(musicianId) {
      groupForm.memberIds = uniqueIds(groupForm.memberIds.filter((id) => id !== musicianId));
      groupMemberToAddId.value = availableGroupMembers.value[0]?.id || "";
    }

    async function prepareAllStudentInvoices() {
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

    async function prepareAllTeacherInvoiceRequests() {
      const documents = await requestResource(
        "POST",
        `accounting-years/${state.settings.year}/terms/${selectedTerm.value.id}/teacher-invoice-requests`,
        null,
        {
          successMessage: "Demandes professeurs générées",
          errorMessage: "Demandes professeurs non générées côté backend",
        },
      );
      if (documents) {
        teacherInvoiceRequestDocuments.value = documents;
      }
    }

    function documentDownloadUrl(document) {
      return document?.id ? `${apiBase.value}/documents/${document.id}` : "";
    }

    function documentForMusician(musicianId) {
      return studentInvoiceDocuments.value.find((document) => document.musicianId === musicianId);
    }

    function documentForTeacher(teacherId) {
      return teacherInvoiceRequestDocuments.value.find((document) => document.teacherId === teacherId);
    }

    function showToast(message, type = "success") {
      const id = createId();
      toasts.value = [...toasts.value, { id, message, type }];
      setTimeout(() => {
        toasts.value = toasts.value.filter((toast) => toast.id !== id);
      }, 3600);
    }

    async function requestResource(method, resource, body = null, options = {}) {
      try {
        const response = await fetch(`${apiBase.value}/${resource}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(toApiPayload(resource, body)) : null,
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status} ${errorText}`);
        }
        apiStatus.value = "connecté";
        if (options.successMessage) showToast(options.successMessage, "success");
        if (response.status === 204) return null;
        const contentType = response.headers.get("content-type") || "";
        return contentType.includes("application/json") ? response.json() : null;
      } catch (error) {
        console.warn(`API ${method} ${resource} failed`, error);
        if (!options.preserveApiStatus) apiStatus.value = "mode demo";
        if (options.errorMessage) showToast(options.errorMessage, "warning");
        return undefined;
      }
    }

    async function persistResource(method, resource, body = null) {
      await requestResource(method, resource, body);
    }

    async function saveAttendance(entry) {
      try {
        const response = await fetch(`${apiBase.value}/attendance`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toApiPayload("attendance", entry)),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status} ${errorText}`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const savedEntry = await response.json();
          Object.assign(entry, {
            ...savedEntry,
            entityType: apiAttendanceTypeToUi(savedEntry.entityType),
          });
        }
        apiStatus.value = "connecté";
        showToast("Présence enregistrée", "success");
      } catch (error) {
        console.warn("API PUT attendance failed", error);
        apiStatus.value = "mode demo";
        showToast("Présence conservée en local", "warning");
      }
    }

    async function loadFromApi() {
      try {
        const year = Number(accountingYearInput.value) || new Date().getFullYear();
        localStorage.setItem("compta-zik-year", String(year));
        const response = await fetch(`${apiBase.value}/accounting-years/${year}/snapshot`);
        if (!response.ok) throw new Error("API indisponible");
        const snapshot = await response.json();
        Object.assign(state, normalizeSnapshot(snapshot));
        accountingYearInput.value = state.settings.year;
        resetFormsAfterStateLoad();
        apiStatus.value = "connecté";
        await loadCurrentUser();
        showToast(`Année ${state.settings.year} chargée`, "success");
      } catch {
        apiStatus.value = "mode demo";
        currentUser.value = null;
        showToast("Backend indisponible, mode démo actif", "warning");
      }
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${apiBase.value}/auth/me`);
        if (!response.ok) throw new Error("Utilisateur indisponible");
        currentUser.value = await response.json();
      } catch (error) {
        console.warn("API GET auth/me failed", error);
        currentUser.value = { authenticated: false };
      }
    }

    function saveApiBase() {
      localStorage.setItem("compta-zik-api", apiBase.value);
      localStorage.setItem("compta-zik-year", String(accountingYearInput.value));
      loadFromApi();
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

    async function exportData() {
      try {
        const response = await fetch(`${apiBase.value}/data/export`);
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
        apiStatus.value = "mode demo";
        showToast("Export JSON indisponible côté backend", "warning");
      }
    }

    function selectImportFile(event) {
      selectedImportFile.value = event.target.files?.[0] || null;
    }

    async function importData() {
      if (!selectedImportFile.value) return;
      const confirmed = window.confirm("L'import remplace les données métier du serveur cible. Continuer ?");
      if (!confirmed) return;
      try {
        const payload = JSON.parse(await selectedImportFile.value.text());
        const result = await requestResource("POST", "data/import", payload, {
          successMessage: "Import JSON terminé",
          errorMessage: "Import JSON refusé côté backend",
        });
        if (result) {
          await loadFromApi();
          selectedImportFile.value = null;
        }
      } catch (error) {
        console.warn("Import JSON failed", error);
        showToast("Fichier JSON invalide", "error");
      }
    }

    selectGroup(selectedGroupId.value);
    loadFromApi();

    return {
      state,
      activeView,
      selectedTermId,
      selectedTerm,
      isFirstTerm,
      weeks,
      allYearWeeks,
      apiBase,
      accountingYearInput,
      apiStatus,
      currentUserLabel,
      currentUserDetail,
      search,
      groupSearch,
      selectedGroupId,
      selectedGroup,
      musicianBandToAddId,
      groupMemberToAddId,
      holidayWeekToAdd,
      preparedStudentInvoices,
      studentInvoiceDocuments,
      studentInvoiceSummaryDocument,
      teacherInvoiceRequestDocuments,
      selectedImportFile,
      musicianForm,
      teacherForm,
      groupForm,
      expenseForm,
      editingMusicianId,
      editingTeacherId,
      editingExpenseId,
      workshopBands,
      independentBands,
      musiciansById,
      teachersById,
      coursesById,
      bandsById,
      activeMusicians,
      timeSlots,
      scheduleRows,
      musicianRows,
      billableStudentRows,
      attendanceCourseRows,
      attendanceWorkshopRows,
      filteredGroupMusicians,
      musicianSelectedBands,
      musicianAvailableBands,
      selectedGroupMembers,
      availableGroupMembers,
      selectedHolidayWeeks,
      availableHolidayWeeks,
      toasts,
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
      formatDate,
      categoryLabel,
      fullName,
      countPresences,
      memberCount,
      isPresent,
      toggleAttendance,
      isHolidayWeek,
      addHolidayWeek,
      removeHolidayWeek,
      saveSettings,
      resetMusicianForm,
      editMusician,
      addMusicianBand,
      removeMusicianBand,
      saveMusician,
      deleteMusician,
      resetTeacherForm,
      editTeacher,
      saveTeacher,
      deleteTeacher,
      teacherUsageCount,
      selectGroup,
      resetGroupForm,
      saveGroup,
      deleteGroup,
      addGroupMember,
      removeGroupMember,
      resetExpenseForm,
      editExpense,
      saveExpense,
      deleteExpense,
      prepareAllStudentInvoices,
      prepareAllTeacherInvoiceRequests,
      documentDownloadUrl,
      documentForMusician,
      documentForTeacher,
      isSlotDisabled,
      slotTakenByOtherMusician,
      saveApiBase,
      courseLabel,
      invoiceText,
      teacherRequestText,
      signatureWeekDate,
      signatureWeekNumber,
      printPage,
      exportData,
      selectImportFile,
      importData,
    };
  },
  template: `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-mark" src="/src/assets/logo.png" alt="" aria-hidden="true" />
          <div>
            <strong>Compta Zik</strong>
            <small>{{ state.settings.year }}</small>
          </div>
        </div>
        <nav class="nav">
          <button :class="{ active: activeView === 'dashboard' }" @click="activeView = 'dashboard'">Tableau de bord</button>
          <button :class="{ active: activeView === 'attendance' }" @click="activeView = 'attendance'">Présences</button>
          <button :class="{ active: activeView === 'signatures' }" @click="activeView = 'signatures'">Émargement</button>
          <button :class="{ active: activeView === 'people' }" @click="activeView = 'people'">Musiciens</button>
          <button :class="{ active: activeView === 'groups' }" @click="activeView = 'groups'">Groupes</button>
          <button :class="{ active: activeView === 'expenses' }" @click="activeView = 'expenses'">Dépenses</button>
          <button :class="{ active: activeView === 'billing' }" @click="activeView = 'billing'">Facturation</button>
          <button :class="{ active: activeView === 'data-transfer' }" @click="activeView = 'data-transfer'">Import / Export</button>
          <button :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">Configuration</button>
        </nav>
        <div class="api-box">
          <div class="api-status-line">
            <span :class="['status', apiStatus === 'connecté' ? 'ok' : 'demo']"></span>
            <span>{{ apiStatus }}</span>
          </div>
          <div class="user-box">
            <span>{{ currentUserLabel }}</span>
            <small v-if="currentUserDetail">{{ currentUserDetail }}</small>
          </div>
        </div>
      </aside>

      <section class="content">
        <header class="topbar">
          <div>
            <p class="eyebrow">Comptabilité activité musique</p>
            <h1>{{ activeView === 'expenses' ? 'Dépenses ' + state.settings.year : selectedTerm.name }}</h1>
          </div>
          <div class="term-control">
            <label for="term">Période</label>
            <select id="term" v-model="selectedTermId">
              <option v-for="term in state.settings.terms" :key="term.id" :value="term.id">
                {{ term.name }} - semaines {{ term.startWeek }} à {{ term.endWeek }}
              </option>
            </select>
          </div>
        </header>

        <section v-if="activeView === 'dashboard'" class="view-stack">
          <div class="kpi-grid">
            <article class="kpi">
              <span>À facturer élèves</span>
              <strong>{{ money(totals.studentBilling + totals.groupFees) }}</strong>
              <small>Cours + cotisations groupe</small>
            </article>
            <article class="kpi">
              <span>Dû professeurs</span>
              <strong>{{ money(totals.teacherDue) }}</strong>
              <small>Cours individuels + groupes encadrés</small>
            </article>
            <article class="kpi">
              <span>Cotisations groupe</span>
              <strong>{{ money(totals.groupFees) }}</strong>
              <small>Dédupliquées par musicien</small>
            </article>
            <article class="kpi">
              <span>Dépenses annuelles</span>
              <strong>{{ money(totals.annualExpenses) }}</strong>
              <small>Budget activité musique</small>
            </article>
            <article class="kpi emphasis">
              <span>Subvention estimée</span>
              <strong>{{ money(totals.subsidy) }}</strong>
              <small>Dû profs - 50% cours - cotisations</small>
            </article>
          </div>

          <div class="split">
            <section class="panel">
              <div class="panel-head">
                <h2>Professeurs</h2>
                <span>{{ state.teachers.length }} intervenants</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Professeur</th>
                    <th>Heures cours</th>
                    <th>Heures groupes</th>
                    <th class="num">Montant dû</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in teacherRows" :key="row.teacher.id">
                    <td>
                      <strong>{{ fullName(row.teacher) }}</strong>
                      <small>{{ row.teacher.instrument }}</small>
                    </td>
                    <td>{{ row.individualHours.toFixed(2) }} h</td>
                    <td>{{ row.workshopHours.toFixed(2) }} h</td>
                    <td class="num">{{ money(row.totalDue) }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="panel">
              <div class="panel-head">
                <h2>Groupes</h2>
                <span>{{ state.bands.length }} groupes</span>
              </div>
              <div class="group-list">
                <article v-for="band in state.bands" :key="band.id" class="group-row">
                  <div>
                    <strong>{{ band.name }}</strong>
                    <small>{{ band.type === 'workshop' ? 'Groupe de travail encadré' : 'Groupe musical indépendant' }}</small>
                  </div>
                  <span>{{ memberCount(band) }} membres</span>
                </article>
              </div>
            </section>
          </div>
        </section>

        <section v-if="activeView === 'attendance'" class="view-stack">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h2>Cours individuels</h2>
                <span>Tous les élèves du trimestre, une case par semaine</span>
              </div>
            </div>
            <div class="attendance-table-wrap">
              <table class="attendance-table">
                <thead>
                  <tr>
                    <th class="sticky-col wide">Élève</th>
                    <th>Créneau</th>
                    <th>Prof</th>
                    <th v-for="week in weeks" :key="week" :class="['week-head', { holiday: isHolidayWeek(week) }]">S{{ week }}</th>
                    <th class="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in attendanceCourseRows" :key="row.course.id">
                    <td class="sticky-col wide">
                      <strong>{{ fullName(row.musician) }}</strong>
                      <small>{{ row.course.instrument }}</small>
                    </td>
                    <td>{{ row.course.weekday }} {{ row.course.startTime }}</td>
                    <td>{{ row.teacher.firstName }}</td>
                    <td v-for="week in weeks" :key="week" :class="['presence-cell', { holiday: isHolidayWeek(week) }]">
                      <button
                        :class="{ present: isPresent('individualCourse', row.course.id, week) }"
                        @click="toggleAttendance('individualCourse', row.course.id, week)"
                        :aria-label="'Présence ' + fullName(row.musician) + ' semaine ' + week"
                      >
                        {{ isPresent('individualCourse', row.course.id, week) ? '1' : '' }}
                      </button>
                    </td>
                    <td class="num">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <h2>Groupes de travail</h2>
                <span>Une séance cochée vaut 1h15 pour le professeur</span>
              </div>
            </div>
            <div class="attendance-table-wrap">
              <table class="attendance-table">
                <thead>
                  <tr>
                    <th class="sticky-col wide">Groupe</th>
                    <th>Jour</th>
                    <th>Prof</th>
                    <th v-for="week in weeks" :key="week" :class="['week-head', { holiday: isHolidayWeek(week) }]">S{{ week }}</th>
                    <th class="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in attendanceWorkshopRows" :key="row.band.id">
                    <td class="sticky-col wide">
                      <strong>{{ row.band.name }}</strong>
                      <small>{{ memberCount(row.band) }} membres</small>
                    </td>
                    <td>{{ row.band.weekday || '-' }}</td>
                    <td>{{ row.teacher?.firstName || '-' }}</td>
                    <td v-for="week in weeks" :key="week" :class="['presence-cell', { holiday: isHolidayWeek(week) }]">
                      <button
                        :class="{ present: isPresent('workshop', row.band.id, week) }"
                        @click="toggleAttendance('workshop', row.band.id, week)"
                        :aria-label="'Séance ' + row.band.name + ' semaine ' + week"
                      >
                        {{ isPresent('workshop', row.band.id, week) ? '1' : '' }}
                      </button>
                    </td>
                    <td class="num">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="activeView === 'signatures'" class="view-stack printable-view">
          <section class="panel signature-page">
            <div class="panel-head">
              <div>
                <h2>Feuilles d'émargement</h2>
                <span>{{ selectedTerm.name }} {{ state.settings.year }} - une feuille par professeur</span>
              </div>
              <button class="primary-button no-print" @click="printPage">Imprimer</button>
            </div>

            <div v-if="signatureSheetSections.length" class="signature-stack">
              <article v-for="section in signatureSheetSections" :key="section.teacher.id" class="signature-sheet">
                <div class="signature-head">
                  <div>
                    <h3>{{ fullName(section.teacher) }}</h3>
                    <span>{{ section.teacher.instrument }}</span>
                  </div>
                  <strong>{{ selectedTerm.name }} {{ state.settings.year }}</strong>
                </div>
                <div class="signature-table-wrap">
                  <table class="signature-table">
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
                            <small>Groupe de travail</small>
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

        <section v-if="activeView === 'people'" class="view-stack">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>{{ editingMusicianId ? 'Modifier un musicien' : 'Créer un musicien' }}</h2>
                <span>Groupes multiples et cours individuel optionnel</span>
              </div>
              <button class="ghost-button" @click="resetMusicianForm">Nouveau</button>
            </div>

            <div class="musician-editor">
              <label>
                Prénom
                <input v-model="musicianForm.firstName" placeholder="Prénom" />
              </label>
              <label>
                Nom
                <input v-model="musicianForm.lastName" placeholder="Nom" />
              </label>
              <label>
                Adresse mail
                <input type="email" v-model="musicianForm.email" placeholder="nom@exemple.fr" />
              </label>
            </div>

            <div class="editor-grid">
              <div>
                <h3>Groupes musicaux</h3>
                <div class="bucket-picker compact-bucket">
                  <div class="bucket-add">
                    <select v-model="musicianBandToAddId">
                      <option value="">Choisir un groupe</option>
                      <option v-for="band in musicianAvailableBands" :key="band.id" :value="band.id">{{ band.name }}</option>
                    </select>
                    <button class="icon-button" @click="addMusicianBand" :disabled="!musicianBandToAddId">+</button>
                  </div>
                  <div class="bucket-list">
                    <article v-for="band in musicianSelectedBands" :key="band.id" class="bucket-item">
                      <span>{{ band.name }}</span>
                      <button @click="removeMusicianBand(band.id)" :aria-label="'Retirer ' + band.name">x</button>
                    </article>
                    <p v-if="!musicianSelectedBands.length" class="empty-state">Aucun groupe musical</p>
                  </div>
                </div>
                <h3 class="section-subtitle">Groupe de travail</h3>
                <label class="check-label inline-check">
                  <input type="checkbox" v-model="musicianForm.inWorkshop" />
                  Inscrit à un groupe de travail
                </label>
                <select v-model="musicianForm.workshopBandId" :disabled="!musicianForm.inWorkshop">
                  <option v-for="band in workshopBands" :key="band.id" :value="band.id">{{ band.name }}</option>
                </select>
              </div>

              <div>
                <h3>Cours individuel</h3>
                <label class="check-label inline-check">
                  <input type="checkbox" v-model="musicianForm.hasIndividualCourse" />
                  Inscrit sur un créneau hebdomadaire
                </label>
                <div class="course-editor" :class="{ disabled: !musicianForm.hasIndividualCourse }">
                  <label>
                    Professeur
                    <select v-model="musicianForm.teacherId" :disabled="!musicianForm.hasIndividualCourse">
                      <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ fullName(teacher) }}</option>
                    </select>
                  </label>
                  <label>
                    Instrument
                    <input v-model="musicianForm.instrument" :disabled="!musicianForm.hasIndividualCourse" />
                  </label>
                  <label>
                    Jour
                    <select v-model="musicianForm.weekday" :disabled="!musicianForm.hasIndividualCourse">
                      <option v-for="day in WEEKDAYS" :key="day" :value="day">{{ day }}</option>
                    </select>
                  </label>
                  <label>
                    Créneau
                    <select v-model="musicianForm.startTime" :disabled="!musicianForm.hasIndividualCourse">
                      <option v-for="slot in timeSlots" :key="slot" :value="slot" :disabled="isSlotDisabled(slot)">
                        {{ slot }}{{ isSlotDisabled(slot) ? ' - occupé' : '' }}
                      </option>
                    </select>
                  </label>
                  <label class="check-label inline-check">
                    <input type="checkbox" v-model="musicianForm.sharedSlot" :disabled="!musicianForm.hasIndividualCourse" />
                    Créneau partagé
                  </label>
                </div>
                <p v-if="slotTakenByOtherMusician()" class="form-warning">Ce créneau est déjà pris. Cochez créneau partagé si plusieurs élèves suivent ce cours.</p>
              </div>
            </div>

            <div class="form-actions">
              <button class="primary-button" @click="saveMusician" :disabled="slotTakenByOtherMusician()">
                {{ editingMusicianId ? 'Enregistrer' : 'Créer le musicien' }}
              </button>
              <button class="ghost-button" @click="resetMusicianForm">Annuler</button>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Musiciens</h2>
              <input v-model="search" class="search" placeholder="Rechercher un musicien" />
            </div>
            <table>
              <thead>
                <tr>
                  <th>Musicien</th>
                  <th>Cours individuel</th>
                  <th>Groupes</th>
                  <th class="num">À payer trimestre</th>
                  <th class="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in musicianRows" :key="row.musician.id">
                  <td><strong>{{ fullName(row.musician) }}</strong></td>
                  <td>
                    <span v-if="row.course">{{ row.course.instrument }} avec {{ teachersById[row.course.teacherId]?.firstName || 'professeur inconnu' }} - {{ row.course.weekday }} {{ row.course.startTime }}</span>
                    <span v-else class="muted">Aucun</span>
                  </td>
                  <td>
                    <span v-if="row.bands.length">{{ row.bands.map(band => band.name).join(', ') }}</span>
                    <span v-else class="muted">Aucun</span>
                  </td>
                  <td class="num">{{ money(row.totalDue) }}</td>
                  <td class="row-actions">
                    <button @click="editMusician(row.musician)">Modifier</button>
                    <button class="danger-button" @click="deleteMusician(row.musician.id)">Supprimer</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Créneaux individuels</h2>
                <span>Demi-heures entre 11h30-14h00 et 16h30-18h00</span>
              </div>
            </div>
            <div class="slot-planning">
              <table>
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th v-for="day in WEEKDAYS" :key="day">{{ day }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in scheduleRows" :key="row.slot">
                    <th scope="row">{{ row.slot }}</th>
                    <td v-for="slot in row.days" :key="slot.key" :class="{ occupied: slot.courses.length }">
                      <strong v-if="slot.musicians.length">{{ slot.musicians.map(fullName).join(', ') }}</strong>
                      <span v-else class="muted">Libre</span>
                      <small v-if="slot.teachers.length">{{ slot.teachers.map(fullName).join(', ') }}{{ slot.sharedSlot ? ' - partagé' : '' }}</small>
                      <small v-else>Salle libre</small>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'groups'" class="view-stack">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Gestion des groupes</h2>
                <span>Création et association de musiciens</span>
              </div>
              <button class="ghost-button" @click="resetGroupForm">Nouveau groupe</button>
            </div>

            <div class="group-manager">
              <aside class="group-picker">
                <button
                  v-for="band in state.bands"
                  :key="band.id"
                  :class="{ active: selectedGroupId === band.id }"
                  @click="selectGroup(band.id)"
                >
                  <strong>{{ band.name }}</strong>
                  <span>{{ band.type === 'workshop' ? 'Groupe de travail' : 'Groupe musical' }} - {{ memberCount(band) }} membres</span>
                </button>
              </aside>

              <div class="group-editor">
                <div class="form-grid compact">
                  <label>
                    Nom du groupe
                    <input v-model="groupForm.name" placeholder="Nom du groupe" />
                  </label>
                  <label>
                    Type
                    <select v-model="groupForm.type">
                      <option value="independent">Groupe musical</option>
                      <option value="workshop">Groupe de travail</option>
                    </select>
                  </label>
                  <label v-if="groupForm.type === 'workshop'">
                    Professeur
                    <select v-model="groupForm.teacherId">
                      <option v-for="teacher in state.teachers" :key="teacher.id" :value="teacher.id">{{ fullName(teacher) }}</option>
                    </select>
                  </label>
                  <label v-if="groupForm.type === 'workshop'">
                    Jour
                    <select v-model="groupForm.weekday">
                      <option v-for="day in WEEKDAYS" :key="day" :value="day">{{ day }}</option>
                    </select>
                  </label>
                </div>

                <div class="panel-head inner-head">
                  <h3>Membres</h3>
                  <input v-model="groupSearch" class="search" placeholder="Rechercher un musicien" />
                </div>
                <div class="bucket-picker">
                  <div class="bucket-source">
                    <div class="bucket-add">
                      <select v-model="groupMemberToAddId">
                        <option value="">Choisir un musicien</option>
                        <option v-for="musician in availableGroupMembers" :key="musician.id" :value="musician.id">{{ fullName(musician) }}</option>
                      </select>
                      <button class="icon-button" @click="addGroupMember" :disabled="!groupMemberToAddId">+</button>
                    </div>
                    <small>{{ availableGroupMembers.length }} musiciens disponibles</small>
                  </div>
                  <div class="bucket-target">
                    <h3>Membres du groupe</h3>
                    <div class="bucket-list tall">
                      <article v-for="musician in selectedGroupMembers" :key="musician.id" class="bucket-item">
                        <span>{{ fullName(musician) }}</span>
                        <button @click="removeGroupMember(musician.id)" :aria-label="'Retirer ' + fullName(musician)">x</button>
                      </article>
                      <p v-if="!selectedGroupMembers.length" class="empty-state">Aucun membre sélectionné</p>
                    </div>
                  </div>
                </div>

                <div class="form-actions">
                  <button class="primary-button" @click="saveGroup">{{ selectedGroupId ? 'Enregistrer le groupe' : 'Créer le groupe' }}</button>
                  <button class="ghost-button" @click="resetGroupForm">Annuler</button>
                  <button v-if="selectedGroupId" class="danger-button standalone" @click="deleteGroup(selectedGroupId)">Supprimer le groupe</button>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'expenses'" class="view-stack">
          <div class="kpi-grid">
            <article class="kpi">
              <span>Total annuel</span>
              <strong>{{ money(totals.annualExpenses) }}</strong>
              <small>{{ state.settings.year }}</small>
            </article>
            <article v-for="category in expenseTotalsByCategory" :key="category.value" class="kpi">
              <span>{{ category.label }}</span>
              <strong>{{ money(category.total) }}</strong>
              <small>Dépenses saisies</small>
            </article>
          </div>

          <section class="panel">
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
                  <th class="actions-col">Actions</th>
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
                  <td>
                    <div class="row-actions">
                      <button @click="editExpense(expense)">Modifier</button>
                      <button class="danger-button" @click="deleteExpense(expense.id)">Supprimer</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="expenseRows.length === 0">
                  <td colspan="5" class="muted">Aucune dépense saisie pour cette année.</td>
                </tr>
              </tbody>
            </table>
          </section>
        </section>

        <section v-if="activeView === 'billing'" class="view-stack">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Factures élèves</h2>
                <span>{{ studentInvoiceDocuments.length || billableStudentRows.length }} factures</span>
              </div>
              <div class="document-actions">
                <a v-if="studentInvoiceSummaryDocument" class="document-link" :href="documentDownloadUrl(studentInvoiceSummaryDocument)" target="_blank">
                  PDF global
                </a>
                <button class="primary-button" @click="prepareAllStudentInvoices">Préparer toutes les factures</button>
              </div>
            </div>
            <div class="invoice-summary">
              <article>
                <span>Montant global élèves</span>
                <strong>{{ money(totals.studentBilling + totals.groupFees) }}</strong>
              </article>
              <article>
                <span>Cours individuels</span>
                <strong>{{ money(totals.studentBilling) }}</strong>
              </article>
              <article>
                <span>Cotisations groupe</span>
                <strong>{{ money(totals.groupFees) }}</strong>
                <small>{{ isFirstTerm ? 'Cotisation annuelle appliquée' : 'Cotisation annuelle déjà traitée au T1' }}</small>
              </article>
            </div>
            <p v-if="preparedStudentInvoices" class="success-note">Documents générés: {{ studentInvoiceDocuments.length }} factures élèves pour {{ selectedTerm.name }} {{ state.settings.year }}.</p>
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
                    <td class="num">{{ money(row.courseDue) }}</td>
                    <td class="num">{{ money(row.groupFee) }}</td>
                    <td class="num">{{ money(row.totalDue) }}</td>
                    <td>
                      <a v-if="documentForMusician(row.musician.id)" class="document-link" :href="documentDownloadUrl(documentForMusician(row.musician.id))" target="_blank">
                        PDF
                      </a>
                      <span v-else class="muted">Non généré</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Demandes de facture professeurs</h2>
                <span>{{ teacherInvoiceRequestDocuments.length || teacherBillingSections.length }} demandes</span>
              </div>
              <button class="primary-button" @click="prepareAllTeacherInvoiceRequests">Préparer les demandes</button>
            </div>
            <div class="teacher-billing-list">
              <article v-for="section in teacherBillingSections" :key="section.teacher.id" class="teacher-billing-card">
                <div class="teacher-billing-head">
                  <div>
                    <h3>{{ fullName(section.teacher) }}</h3>
                    <span>{{ section.teacher.instrument }}</span>
                  </div>
                  <div class="document-actions">
                    <strong>{{ section.totalHours.toFixed(2) }} h - {{ money(section.totalAmount) }}</strong>
                    <a v-if="documentForTeacher(section.teacher.id)" class="document-link" :href="documentDownloadUrl(documentForTeacher(section.teacher.id))" target="_blank">
                      PDF
                    </a>
                  </div>
                </div>
                <div class="attendance-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th class="num">Nombre d'heures</th>
                        <th class="num">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in section.rows" :key="row.key">
                        <td><strong>{{ row.dateLabel }}</strong></td>
                        <td class="num">{{ row.hours.toFixed(2) }} h</td>
                        <td class="num">{{ money(row.totalAmount) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          </section>
        </section>

        <section v-if="activeView === 'data-transfer'" class="view-stack">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Export JSON</h2>
                <span>Données métier du service, hors fichiers PDF générés</span>
              </div>
              <button class="primary-button" @click="exportData">Exporter</button>
            </div>
            <p class="muted">Le fichier contient la configuration annuelle, les professeurs, musiciens, groupes, créneaux individuels et présences.</p>
          </section>

          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Import JSON</h2>
                <span>Restauration complète sur le serveur cible</span>
              </div>
              <button class="danger-button" @click="importData" :disabled="!selectedImportFile">Importer</button>
            </div>
            <div class="api-form">
              <input type="file" accept="application/json,.json" @change="selectImportFile" />
            </div>
            <p class="form-warning">L'import remplace les données métier existantes du serveur cible. Les factures PDF devront être régénérées après import.</p>
            <p v-if="selectedImportFile" class="success-note">Fichier sélectionné: {{ selectedImportFile.name }}</p>
          </section>
        </section>

        <section v-if="activeView === 'settings'" class="view-stack">
          <section class="panel">
            <div class="panel-head">
              <div>
                <h2>Professeurs</h2>
                <span>Création et mise à jour des intervenants</span>
              </div>
              <button class="ghost-button" @click="resetTeacherForm">Nouveau professeur</button>
            </div>
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
                    <button @click="editTeacher(teacher)">Modifier</button>
                    <button class="danger-button" @click="deleteTeacher(teacher.id)" :disabled="teacherUsageCount(teacher.id) > 0">
                      Supprimer
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="panel">
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
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>Trimestres</h2>
              <span>Semaines numériques modifiables</span>
            </div>
            <div class="term-grid">
              <article v-for="term in state.settings.terms" :key="term.id">
                <strong>{{ term.name }}</strong>
                <label>Début <input type="number" v-model.number="term.startWeek" min="1" max="53" /></label>
                <label>Fin <input type="number" v-model.number="term.endWeek" min="1" max="53" /></label>
              </article>
            </div>
            <div class="form-actions">
              <button class="primary-button" @click="saveSettings">Enregistrer les trimestres</button>
            </div>
          </section>

          <section class="panel">
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
                    <button @click="removeHolidayWeek(week)" :aria-label="'Retirer la semaine ' + week">x</button>
                  </article>
                  <p v-if="!selectedHolidayWeeks.length" class="empty-state">Aucune semaine de vacances</p>
                </div>
              </div>
            </div>
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
            {{ toast.message }}
          </div>
        </div>
      </section>
    </main>
  `,
});

app.mount("#app");
