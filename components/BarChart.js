"use client";

import { todayKey } from "@/lib/dates";

export default function BarChart({ totals, dayLabel, onJumpToDay }) {
  const max = Math.max(1, ...totals.map((t) => Math.max(t.sold, t.restocked)));
  const today = todayKey();

  return (
    <>
      <div className="bar-chart">
        {totals.map((t) => {
          const isRestockOnly = t.restocked > 0 && t.sold === 0;
          const value = isRestockOnly ? t.restocked : t.sold;
          const heightPct = value > 0 ? Math.max(4, (value / max) * 100) : 2;
          return (
            <button
              key={t.date}
              className={`bar-col${t.date === today ? " is-today" : ""}`}
              onClick={() => onJumpToDay(t.date)}
              title={`${t.date}: ${t.sold} sold${t.restocked ? `, +${t.restocked} restocked` : ""}`}
            >
              <div
                className={`bar${isRestockOnly ? " restock" : value > 0 ? " sold" : ""}`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="bar-day-label">{dayLabel(t.date)}</span>
            </button>
          );
        })}
      </div>
      <div className="chart-legend">
        <span>
          <span className="legend-swatch sold" /> Sold
        </span>
        <span>
          <span className="legend-swatch restock" /> Restocked
        </span>
      </div>
    </>
  );
}
