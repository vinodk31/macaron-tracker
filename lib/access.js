// What each role is allowed to see and change. These run on the server: the
// employee UI hides things, but this file is what actually enforces it, so a
// crafted request can't read a colleague's wages or rewrite settings.

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
      // Name and id only: the counting screen groups flavors by product, and
      // without these a flavor under a product the shop added itself would
      // have nothing to sit under and simply not be shown. What each one
      // costs to make is still none of their business.
      products: state.settings.products.map((p) => ({ id: p.id, name: p.name })),
      flavors: state.settings.flavors,
      staff: [me],
    },
    days,
    payments: state.payments.filter((p) => p.staffId === staffId),
  };
}

// Employees may change the freezer counts and the day note. Nothing else:
// hours are the owner's to set from the schedule, and what is paid follows
// from them, so a shift arriving in a staff body is dropped rather than
// trusted. `staffId` stays in the signature because every caller is
// scoping a write to one employee and reads better saying so.
//
// Everything outside counts and the note is taken from what is already
// stored, which is what makes this safe against a hand-written request: the
// body cannot carry anything the merge doesn't explicitly read.
export function mergeStaffChanges(stored, incoming) {
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

    if (Object.keys(nextDay).length > 0) days[dateKey] = nextDay;
  }

  return { settings: stored.settings, days, payments: stored.payments };
}
