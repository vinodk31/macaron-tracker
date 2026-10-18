"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayInRange,
  endOfMonth,
  endOfWeek,
  formatLongDate,
  formatMonthYear,
  fromKey,
  isToday,
  startOfMonth,
  startOfWeek,
  todayKey,
} from "@/lib/dates";
import {
  getShiftsForDate,
  isClosedForDate,
  isUsingDefaultHours,
  laborCostInRange,
  scheduledHoursInRange,
} from "@/lib/model";
import HoursCard from "./HoursCard";

// The week starts on Monday everywhere else in the app, so the grid does too.
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

// Owners only. Staff never get this tab, and the server never sends them a
// colleague's shift in the first place, so there is nothing here for them to
// see even with the payload in hand.
export default function ScheduleTab({ settings, days, anchor, onAnchorChange, onUpdateDay }) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const [selected, setSelected] = useState(() => {
    const today = todayKey();
    return today >= monthStart && today <= monthEnd ? today : monthStart;
  });

  // Whole weeks, so the grid is square even when the month starts mid-week.
  const cells = eachDayInRange(startOfWeek(monthStart), endOfWeek(monthEnd));
  const hours = scheduledHoursInRange(settings, days, monthStart, monthEnd);
  const cost = laborCostInRange(settings, days, monthStart, monthEnd);

  function goToMonth(nextAnchor) {
    onAnchorChange(nextAnchor);
    // Keep the selection inside the month being looked at, so the editor below
    // is always showing a day that is actually on screen.
    setSelected(startOfMonth(nextAnchor));
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
                onClick={() => setSelected(dateKey)}
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
