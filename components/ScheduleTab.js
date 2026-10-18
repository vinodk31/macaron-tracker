"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayInRange,
  endOfMonth,
  endOfWeek,
  formatLongDate,
  formatMonthDay,
  formatMonthYear,
  fromKey,
  isToday,
  startOfMonth,
  startOfWeek,
  todayKey,
  weekdayIndex,
} from "@/lib/dates";
import {
  getDefaultShiftsForDate,
  getShiftsForDate,
  isClosedForDate,
  isUsingDefaultHours,
  laborCostInRange,
  scheduledHoursInRange,
} from "@/lib/model";
import HoursCard from "./HoursCard";

// The week starts on Monday everywhere else in the app, so the grid does too.
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

// Monday first, matching the grid directly above it. The order has to agree
// with the calendar or the two read as different weeks.
const WEEKDAYS = [
  { index: 1, initial: "M", name: "Monday" },
  { index: 2, initial: "T", name: "Tuesday" },
  { index: 3, initial: "W", name: "Wednesday" },
  { index: 4, initial: "T", name: "Thursday" },
  { index: 5, initial: "F", name: "Friday" },
  { index: 6, initial: "S", name: "Saturday" },
  { index: 0, initial: "S", name: "Sunday" },
];

// "Every Monday", "Weekdays", "Every day" — the same shorthand a phone alarm
// uses, so the row of circles can be read at a glance instead of counted.
function describeDays(picked) {
  if (picked.size === 0) return "No days picked";
  if (picked.size === 7) return "Every day";
  const working = [1, 2, 3, 4, 5];
  if (picked.size === 5 && working.every((d) => picked.has(d))) return "Weekdays";
  if (picked.size === 2 && picked.has(0) && picked.has(6)) return "Weekends";
  const names = WEEKDAYS.filter((d) => picked.has(d.index)).map((d) => d.name);
  return `Every ${names.join(", ")}`;
}

