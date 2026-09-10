"use client";

import { formatMonthDay } from "@/lib/dates";
import {
  findWeekPayment,
  isSettled,
  payrollWindow,
  staffEarningsInRange,
  totalOutstanding,
} from "@/lib/model";

export default function PayrollCard({
  settings,
  days,
  payments,
  weekStart,
  weekEnd,
  today,
  onRecordPayment,
  onRemovePayment,
}) {
  const window = payrollWindow(days, weekStart, weekEnd, today);
  const partialWeek = window !== null && window.end < weekEnd;
  const earnings = window
    ? staffEarningsInRange(settings, days, window.start, window.end).filter(
        (row) => row.earned > 0 || findWeekPayment(payments, row.staff.id, weekStart)
      )
    : [];
  const outstanding = totalOutstanding(settings, days, payments, today);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Payroll</h2>
        <span className="card-subtitle" style={{ margin: 0 }}>
          {formatMonthDay(weekStart)} – {formatMonthDay(weekEnd)}
          {partialWeek ? " · so far" : ""}
        </span>
      </div>

      {earnings.length === 0 ? (
        <p className="empty-state">Nobody scheduled this week yet.</p>
      ) : (
        earnings.map(({ staff, hours, earned }) => {
          const payment = findWeekPayment(payments, staff.id, weekStart);
          return (
            <div className="payroll-row" key={staff.id}>
              <div className="payroll-who">
                <span className="payroll-name">{staff.name}</span>
                <span className="payroll-meta">
                  {hours.toFixed(2)} hrs @ ${staff.rate}/hr
                </span>
              </div>
              <div className="payroll-amount">
                <span className="payroll-earned">${earned.toFixed(2)}</span>
                {payment ? (
                  <span className="payroll-paid-note">paid {formatMonthDay(payment.paidOn)}</span>
                ) : null}
              </div>
              {payment ? (
                <button
                  className="btn btn-sm payroll-action paid"
                  onClick={() => onRemovePayment(payment.id)}
                  title="Undo this payment"
                >
                  Paid ✓
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm payroll-action"
                  onClick={() => onRecordPayment(staff.id, weekStart, earned)}
                >
                  Mark paid
                </button>
              )}
            </div>
          );
        })
      )}

      <div className={`balance-bar${isSettled(outstanding) ? " clear" : ""}`}>
        {isSettled(outstanding) ? (
          <span>All clear — nothing outstanding</span>
        ) : (
          <>
            <span>Outstanding</span>
            <strong>${outstanding.toFixed(2)}</strong>
          </>
        )}
      </div>
    </section>
  );
}
