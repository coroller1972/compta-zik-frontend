import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agendaRows,
  conflicts,
  durationLabel,
  durationMinutes,
  freeMinutes,
  freeUntil,
  occupations,
  placementError,
  startTimes,
  timeToMinutes,
  unavailableReason,
} from "../src/schedule.mjs";

const settings = { individualCourseHours: 0.5, workshopHours: 1.25 };
const at = (kind, time, minutes, extra = {}) => ({ id: `${kind}-${time}`, kind, weekday: "Mardi", start: timeToMinutes(time), minutes, sharedSlot: false, ...extra });

test("start times follow the 15-minute grid inside both windows, evening until 20:00", () => {
  const times = startTimes();
  assert.equal(times[0], "11:30");
  assert.ok(times.includes("13:30") && !times.includes("14:00") && !times.includes("16:00"));
  assert.ok(times.includes("12:45") && times.includes("19:45") && !times.includes("20:00"));
  assert.equal(times.length, 10 + 14);
});

test("courses and workshops follow the year, each group its own 1h15 or 1h30", () => {
  assert.equal(durationMinutes(settings, "course"), 30);
  assert.equal(durationMinutes(settings, "workshop"), 75);
  assert.equal(durationMinutes(settings, "group", 75), 75);
  assert.equal(durationMinutes(settings, "group", 90), 90);
  assert.equal(durationMinutes(settings, "group"), 90, "existing groups default to 1h30");
  assert.equal(durationMinutes(settings, "group", 60), 90, "only 1h15 or 1h30");
});

test("two groups of 1h15 fill the midday window back to back", () => {
  const first = at("group", "11:30", 75);
  const second = at("group", "12:45", 75, { id: "second" });
  assert.equal(placementError(second), null);
  assert.equal(conflicts(second, [first]).length, 0);
  assert.match(placementError(at("group", "12:45", 90)), /14:00/);
});

test("placements must end inside their window", () => {
  assert.equal(placementError(at("group", "18:30", 90)), null);
  assert.match(placementError(at("workshop", "19:00", 75)), /20:00/);
  assert.match(placementError(at("group", "13:00", 90)), /14:00/);
  assert.ok(placementError(at("course", "15:00", 30)));
});

test("one room: no overlap on the same day, except two courses sharing a slot", () => {
  const placed = [at("course", "17:00", 30), at("group", "17:30", 90)];
  assert.equal(conflicts(at("workshop", "16:30", 75, { id: "new" }), placed).length, 2);
  assert.equal(conflicts(at("course", "16:30", 30, { id: "new" }), placed).length, 0);
  assert.equal(conflicts(at("course", "19:00", 30, { id: "new" }), placed).length, 0);
  assert.equal(conflicts(at("course", "17:00", 30, { id: "new", sharedSlot: true }), placed).length, 0);
  assert.equal(conflicts(at("course", "17:00", 30, { id: "new" }), placed).length, 1);
  assert.equal(conflicts(at("group", "17:30", 90), placed).length, 0, "editing a group ignores itself");
  assert.equal(unavailableReason(at("course", "18:00", 30, { id: "new" }), placed), "occupé");
  assert.equal(unavailableReason(at("workshop", "16:30", 75, { id: "new" }), placed), "occupé · 2 réservations");
  assert.equal(unavailableReason(at("workshop", "19:00", 75, { id: "new" }), placed), "dépasse 20:00");
});

test("occupations keep active courses and placed bands only", () => {
  const list = occupations({
    settings,
    courses: [
      { id: "c1", weekday: "Mardi", startTime: "17:00", active: true },
      { id: "c2", weekday: "Mardi", startTime: "17:30", active: false },
    ],
    bands: [
      { id: "b1", type: "workshop", weekday: "Jeudi", startTime: "18:00" },
      { id: "b2", type: "independent", weekday: "Mardi", startTime: null },
      { id: "b3", type: "independent", weekday: "Mardi", startTime: "11:30", durationMinutes: 75 },
    ],
    isActiveCourse: (course) => course.active,
  });
  assert.deepEqual(list.map((item) => [item.id, item.kind, item.minutes]), [["c1", "course", 30], ["b1", "workshop", 75], ["b3", "group", 75]]);
});

test("free time is counted per day and up to the next booking", () => {
  const day = [at("course", "17:00", 30), at("group", "17:30", 90)];
  assert.equal(freeMinutes(day), 150 + 210 - 120);
  assert.equal(freeUntil(timeToMinutes("16:30"), day), timeToMinutes("17:00"));
  assert.equal(freeUntil(timeToMinutes("19:00"), day), timeToMinutes("20:00"));
  assert.equal(durationLabel(90), "1 h 30");
  assert.equal(durationLabel(60), "1 h");
  assert.equal(durationLabel(30), "30 min");
});

test("agenda rows are quarter hours with a pause between the windows", () => {
  const rows = agendaRows();
  assert.equal(rows.filter((row) => row.type === "slot").length, 10 + 14);
  const pause = rows.find((row) => row.type === "pause");
  assert.deepEqual([pause.from, pause.to], ["14:00", "16:30"]);
});