// Owners only. Staff never get this tab, and the server never sends them a
// colleague's shift in the first place, so there is nothing here for them to
// see even with the payload in hand.
export default function ScheduleTab({ settings, days, anchor, onAnchorChange, onUpdateDay }) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const selectedOnOpen = (() => {
    const today = todayKey();
    return today >= monthStart && today <= monthEnd ? today : monthStart;
  })();
  const [selected, setSelected] = useState(selectedOnOpen);
  // Seeded with the weekday of whatever is selected on open, which is usually
  // the day the owner came here to fill. It is not re-seeded when another day
  // is tapped: that would throw away a selection they just made by hand.
  const [picked, setPicked] = useState(() => new Set([weekdayIndex(selectedOnOpen)]));
  const [applyStaffId, setApplyStaffId] = useState(() => {
    const starred = settings.staff.find((s) => s.isDefault && s.active !== false);
    return (starred || settings.staff.find((s) => s.active !== false) || {}).id || "";
  });
  // Seeded from the store's own hours for that day, which is the shift being
  // worked most of the time anyway.
  const defaultShift = getDefaultShiftsForDate(settings, selected)[0];
  const [applyStart, setApplyStart] = useState(defaultShift ? defaultShift.start : "10:30");
  const [applyEnd, setApplyEnd] = useState(defaultShift ? defaultShift.end : "20:15");
  const [applyNote, setApplyNote] = useState("");

  // Whole weeks, so the grid is square even when the month starts mid-week.
  const cells = eachDayInRange(startOfWeek(monthStart), endOfWeek(monthEnd));
  const hours = scheduledHoursInRange(settings, days, monthStart, monthEnd);
  const cost = laborCostInRange(settings, days, monthStart, monthEnd);

  function selectDay(dateKey) {
    setSelected(dateKey);
    setApplyNote("");
  }

  function goToMonth(nextAnchor) {
    onAnchorChange(nextAnchor);
    setApplyNote("");
    // Keep the selection inside the month being looked at, so the editor below
    // is always showing a day that is actually on screen.
    setSelected(startOfMonth(nextAnchor));
  }

  // From the selected day to the end of the month, on the weekdays picked.
  // Running forward from the selection rather than from the first of the month
  // is what keeps a month-wide apply from rewriting shifts already worked
  // and paid.
  // Closed days are skipped: writing shifts behind a "Closed" banner would be
  // a lie, and nobody is scheduled on a day the kiosk is shut.
  function targetDays() {
    return eachDayInRange(selected, monthEnd).filter(
      (key) => picked.has(weekdayIndex(key)) && !isClosedForDate(settings, days, key)
    );
  }

  function toggleWeekday(index) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setApplyNote("");
  }

  function applyToScope(mode) {
    const targets = targetDays();
    const shift = { staffId: applyStaffId || null, start: applyStart, end: applyEnd };

    for (const dateKey of targets) {
      // Read per day before queueing the update. Each day is written once, so
      // this snapshot is that day's current state -- and it has to come from
      // the effective schedule, or adding to a day still on store hours would
      // drop the person already working it.
      const existing = getShiftsForDate(settings, days, dateKey);
      const alreadyThere = existing.some(
        (s) => s.staffId === shift.staffId && s.start === shift.start && s.end === shift.end
      );

      onUpdateDay(dateKey, (day) => {
        if (mode === "clear") {
          const { hours, ...rest } = day;
          return rest;
        }
        if (mode === "set") return { ...day, hours: { shifts: [shift] } };
        if (alreadyThere) return day;
        return { ...day, hours: { shifts: [...existing, shift] } };
      });
    }
    const verb = mode === "clear" ? "Reset" : mode === "set" ? "Set" : "Added to";
    setApplyNote(
      targets.length === 0
        ? "Nothing to change — those days are closed."
        : `${verb} ${targets.length} day${targets.length === 1 ? "" : "s"}, ${formatMonthDay(targets[0])}–${formatMonthDay(targets.at(-1))}.`
    );
  }

  function initialsFor(dateKey) {
    return getShiftsForDate(settings, days, dateKey).map((shift) => {
      const staff = settings.staff.find((p) => p.id === shift.staffId);
      return staff ? staff.name.trim().charAt(0).toUpperCase() : "?";
    });
  }

  return (
    <>
      <div className="date-nav">
        <button className="icon-btn" onClick={() => goToMonth(addMonths(anchor, -1))} aria-label="Previous month">
          ‹
        </button>
        <span className="date-label">{formatMonthYear(anchor)}</span>
        <button className="icon-btn" onClick={() => goToMonth(addMonths(anchor, 1))} aria-label="Next month">
          ›
        </button>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Schedule</h2>
          <span className="card-subtitle" style={{ margin: 0 }}>
            {hours.toFixed(1)} hrs · ${cost.toFixed(0)}
          </span>
        </div>
        <p className="card-subtitle">
          Tap a day to set who works it. Days nobody has touched run on the store hours from Setup —
          edit one and it keeps what you give it.
        </p>

        <div className="cal-grid cal-head">
          {WEEKDAY_INITIALS.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>

        <div className="cal-grid">
          {cells.map((dateKey) => {
            const inMonth = dateKey >= monthStart && dateKey <= monthEnd;
            const closed = isClosedForDate(settings, days, dateKey);
            const edited = !isUsingDefaultHours(days, dateKey);
            const initials = closed ? [] : initialsFor(dateKey);
            const classes = [
              "cal-cell",
              inMonth ? "" : "outside",
              dateKey === selected ? "selected" : "",
              isToday(dateKey) ? "today" : "",
              closed ? "closed" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={dateKey}
                className={classes}
                onClick={() => selectDay(dateKey)}
                aria-label={`${formatLongDate(dateKey)}${closed ? ", closed" : ""}`}
                aria-pressed={dateKey === selected}
              >
                <span className="cal-date">{fromKey(dateKey).getDate()}</span>
                {closed ? (
                  <span className="cal-closed">–</span>
                ) : (
                  <span className="cal-who">
                    {initials.slice(0, 2).map((letter, i) => (
                      <span className="cal-initial" key={i}>
                        {letter}
                      </span>
                    ))}
                    {initials.length > 2 && <span className="cal-more">+{initials.length - 2}</span>}
                  </span>
                )}
                {edited && inMonth && <span className="cal-edited" />}
              </button>
            );
          })}
        </div>

        <div className="cal-legend">
          <span>
            <span className="cal-edited legend-dot" /> edited
          </span>
          <span>– closed</span>
        </div>
      </section>

      <div className="cal-selected-label">{formatLongDate(selected)}</div>

      <section className="card">
        <div className="card-header">
          <h2>Apply a shift</h2>
        </div>
        <p className="card-subtitle">
          From the day you picked through the end of the month, on the days lit up below. Closed
          days are left alone.
        </p>

        <div className="repeat-row">
          <span className="repeat-label">Repeat</span>
          <span className="repeat-summary">{describeDays(picked)}</span>
        </div>
        <div className="weekday-picker">
          {WEEKDAYS.map((d) => (
            <button
              key={d.index}
              type="button"
              className={`weekday-chip${picked.has(d.index) ? " on" : ""}`}
              aria-pressed={picked.has(d.index)}
              aria-label={d.name}
              onClick={() => toggleWeekday(d.index)}
            >
              {d.initial}
            </button>
          ))}
        </div>

        <div className="apply-row">
          <select
            className="text-input grow"
            aria-label="Who works it"
            value={applyStaffId}
            onChange={(e) => setApplyStaffId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {settings.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.active === false ? `${s.name} (inactive)` : s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="apply-row">
          <input
            type="time"
            className="time-input"
            aria-label="Shift start"
            value={applyStart}
            onChange={(e) => setApplyStart(e.target.value)}
          />
          <span>–</span>
          <input
            type="time"
            className="time-input"
            aria-label="Shift end"
            value={applyEnd}
            onChange={(e) => setApplyEnd(e.target.value)}
          />
        </div>

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={picked.size === 0}
            onClick={() => applyToScope("set")}
          >
            Set
          </button>
          <button className="btn btn-sm" disabled={picked.size === 0} onClick={() => applyToScope("add")}>
            Add
          </button>
          <button className="btn btn-sm" disabled={picked.size === 0} onClick={() => applyToScope("clear")}>
            Reset
          </button>
        </div>
        {applyNote && <p className="apply-note">{applyNote}</p>}
        <p className="card-subtitle">
          <strong>Set</strong> replaces whoever was on those days, <strong>Add</strong> puts this
          shift alongside them, and <strong>Reset</strong> hands them back to the store hours in
          Setup.
        </p>
      </section>

      <HoursCard
        settings={settings}
        days={days}
        isStaff={false}
        dateKey={selected}
        onUpdateDay={onUpdateDay}
      />
    </>
  );
}
