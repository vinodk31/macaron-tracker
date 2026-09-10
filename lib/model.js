// Domain logic: defaults, the freezer-count → sold/restocked derivation,
// and shift/labor math. No storage or React here.

import { addDays, addMonths, addYears, eachDayInRange, timeToMinutes, minutesToTime, weekdayIndex } from "./dates";

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Weekday keys follow Date#getDay(): 0 = Sunday ... 6 = Saturday.
export const DEFAULT_HOURS = {
  0: { closed: false, open: "12:00", close: "18:00" },
  1: { closed: false, open: "11:00", close: "20:00" },
  2: { closed: false, open: "11:00", close: "20:00" },
  3: { closed: false, open: "11:00", close: "20:00" },
  4: { closed: false, open: "11:00", close: "20:00" },
  5: { closed: false, open: "10:00", close: "20:00" },
  6: { closed: false, open: "10:00", close: "20:00" },
};

export function defaultSettings() {
  return {
    shopName: "Macaron Kiosk",
    hours: JSON.parse(JSON.stringify(DEFAULT_HOURS)),
    prepBufferMin: 30,
    closeBufferMin: 15,
    staff: [{ id: makeId("staff"), name: "You", rate: 16, isDefault: true }],
    flavors: [
      { id: makeId("flavor"), name: "Vanilla Bean" },
      { id: makeId("flavor"), name: "Chocolate" },
      { id: makeId("flavor"), name: "Raspberry" },
      { id: makeId("flavor"), name: "Pistachio" },
      { id: makeId("flavor"), name: "Salted Caramel" },
    ],
  };
}

export function defaultState() {
  return { settings: defaultSettings(), days: {} };
}

// ---------------------------------------------------------------------------
// Hours / shifts
// ---------------------------------------------------------------------------

export function getDefaultShiftsForDate(settings, dateKey) {
  const wd = weekdayIndex(dateKey);
  const hours = settings.hours[wd];
  if (!hours || hours.closed) return [];
  const defaultStaff = settings.staff.find((s) => s.isDefault) || settings.staff[0] || null;
  const startMin = timeToMinutes(hours.open) - (settings.prepBufferMin || 0);
  const endMin = timeToMinutes(hours.close) + (settings.closeBufferMin || 0);
  return [
    {
      staffId: defaultStaff ? defaultStaff.id : null,
      start: minutesToTime(startMin),
      end: minutesToTime(endMin),
    },
  ];
}

// True when the day has no stored override and is running on derived defaults.
export function isUsingDefaultHours(days, dateKey) {
  const day = days[dateKey];
  return !(day && day.hours);
}

export function getShiftsForDate(settings, days, dateKey) {
  const day = days[dateKey];
  if (day && day.hours) {
    if (day.hours.closed) return [];
    if (day.hours.shifts) return day.hours.shifts;
  }
  return getDefaultShiftsForDate(settings, dateKey);
}

export function isClosedForDate(settings, days, dateKey) {
  const day = days[dateKey];
  if (day && day.hours) return !!day.hours.closed;
  const wd = weekdayIndex(dateKey);
  const hours = settings.hours[wd];
  return !hours || !!hours.closed;
}

export function shiftHours(shift) {
  const mins = timeToMinutes(shift.end) - timeToMinutes(shift.start);
  return Math.max(0, mins) / 60;
}

export function scheduledHoursForDate(settings, days, dateKey) {
  return getShiftsForDate(settings, days, dateKey).reduce((sum, s) => sum + shiftHours(s), 0);
}

export function laborCostForDate(settings, days, dateKey) {
  const shifts = getShiftsForDate(settings, days, dateKey);
  return shifts.reduce((sum, s) => {
    const staff = settings.staff.find((p) => p.id === s.staffId);
    return sum + shiftHours(s) * (staff ? staff.rate : 0);
  }, 0);
}

export function scheduledHoursInRange(settings, days, startKey, endKey) {
  return eachDayInRange(startKey, endKey).reduce(
    (sum, d) => sum + scheduledHoursForDate(settings, days, d),
    0
  );
}

