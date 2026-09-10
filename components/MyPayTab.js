"use client";

import { formatMonthDay, todayKey } from "@/lib/dates";
import {
  findWeekPayment,
  isSettled,
  payrollWindow,
  staffEarningsInRange,
  totalOutstanding,
} from "@/lib/model";

// The staff-facing pay view. It only ever receives the signed-in person's own
// data, since the server strips everyone else's out before it reaches here.
export default function MyPayTab({ settings, days, payments, startKey, endKey, periodLabel }) {
  const today = todayKey();
  const window = payrollWindow(days, startKey, endKey, today);
  const partial = window !== null && window.end < endKey;
  const rows = window ? staffEarningsInRange(settings, days, window.start, window.end) : [];
  const mine = rows[0] || { hours: 0, earned: 0 };
  const outstanding = totalOutstanding(settings, days, payments, today);
  const periodPayments = payments.filter((p) => p.paidOn >= startKey && p.paidOn <= endKey);

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>{periodLabel}</h2>
          {partial && <span className="card-subtitle" style={{ margin: 0 }}>so far</span>}
        </div>
        <div className="stat-grid">
          <div className="stat-tile accent-pistachio">
            <div className="stat-label">Hours</div>
            <div className="stat-value">{mine.hours.toFixed(2)}</div>
          </div>
          <div className="stat-tile accent-raspberry">
            <div className="stat-label">Earned</div>
            <div className="stat-value">${mine.earned.toFixed(2)}</div>
            <div className="stat-sub">at ${settings.staff[0]?.rate ?? 0}/hr</div>
          </div>
        </div>

        <div className={`balance-bar${isSettled(outstanding) ? " clear" : ""}`} style={{ marginTop: 12 }}>
          {isSettled(outstanding) ? (
            <span>All paid up</span>
          ) : (
            <>
              <span>Still owed to you</span>
              <strong>${outstanding.toFixed(2)}</strong>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Payments received</h2>
        </div>
        {periodPayments.length === 0 ? (
          <p className="empty-state">Nothing paid out in this period.</p>
        ) : (
          periodPayments
            .slice()
            .sort((a, b) => (a.paidOn < b.paidOn ? 1 : -1))
            .map((p) => (
              <div className="cogs-row" key={p.id}>
                <span>
                  {formatMonthDay(p.paidOn)}
                  <span className="cogs-note">for week of {formatMonthDay(p.weekStart)}</span>
                </span>
                <span className="cogs-value">${p.amount.toFixed(2)}</span>
              </div>
            ))
        )}
      </section>
    </>
  );
}
