"use client";

import { useState } from "react";
import { addDays, formatShortDate, isToday, todayKey } from "@/lib/dates";
import { COMPARISON_PERIODS, flavorCountAsOf, flavorSoldInRange, lastKnownCountBefore } from "@/lib/model";
import HoursCard from "./HoursCard";

export default function DayTab({ settings, days, dateKey, onDateChange, onUpdateDay }) {
  const [periodId, setPeriodId] = useState("yesterday");
  const period = COMPARISON_PERIODS.find((p) => p.id === periodId) || COMPARISON_PERIODS[0];
  const comparisonKey = period.offset(dateKey);
  const day = days[dateKey] || {};

  function setCount(flavorId, raw) {
    onUpdateDay(dateKey, (d) => {
      const counts = { ...(d.counts || {}) };
      if (raw === "") {
        delete counts[flavorId];
      } else {
        const n = Number(raw);
        if (!Number.isNaN(n)) counts[flavorId] = n;
      }
      return { ...d, counts };
    });
  }

  function setNote(note) {
    onUpdateDay(dateKey, (d) => ({ ...d, note }));
  }

  return (
    <>
      <div className="date-nav">
        <button className="icon-btn" onClick={() => onDateChange(addDays(dateKey, -1))} aria-label="Previous day">
          ‹
        </button>
        <span className="date-label">{formatShortDate(dateKey)}</span>
        <button className="icon-btn" onClick={() => onDateChange(addDays(dateKey, 1))} aria-label="Next day">
          ›
        </button>
      </div>
      {!isToday(dateKey) && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: -6 }}>
          <button className="today-btn" onClick={() => onDateChange(todayKey())}>
            Jump to today
          </button>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <h2>In freezer</h2>
        </div>
        <div className="segmented" style={{ marginBottom: 10 }}>
          {COMPARISON_PERIODS.map((p) => (
            <button
              key={p.id}
              className={p.id === periodId ? "active" : ""}
              onClick={() => setPeriodId(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flavor-table">
          <div className="flavor-table-head">
            <span>Flavor</span>
            <span>Was</span>
            <span>Sold</span>
            <span>Today</span>
          </div>
          {settings.flavors.map((flavor) => {
            const was = flavorCountAsOf(days, flavor.id, comparisonKey);
            const { sold, restocked } = flavorSoldInRange(
              days,
              flavor.id,
              addDays(comparisonKey, 1),
              dateKey
            );
            const current = day.counts && typeof day.counts[flavor.id] === "number" ? day.counts[flavor.id] : "";
            const placeholder =
              current === "" ? lastKnownCountBefore(days, flavor.id, dateKey) : undefined;

            return (
              <div className="flavor-row" key={flavor.id}>
                <span className="col col-name flavor-name">{flavor.name}</span>
                <span className="col col-was">{typeof was === "number" ? was : "–"}</span>
                <span className="col col-sold">
                  <span>{sold}</span>
                  {restocked > 0 && <span className="restock-badge">+{restocked}</span>}
                </span>
                <span className="col">
                  <input
                    className="count-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={current}
                    placeholder={typeof placeholder === "number" ? String(placeholder) : ""}
                    onChange={(e) => setCount(flavor.id, e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <HoursCard settings={settings} days={days} dateKey={dateKey} onUpdateDay={onUpdateDay} />

      <section className="card">
        <div className="card-header">
          <h2>Note</h2>
        </div>
        <textarea
          className="text-input note-textarea"
          placeholder="Anything worth remembering about today…"
          value={day.note || ""}
          onChange={(e) => setNote(e.target.value)}
        />
      </section>
    </>
  );
}
