"use client";

import {
  getShiftsForDate,
  isClosedForDate,
  isUsingDefaultHours,
  shiftHours,
  staffEarningsInRange,
} from "@/lib/model";

export default function HoursCard({ settings, days, isStaff, dateKey, onUpdateDay }) {
  const allShifts = getShiftsForDate(settings, days, dateKey);
  // An employee edits their own hours and nothing else, so a shift that isn't
  // theirs (including an unassigned default one) has no business being here:
  // the server would reject the edit anyway.
  const shifts = isStaff
    ? allShifts.filter((s) => s.staffId === settings.staff[0]?.id)
    : allShifts;
  const closed = isClosedForDate(settings, days, dateKey);
  const usingDefault = isUsingDefaultHours(days, dateKey);
  // Derived from the same list that is rendered, so the summary can't drift
  // from the shifts above it.
  const totalHours = shifts.reduce((sum, s) => sum + shiftHours(s), 0);
  const laborCost = shifts.reduce((sum, s) => {
    const staff = settings.staff.find((p) => p.id === s.staffId);
    return sum + shiftHours(s) * (staff ? staff.rate : 0);
  }, 0);
  const owedToday = staffEarningsInRange(settings, days, dateKey, dateKey).filter(
    (row) => row.earned > 0 && (!isStaff || row.staff.id === settings.staff[0]?.id)
  );

  function setOverride(nextHours) {
    onUpdateDay(dateKey, (day) => ({ ...day, hours: nextHours }));
  }

  function resetToDefault() {
    onUpdateDay(dateKey, (day) => {
      const { hours, ...rest } = day;
      return rest;
    });
  }

  function toggleClosed(nextClosed) {
    if (nextClosed) {
      setOverride({ closed: true });
    } else {
      resetToDefault();
    }
  }

  function updateShift(index, patch) {
    const nextShifts = shifts.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setOverride({ shifts: nextShifts });
  }

  function addShift() {
    const defaultStaff = settings.staff.find((s) => s.isDefault) || settings.staff[0] || null;
    setOverride({
      shifts: [
        ...shifts,
        { staffId: defaultStaff ? defaultStaff.id : null, start: "12:00", end: "16:00" },
      ],
    });
  }

  function removeShift(index) {
    setOverride({ shifts: shifts.filter((_, i) => i !== index) });
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Hours</h2>
        {usingDefault ? (
          <span className="default-badge">Default</span>
        ) : isStaff ? (
          <span className="override-badge">Edited</span>
        ) : (
          <div className="btn-row">
            <span className="override-badge">Edited</span>
            <button className="btn btn-ghost btn-sm" onClick={resetToDefault}>
              Reset
            </button>
          </div>
        )}
      </div>

      {!isStaff && (
        <label className="checkbox-label" style={{ justifyContent: "flex-start", marginBottom: 8 }}>
          <input type="checkbox" checked={closed} onChange={(e) => toggleClosed(e.target.checked)} />
          Closed today
        </label>
      )}

      {closed ? (
        <p className="closed-banner">Kiosk closed</p>
      ) : (
        <>
          {shifts.map((shift, i) => (
            <div className="shift-row" key={i}>
              <div className="shift-times">
                <input
                  type="time"
                  className="time-input"
                  value={shift.start}
                  onChange={(e) => updateShift(i, { start: e.target.value })}
                />
                <span>–</span>
                <input
                  type="time"
                  className="time-input"
                  value={shift.end}
                  onChange={(e) => updateShift(i, { end: e.target.value })}
                />
              </div>
              {!isStaff && (
                <div className="shift-staff">
                  <select
                    className="text-input"
                    value={shift.staffId || ""}
                    onChange={(e) => updateShift(i, { staffId: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {settings.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.active === false ? `${s.name} (inactive)` : s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {shifts.length > 1 && (
                <button className="btn-ghost" onClick={() => removeShift(i)} aria-label="Remove shift">
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn btn-sm" onClick={addShift}>
              + Add shift
            </button>
          </div>
          <div className="hours-summary">
            <span>
              Scheduled: <strong>{totalHours.toFixed(2)} hrs</strong>
            </span>
            <span>
              Labor: <strong>${laborCost.toFixed(2)}</strong>
            </span>
          </div>
          {owedToday.map(({ staff, hours, earned }) => (
            <div className="day-pay-row" key={staff.id}>
              <span>
                {staff.name}
                <span className="day-pay-meta"> · {hours.toFixed(2)} hrs</span>
              </span>
              <strong>${earned.toFixed(2)}</strong>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
