// Local-date helpers. Everything here builds dates from
// getFullYear/getMonth/getDate (and constructs with `new Date(y, m, d)`),
// never toISOString or UTC math, so entries always land on the calendar day
// the user actually sees on their phone.

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function todayKey() {
  return toKey(new Date());
}

// "2026-09-10" from a Date, using local fields.
export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse a "YYYY-MM-DD" key into a local-midnight Date.
export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key, n) {
  const d = fromKey(key);
  d.setMonth(d.getMonth() + n);
  return toKey(d);
}

export function addYears(key, n) {
  const d = fromKey(key);
  d.setFullYear(d.getFullYear() + n);
  return toKey(d);
}

export function weekdayIndex(key) {
  return fromKey(key).getDay(); // 0 = Sun ... 6 = Sat
}

export function weekdayName(key) {
  return WEEKDAY_NAMES[weekdayIndex(key)];
}

// Monday-start week containing `key`.
export function startOfWeek(key) {
  const d = fromKey(key);
  const dow = d.getDay(); // 0 Sun..6 Sat
  const diff = dow === 0 ? -6 : 1 - dow; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return toKey(d);
}

export function endOfWeek(key) {
  return addDays(startOfWeek(key), 6);
}

export function startOfMonth(key) {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(key) {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Inclusive list of date keys from start to end.
export function eachDayInRange(startKey, endKey) {
  const out = [];
  let cur = startKey;
  while (cur <= endKey) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function isToday(key) {
  return key === todayKey();
}

export function formatShortDate(key) {
  const d = fromKey(key);
  return `${weekdayName(key)}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function formatLongDate(key) {
  const d = fromKey(key);
  return `${WEEKDAY_NAMES_LONG[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatMonthDay(key) {
  const d = fromKey(key);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function formatWeekRange(key) {
  const start = startOfWeek(key);
  const end = endOfWeek(key);
  const sd = fromKey(start);
  const ed = fromKey(end);
  if (sd.getMonth() === ed.getMonth()) {
    return `${MONTH_NAMES[sd.getMonth()].slice(0, 3)} ${sd.getDate()}–${ed.getDate()}`;
  }
  return `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
}

export function formatMonthYear(key) {
  const d = fromKey(key);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// "11:00" (24h input value) -> "11:00 AM"
export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Minutes since midnight from "HH:MM".
export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
