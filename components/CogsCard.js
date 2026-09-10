"use client";

import { hasUnpricedProducts, isSettled, monthlyCogs, totalOutstanding } from "@/lib/model";

export default function CogsCard({ settings, days, payments, startKey, endKey, today }) {
  const cogs = monthlyCogs(settings, days, payments, startKey, endKey);
  const outstanding = totalOutstanding(settings, days, payments, today);
  const paidRows = cogs.wagesByStaff.filter((row) => row.paid > 0);
  const soldProducts = cogs.byProduct.filter((row) => row.units > 0);
  const unpriced = hasUnpricedProducts(settings);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Revenue &amp; COGS</h2>
      </div>

      {unpriced && (
        <p className="login-error">
          Some products have no price yet, so revenue is understated. Set them in Setup.
        </p>
      )}

      <div className="section-label">Sold this month</div>
      {soldProducts.length === 0 ? (
        <p className="empty-state">Nothing sold yet this month.</p>
      ) : (
        soldProducts.map(({ product, units, revenue }) => (
          <div className="cogs-row" key={product.id}>
            <span>
              {product.name}
              <span className="cogs-note">
                {units} × ${(product.price || 0).toFixed(2)}
              </span>
            </span>
            <span className="cogs-value">${revenue.toFixed(2)}</span>
          </div>
        ))
      )}
      <div className="cogs-row subtotal">
        <span>Revenue</span>
        <span className="cogs-value">${cogs.revenue.toFixed(2)}</span>
      </div>

      <div className="section-label" style={{ marginTop: 12 }}>
        Costs
      </div>
      {paidRows.map(({ staff, paid }) => (
        <div className="cogs-row" key={staff.id}>
          <span>
            {staff.name}
            <span className="cogs-note">wages paid</span>
          </span>
          <span className="cogs-value">${paid.toFixed(2)}</span>
        </div>
      ))}
      <div className="cogs-row subtotal">
        <span>Labor</span>
        <span className="cogs-value">${cogs.wages.toFixed(2)}</span>
      </div>
      <div className="cogs-row subtotal">
        <span>
          Ingredients
          <span className="cogs-note">{cogs.unitsSold} sold</span>
        </span>
        <span className="cogs-value">${cogs.ingredients.toFixed(2)}</span>
      </div>
      <div className="cogs-row subtotal">
        <span>COGS</span>
        <span className="cogs-value">${cogs.total.toFixed(2)}</span>
      </div>

      <div className={`cogs-row total${cogs.margin < 0 ? " negative" : ""}`}>
        <span>Gross margin</span>
        <span className="cogs-value">${cogs.margin.toFixed(2)}</span>
      </div>
      {cogs.perMacaron !== null && (
        <p className="card-subtitle">${cogs.perMacaron.toFixed(2)} cost per unit sold</p>
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
