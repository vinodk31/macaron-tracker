// What each role is allowed to see and change. These run on the server: the
// employee UI hides things, but this file is what actually enforces it, so a
// crafted request can't read a colleague's wages or rewrite settings.

import { getShiftsForDate } from "./model";

// An employee sees the shop's flavors and opening hours (they need both to do
// the job), their own staff record, their own shifts and their own payments.
// Everyone else's rates, payments and the ingredient cost stay out of the
// payload entirely.
export function scopeStateForStaff(state, staffId) {
  const stored = state.settings.staff.find((s) => s.id === staffId);
  if (!stored) return null;
  // No reason to send auth material back to the browser.
  const { pin, ...me } = stored;

  const days = {};
  for (const [dateKey, day] of Object.entries(state.days)) {
    const scoped = {};
    if (day.counts) scoped.counts = day.counts;
    if (day.note) scoped.note = day.note;
    if (day.hours) {
      if (day.hours.closed) {
        scoped.hours = { closed: true };
      } else if (day.hours.shifts) {
        scoped.hours = { shifts: day.hours.shifts.filter((s) => s.staffId === staffId) };
      }
    }
    if (Object.keys(scoped).length > 0) days[dateKey] = scoped;
  }

  return {
    settings: {
      shopName: state.settings.shopName,
      hours: state.settings.hours,
      prepBufferMin: state.settings.prepBufferMin,
      closeBufferMin: state.settings.closeBufferMin,
      flavors: state.settings.flavors,
      staff: [me],
    },
    days,
    payments: state.payments.filter((p) => p.staffId === staffId),
  };
}

// Employees may change freezer counts, the day note, and their own shift
// times. Everything else is taken from what is already stored, so anything
// extra in the request body is simply ignored rather than trusted.
export function mergeStaffChanges(stored, incoming, staffId) {
  const days = { ...stored.days };

  for (const [dateKey, incomingDay] of Object.entries(incoming.days || {})) {
    if (!incomingDay || typeof incomingDay !== "object") continue;
    const storedDay = stored.days[dateKey] || {};
    const nextDay = { ...storedDay };

    if (incomingDay.counts && typeof incomingDay.counts === "object") {
      nextDay.counts = incomingDay.counts;
    }
    if (typeof incomingDay.note === "string") {
      nextDay.note = incomingDay.note;
    }

    const ownShifts = readOwnShifts(incomingDay, staffId);
    if (ownShifts) {
      // Colleagues' shifts have to survive, and a day still running on the
      // store's default hours has to keep theirs too, so they are read from
      // the effective schedule rather than from whatever the client sent.
      const others = getShiftsForDate(stored.settings, stored.days, dateKey).filter(
        (s) => s.staffId !== staffId
      );
      nextDay.hours = { shifts: [...others, ...ownShifts] };
    }

    if (Object.keys(nextDay).length > 0) days[dateKey] = nextDay;
  }

  return { settings: stored.settings, days, payments: stored.payments };
}

function readOwnShifts(incomingDay, staffId) {
  const hours = incomingDay.hours;
  if (!hours || hours.closed || !Array.isArray(hours.shifts)) return null;
  const own = hours.shifts
    .filter((s) => s && s.staffId === staffId)
    .map((s) => ({ staffId, start: String(s.start), end: String(s.end) }))
    .filter((s) => /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end));
  return own;
}
