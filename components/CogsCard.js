"use client";

import { isSettled, monthlyCogs, totalOutstanding } from "@/lib/model";

export default function CogsCard({ settings, days, payments, startKey, endKey, today }) {
  const cogs = monthlyCogs(settings, days, payments, startKey, endKey);
  const outstanding = totalOutstanding(settings, days, payments, today);
  const paidRows = cogs.wagesByStaff.filter((row) => row.paid > 0);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Cost of goods sold</h2>
      </div>

      <div className="section-label">Wages paid this month</div>
      {paidRows.length === 0 ? (
        <p className="empty-state">No wages paid this month yet.</p>
      ) : (
        paidRows.map(({ staff, paid }) => (
          <div className="cogs-row" key={staff.id}>
            <span>{staff.name}</span>
            <span className="cogs-value">${paid.toFixed(2)}</span>
          </div>
        ))
      )}

      <div className="cogs-row subtotal">
        <span>Labor</span>
        <span className="cogs-value">${cogs.wages.toFixed(2)}</span>
      </div>
      <div className="cogs-row subtotal">
        <span>
          Ingredients
          <span className="cogs-note">
            {cogs.unitsSold} sold × ${(settings.unitCost || 0).toFixed(2)}
          </span>
        </span>
        <span className="cogs-value">${cogs.ingredients.toFixed(2)}</span>
      </div>

      <div className="cogs-row total">
        <span>COGS</span>
        <span className="cogs-value">${cogs.total.toFixed(2)}</span>
      </div>
      {cogs.perMacaron !== null && (
        <p className="card-subtitle">${cogs.perMacaron.toFixed(2)} per macaron sold</p>
      )}

      <div className={`balance-bar${isSettled(outstanding) ? " clear" : ""}`}>
        {isSettled(outstanding) ? (
          <span>All clear — nothing outstanding</span>
        ) : (
          <>
            <span>Still owed to staff</span>
            <strong>${outstanding.toFixed(2)}</strong>
          </>
        )}
      </div>
    </section>
  );
}