export function laborCostInRange(settings, days, startKey, endKey) {
  return eachDayInRange(startKey, endKey).reduce(
    (sum, d) => sum + laborCostForDate(settings, days, d),
    0
  );
}

// ---------------------------------------------------------------------------
// Freezer counts -> derived sold / restocked
// ---------------------------------------------------------------------------

export function getRecordedDates(days) {
  return Object.keys(days)
    .filter((k) => days[k] && days[k].counts)
    .sort();
}

// [{date, count}] for a single flavor, across every day that recorded it,
// sorted chronologically.
export function buildFlavorSeries(days, flavorId) {
  const dates = getRecordedDates(days);
  const series = [];
  for (const date of dates) {
    const count = days[date].counts[flavorId];
    if (typeof count === "number") series.push({ date, count });
  }
  return series;
}

// Day-over-day deltas for one flavor: a decrease adds to sold, an increase
// adds to restocked. Days with no recorded count are skipped entirely, so
// the delta always compares against the last time the flavor was counted.
export function flavorDeltas(days, flavorId) {
  const series = buildFlavorSeries(days, flavorId);
  const deltas = [];
  for (let i = 1; i < series.length; i++) {
    const diff = series[i].count - series[i - 1].count;
    deltas.push({
      date: series[i].date,
      sold: diff < 0 ? -diff : 0,
      restocked: diff > 0 ? diff : 0,
    });
  }
  return deltas;
}

export function flavorSoldInRange(days, flavorId, startKeyInclusive, endKeyInclusive) {
  const deltas = flavorDeltas(days, flavorId);
  let sold = 0;
  let restocked = 0;
  for (const d of deltas) {
    if (d.date >= startKeyInclusive && d.date <= endKeyInclusive) {
      sold += d.sold;
      restocked += d.restocked;
    }
  }
  return { sold, restocked };
}

// Last recorded count for a flavor on or before `key`, or undefined.
export function flavorCountAsOf(days, flavorId, key) {
  const series = buildFlavorSeries(days, flavorId);
  let result;
  for (const point of series) {
    if (point.date <= key) result = point.count;
    else break;
  }
  return result;
}

// Last recorded count strictly before `key` — used to pre-fill a blank day's
// inputs with a greyed-out placeholder.
export function lastKnownCountBefore(days, flavorId, key) {
  const series = buildFlavorSeries(days, flavorId);
  let result;
  for (const point of series) {
    if (point.date < key) result = point.count;
    else break;
  }
  return result;
}

export const COMPARISON_PERIODS = [
  { id: "yesterday", label: "Yesterday", offset: (key) => addDays(key, -1) },
  { id: "week", label: "Week ago", offset: (key) => addDays(key, -7) },
  { id: "month", label: "Month ago", offset: (key) => addMonths(key, -1) },
  { id: "year", label: "Year ago", offset: (key) => addYears(key, -1) },
];

// Per-day totals (summed across all flavors) for a date range — used for the
// Week/Month bar chart. Days with no deltas come back as zero, not omitted.
export function dailyTotals(days, flavors, startKey, endKey) {
  const totals = {};
  for (const f of flavors) {
    const deltas = flavorDeltas(days, f.id);
    for (const d of deltas) {
      if (d.date >= startKey && d.date <= endKey) {
        if (!totals[d.date]) totals[d.date] = { date: d.date, sold: 0, restocked: 0 };
        totals[d.date].sold += d.sold;
        totals[d.date].restocked += d.restocked;
      }
    }
  }
  return eachDayInRange(startKey, endKey).map(
    (date) => totals[date] || { date, sold: 0, restocked: 0 }
  );
}

export function freezerLevelAsOf(days, flavors, key) {
  return flavors.reduce((sum, f) => {
    const count = flavorCountAsOf(days, f.id, key);
    return sum + (typeof count === "number" ? count : 0);
  }, 0);
}

export function flavorRanking(days, flavors, startKey, endKey) {
  return flavors
    .map((f) => ({ flavor: f, ...flavorSoldInRange(days, f.id, startKey, endKey) }))
    .sort((a, b) => b.sold - a.sold);
}
