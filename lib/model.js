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
    unitCost: 0.75,
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
  return { settings: defaultSettings(), days: {}, payments: [] };
}

// State saved by an older version of the app is missing fields added since.
// Filling them in on load keeps every consumer free of undefined checks.
export function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  return {
    settings: { ...base.settings, ...(raw.settings || {}) },
    days: raw.days || {},
    payments: Array.isArray(raw.payments) ? raw.payments : [],
  };
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

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

export function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

// Below a cent, treat a balance as settled rather than showing $0.00 owing.
const SETTLED_EPSILON = 0.005;

// Hours and wages per staff member over a date range. Shifts with no one
// assigned are left out: nobody is owed for them.
export function staffEarningsInRange(settings, days, startKey, endKey) {
  const totals = {};
  for (const dateKey of eachDayInRange(startKey, endKey)) {
    for (const shift of getShiftsForDate(settings, days, dateKey)) {
      if (!shift.staffId) continue;
      const staff = settings.staff.find((p) => p.id === shift.staffId);
      if (!staff) continue;
      const hours = shiftHours(shift);
      if (!totals[staff.id]) totals[staff.id] = { hours: 0, earned: 0 };
      totals[staff.id].hours += hours;
      totals[staff.id].earned += hours * staff.rate;
    }
  }
  return settings.staff.map((staff) => ({
    staff,
    hours: totals[staff.id] ? totals[staff.id].hours : 0,
    earned: roundMoney(totals[staff.id] ? totals[staff.id].earned : 0),
  }));
}

// Shifts are derived for every date from the store's weekly hours, so payroll
// has to be anchored to when the shop actually started being tracked.
export function firstActivityDate(days) {
  const keys = Object.keys(days).filter((k) => days[k]);
  return keys.length ? keys.sort()[0] : null;
}

export function findWeekPayment(payments, staffId, weekStart) {
  return payments.find((p) => p.staffId === staffId && p.weekStart === weekStart) || null;
}

// Cash basis: a payment counts toward the period it was handed over in, not
// the period it covers.
export function paidToStaffInRange(payments, staffId, startKey, endKey) {
  return roundMoney(
    payments
      .filter((p) => p.staffId === staffId && p.paidOn >= startKey && p.paidOn <= endKey)
      .reduce((sum, p) => sum + p.amount, 0)
  );
}

function totalPaidToStaff(payments, staffId) {
  return payments
    .filter((p) => p.staffId === staffId)
    .reduce((sum, p) => sum + p.amount, 0);
}

// The span over which wages actually accrue, clamped to a requested range:
// nothing before the shop started being tracked, nothing past today. Every
// payroll figure goes through here so the week card and the running balance
// can't disagree about which days count.
export function payrollWindow(days, startKey, endKey, todayKey) {
  const first = firstActivityDate(days);
  if (!first) return null;
  const start = startKey > first ? startKey : first;
  const end = endKey < todayKey ? endKey : todayKey;
  return end < start ? null : { start, end };
}

// Everything earned since the shop started, minus everything ever handed over.
// Running the balance this way self-corrects: if a week is marked paid and then
// its hours grow, the difference reappears as outstanding instead of vanishing.
export function outstandingByStaff(settings, days, payments, throughKey) {
  const window = payrollWindow(days, "0000-00-00", throughKey, throughKey);
  if (!window) {
    return settings.staff.map((staff) => ({ staff, outstanding: 0 }));
  }
  const earnings = staffEarningsInRange(settings, days, window.start, window.end);
  return earnings.map(({ staff, earned }) => ({
    staff,
    outstanding: roundMoney(earned - totalPaidToStaff(payments, staff.id)),
  }));
}

export function totalOutstanding(settings, days, payments, throughKey) {
  return roundMoney(
    outstandingByStaff(settings, days, payments, throughKey).reduce(
      (sum, row) => sum + Math.max(0, row.outstanding),
      0
    )
  );
}

export function isSettled(amount) {
  return Math.abs(amount) < SETTLED_EPSILON;
}

// Month-end cost of goods sold: wages actually paid out during the month plus
// the ingredient cost of the macarons sold in it.
export function monthlyCogs(settings, days, payments, startKey, endKey) {
  const wagesByStaff = settings.staff.map((staff) => ({
    staff,
    paid: paidToStaffInRange(payments, staff.id, startKey, endKey),
  }));
  const wages = roundMoney(wagesByStaff.reduce((sum, row) => sum + row.paid, 0));
  const unitsSold = settings.flavors.reduce(
    (sum, f) => sum + flavorSoldInRange(days, f.id, startKey, endKey).sold,
    0
  );
  const ingredients = roundMoney(unitsSold * (settings.unitCost || 0));
  const total = roundMoney(wages + ingredients);
  return {
    wagesByStaff,
    wages,
    unitsSold,
    ingredients,
    total,
    perMacaron: unitsSold > 0 ? total / unitsSold : null,
  };
}
