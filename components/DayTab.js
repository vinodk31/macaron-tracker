"use client";

import { useState } from "react";
import { addDays, formatShortDate, isToday, todayKey } from "@/lib/dates";
import {
  COMPARISON_PERIODS,
  flavorCountAsOf,
  flavorSoldInRange,
  flavorsForProduct,
  formatTrays,
  isTrayed,
  lastKnownCountBefore,
  trayCapacity,
  traysToUnits,
  unitsToTrays,
} from "@/lib/model";
import HoursCard from "./HoursCard";

export default function DayTab({ settings, days, isStaff, dateKey, onDateChange, onUpdateDay }) {
  const [periodId, setPeriodId] = useState("yesterday");
  // What is being typed right now, before it becomes a number. Without it,
  // "4." on a trayed flavor would round-trip through the stored piece count
  // and lose the dot mid-keystroke.
  const [draft, setDraft] = useState(null);
  const period = COMPARISON_PERIODS.find((p) => p.id === periodId) || COMPARISON_PERIODS[0];
  const comparisonKey = period.offset(dateKey);
  const day = days[dateKey] || {};

  function setCount(flavor, raw) {
    setDraft({ flavorId: flavor.id, dateKey, text: raw });
    onUpdateDay(dateKey, (d) => {
      const counts = { ...(d.counts || {}) };
      if (raw === "") {
        delete counts[flavor.id];
      } else {
        const n = Number(raw);
        if (!Number.isNaN(n)) counts[flavor.id] = traysToUnits(n, flavor);
      }
      return { ...d, counts };
    });
  }

  // Trays may be typed as a part tray ("4.5"); pieces stay whole numbers.
  function sanitize(raw, trayed) {
    const cleaned = raw.replace(trayed ? /[^0-9.]/g : /[^0-9]/g, "");
    if (!trayed) return cleaned;
    const [whole, ...rest] = cleaned.split(".");
    return rest.length ? `${whole}.${rest.join("")}` : whole;
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

        {settings.flavors.some(isTrayed) && (
          <p className="card-subtitle" style={{ marginTop: 0 }}>
            Trayed flavors are counted in trays — part trays are fine (4.5). Sold is always in
            pieces.
          </p>
        )}

        <div className="flavor-table">
          <div className="flavor-table-head">
            <span>Flavor</span>
            <span>Was</span>
            <span>Sold</span>
            <span>Today</span>
          </div>
          {settings.products.map((product) => {
            const flavors = flavorsForProduct(settings, product.id);
            if (flavors.length === 0) return null;
            return (
              <div key={product.id}>
                <div className="product-heading">{product.name}</div>
                {flavors.map((flavor) => {
                  const trayed = isTrayed(flavor);
                  // Freezer columns are in whatever the freezer is counted in;
                  // sold stays in pieces, since that is what gets priced.
                  const asEntered = (units) =>
                    trayed ? formatTrays(unitsToTrays(units, flavor)) : String(units);
                  const was = flavorCountAsOf(days, flavor.id, comparisonKey);
                  const { sold, restocked } = flavorSoldInRange(
                    days,
                    flavor.id,
                    addDays(comparisonKey, 1),
                    dateKey
                  );
                  const stored =
                    day.counts && typeof day.counts[flavor.id] === "number"
                      ? day.counts[flavor.id]
                      : null;
                  const editing =
                    draft && draft.flavorId === flavor.id && draft.dateKey === dateKey;
                  const current = editing ? draft.text : stored === null ? "" : asEntered(stored);
                  const placeholder =
                    stored === null ? lastKnownCountBefore(days, flavor.id, dateKey) : undefined;

                  return (
                    <div className="flavor-row" key={flavor.id}>
                      <span className="col col-name">
                        <span className="flavor-name">{flavor.name}</span>
                        {trayed && (
                          <span className="flavor-sub">{trayCapacity(flavor)} / tray</span>
                        )}
                      </span>
                      <span className="col col-was">
                        {typeof was === "number" ? asEntered(was) : "–"}
                      </span>
                      <span className="col col-sold">
                        <span>{sold}</span>
                        {restocked > 0 && <span className="restock-badge">+{restocked}</span>}
                      </span>
                      <span className="col">
                        <input
                          className="count-input"
                          type="text"
                          inputMode={trayed ? "decimal" : "numeric"}
                          pattern={trayed ? "[0-9.]*" : "[0-9]*"}
                          aria-label={`${flavor.name} — ${trayed ? "trays" : "pieces"} in freezer`}
                          value={current}
                          placeholder={
                            typeof placeholder === "number" ? asEntered(placeholder) : ""
                          }
                          onChange={(e) => setCount(flavor, sanitize(e.target.value, trayed))}
                          onBlur={() => setDraft(null)}
                        />
                        {trayed && stored !== null && (
                          <span className="count-sub">= {stored}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <HoursCard settings={settings} days={days} isStaff={isStaff} dateKey={dateKey} onUpdateDay={onUpdateDay} />

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
