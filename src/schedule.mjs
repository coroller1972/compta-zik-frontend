/**
 * Planning de la salle — mêmes règles que le backend (SlotRules) :
 * plages 11:30–14:00 et 16:30–20:00, départs toutes les 30 min, une seule salle,
 * aucun chevauchement le même jour sauf deux cours qui démarrent ensemble quand l'un est partagé.
 * Les durées viennent des réglages de l'année (cours, atelier, groupe).
 */
export const SCHEDULE_WINDOWS = [
  { label: "Midi", start: "11:30", end: "14:00" },
  { label: "Soir", start: "16:30", end: "20:00" },
];
export const STEP_MINUTES = 30;
export const ROW_MINUTES = 15;

export function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return (hours * 60) + minutes;
}

export function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Heures de départ proposées (grille de 30 min, dans les plages). */
export function startTimes() {
  return SCHEDULE_WINDOWS.flatMap((window) => {
    const times = [];
    for (let minutes = timeToMinutes(window.start); minutes < timeToMinutes(window.end); minutes += STEP_MINUTES) {
      times.push(minutesToTime(minutes));
    }
    return times;
  });
}

export function durationMinutes(settings, kind) {
  const hours = {
    course: settings?.individualCourseHours ?? 0.5,
    workshop: settings?.workshopHours ?? 1.25,
    group: settings?.groupHours ?? 1.5,
  }[kind];
  return Math.round(Number(hours) * 60);
}

export function bandKind(band) {
  return band?.type === "workshop" ? "workshop" : "group";
}

/** Occupations de la salle : cours actifs et groupes placés (jour + heure). */
export function occupations({ settings, courses = [], bands = [], isActiveCourse = () => true }) {
  const courseMinutes = durationMinutes(settings, "course");
  const fromCourses = courses
    .filter((course) => course.weekday && course.startTime && isActiveCourse(course))
    .map((course) => ({
      id: course.id,
      kind: "course",
      weekday: course.weekday,
      start: timeToMinutes(course.startTime),
      minutes: courseMinutes,
      sharedSlot: Boolean(course.sharedSlot),
      item: course,
    }));
  const fromBands = bands
    .filter((band) => band.weekday && band.startTime)
    .map((band) => ({
      id: band.id,
      kind: bandKind(band),
      weekday: band.weekday,
      start: timeToMinutes(band.startTime),
      minutes: durationMinutes(settings, bandKind(band)),
      sharedSlot: false,
      item: band,
    }));
  return [...fromCourses, ...fromBands];
}

function windowOf(start) {
  return SCHEDULE_WINDOWS.find((window) => start >= timeToMinutes(window.start) && start < timeToMinutes(window.end));
}

/** Motif si l'occupation sort de la grille ou de sa plage, sinon null. */
export function placementError(candidate) {
  if (candidate.start % STEP_MINUTES !== 0) return "hors de la grille de 30 min";
  const window = windowOf(candidate.start);
  if (!window) return "hors des plages d'ouverture";
  if (candidate.start + candidate.minutes > timeToMinutes(window.end)) return `dépasse ${window.end}`;
  return null;
}

function sharesCourseSlot(first, second) {
  return first.kind === "course" && second.kind === "course"
    && first.start === second.start && (first.sharedSlot || second.sharedSlot);
}

/** Occupations que le candidat chevaucherait (le candidat lui-même est ignoré par son id). */
export function conflicts(candidate, others) {
  return others.filter((other) => (
    other.weekday === candidate.weekday
    && (candidate.id == null || other.id !== candidate.id)
    && candidate.start < other.start + other.minutes
    && other.start < candidate.start + candidate.minutes
    && !sharesCourseSlot(candidate, other)
  ));
}

/** Pourquoi le candidat ne peut pas être placé (plage ou chevauchement), ou null s'il peut l'être. */
export function unavailableReason(candidate, others) {
  const placement = placementError(candidate);
  if (placement) return placement;
  const blocking = conflicts(candidate, others);
  if (!blocking.length) return null;
  return blocking.length > 1 ? `occupé · ${blocking.length} réservations` : "occupé";
}

/** Lignes de l'agenda au quart d'heure, avec la pause entre les deux plages. */
export function agendaRows() {
  return SCHEDULE_WINDOWS.flatMap((window, index) => {
    const rows = [];
    for (let minutes = timeToMinutes(window.start); minutes < timeToMinutes(window.end); minutes += ROW_MINUTES) {
      rows.push({ type: "slot", minutes, time: minutesToTime(minutes), mark: minutes % 60 === 0 ? "hour" : minutes % 30 === 0 ? "half" : "quarter" });
    }
    const next = SCHEDULE_WINDOWS[index + 1];
    if (next) rows.push({ type: "pause", from: window.end, to: next.start });
    return rows;
  });
}

/** Minutes libres d'une journée, plage par plage. */
export function freeMinutes(dayOccupations) {
  return SCHEDULE_WINDOWS.reduce((total, window) => {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);
    let busy = 0;
    for (let minute = start; minute < end; minute += ROW_MINUTES) {
      if (dayOccupations.some((occupation) => minute >= occupation.start && minute < occupation.start + occupation.minutes)) busy += ROW_MINUTES;
    }
    return total + (end - start - busy);
  }, 0);
}

/** Durée libre à partir d'un départ, jusqu'à la prochaine réservation ou la fin de la plage. */
export function freeUntil(start, dayOccupations) {
  const window = windowOf(start);
  if (!window) return start;
  const next = dayOccupations
    .map((occupation) => occupation.start)
    .filter((occupationStart) => occupationStart >= start)
    .sort((left, right) => left - right)[0];
  return Math.min(next ?? Infinity, timeToMinutes(window.end));
}

export function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}
