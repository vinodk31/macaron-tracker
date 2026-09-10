"use client";

import { addDays, endOfWeek, formatWeekRange, startOfWeek, todayKey, weekdayName } from "@/lib/dates";
import {
  dailyTotals,
  flavorRanking,
  freezerLevelAsOf,
  laborCostInRange,
  revenueInRange,
  scheduledHoursInRange,
} from "@/lib/model";
import StatTile from "./StatTile";
import BarChart from "./BarChart";
import FlavorRanking from "./FlavorRanking";
import PayrollCard from "./PayrollCard";

export default function WeekTab({
  settings,
  days,
  payments,
  anchor,
  onAnchorChange,
  onJumpToDay,
  onRecordPayment,
  onRemovePayment,
}) {
  const startKey = startOfWeek(anchor);
  const endKey = endOfWeek(anchor);
  const flavors = settings.flavors;

  const totals = dailyTotals(days, flavors, startKey, endKey);
  const unitsSold = totals.reduce((sum, t) => sum + t.sold, 0);
  const freezerEnd = freezerLevelAsOf(days, flavors, endKey);
  const scheduledHours = scheduledHoursInRange(settings, days, startKey, endKey);
  const laborCost = laborCostInRange(settings, days, startKey, endKey);
  const costPerMacaron = unitsSold > 0 ? laborCost / unitsSold : null;
  const ranking = flavorRanking(days, flavors, startKey, endKey);
  const revenue = revenueInRange(settings, days, startKey, endKey);

  return (
    <>
      <div className="date-nav">
        <button className="icon-btn" onClick={() => onAnchorChange(addDays(startKey, -7))} aria-label="Previous week">
          ‹
        </button>
        <span className="date-label">{formatWeekRange(anchor)}</span>
        <button className="icon-btn" onClick={() => onAnchorChange(addDays(startKey, 7))} aria-label="Next week">
          ›
        </button>
      </div>

      <div className="stat-grid">
        <StatTile label="Units sold" value={unitsSold} accent="raspberry" />
        <StatTile
          label="Revenue"
          value={`$${revenue.toFixed(0)}`}
          sub={`${freezerEnd} left in freezer`}
          accent="pistachio"
        />
        <StatTile label="Scheduled hours" value={scheduledHours.toFixed(1)} />
        <StatTile
          label="Labor cost"
          value={`$${laborCost.toFixed(0)}`}
          sub={costPerMacaron !== null ? `$${costPerMacaron.toFixed(2)} / unit` : "no sales yet"}
        />
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Sold per day</h2>
        </div>
        <BarChart totals={totals} dayLabel={(d) => weekdayName(d).slice(0, 1)} onJumpToDay={onJumpToDay} />
      </section>

      <PayrollCard
        settings={settings}
        days={days}
        payments={payments}
        weekStart={startKey}
        weekEnd={endKey}
        today={todayKey()}
        onRecordPayment={onRecordPayment}
        onRemovePayment={onRemovePayment}
      />

      <section className="card">
        <div className="card-header">
          <h2>By flavor</h2>
        </div>
        <FlavorRanking ranking={ranking} />
      </section>
    </>
  );
}
