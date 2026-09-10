"use client";

import { useState } from "react";
import { makeId, makePin } from "@/lib/model";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SetupTab({ settings, onUpdateSettings, onEraseAllData }) {
  const [confirmingErase, setConfirmingErase] = useState(false);

  function updateHours(wd, patch) {
    onUpdateSettings((s) => ({ ...s, hours: { ...s.hours, [wd]: { ...s.hours[wd], ...patch } } }));
  }

  function setBuffer(key, raw) {
    const n = Number(raw);
    onUpdateSettings((s) => ({ ...s, [key]: Number.isNaN(n) ? 0 : n }));
  }

  function updateStaff(id, patch) {
    onUpdateSettings((s) => ({
      ...s,
      staff: s.staff.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function setDefaultStaff(id) {
    onUpdateSettings((s) => ({
      ...s,
      staff: s.staff.map((p) => ({ ...p, isDefault: p.id === id })),
    }));
  }

  function addStaff() {
    onUpdateSettings((s) => ({
      ...s,
      staff: [
        ...s.staff,
        {
          id: makeId("staff"),
          name: "New staff",
          rate: 15,
          isDefault: s.staff.length === 0,
          active: true,
          pin: makePin(s.staff),
        },
      ],
    }));
  }

  function regeneratePin(id) {
    onUpdateSettings((s) => ({
      ...s,
      staff: s.staff.map((p) => (p.id === id ? { ...p, pin: makePin(s.staff) } : p)),
    }));
  }

  function removeStaff(id) {
    onUpdateSettings((s) => ({ ...s, staff: s.staff.filter((p) => p.id !== id) }));
  }

  function updateFlavor(id, name) {
    onUpdateSettings((s) => ({
      ...s,
      flavors: s.flavors.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  }

  function addFlavor() {
    onUpdateSettings((s) => ({
      ...s,
      flavors: [...s.flavors, { id: makeId("flavor"), name: "New flavor" }],
    }));
  }

  function removeFlavor(id) {
    onUpdateSettings((s) => ({ ...s, flavors: s.flavors.filter((f) => f.id !== id) }));
  }

  function handleErase() {
    if (!confirmingErase) {
      setConfirmingErase(true);
      return;
    }
    onEraseAllData();
    setConfirmingErase(false);
  }

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2>Shop</h2>
        </div>
        <div className="field">
          <label>Shop name</label>
          <input
            className="text-input"
            type="text"
            value={settings.shopName}
            onChange={(e) => onUpdateSettings((s) => ({ ...s, shopName: e.target.value }))}
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Cost per macaron ($)</label>
          <input
            className="number-input"
            type="number"
            min="0"
            step="0.01"
            value={settings.unitCost ?? 0}
            onChange={(e) =>
              onUpdateSettings((s) => ({ ...s, unitCost: Number(e.target.value) || 0 }))
            }
          />
          <p className="card-subtitle">Ingredient cost used for the month-end COGS figure.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Store hours</h2>
        </div>
        {DISPLAY_ORDER.map((wd) => {
          const h = settings.hours[wd];
          return (
            <div className="weekday-row" key={wd}>
              <span className="weekday-name">{WEEKDAY_LABELS[wd]}</span>
              {h.closed ? (
                <span className="col-was" style={{ gridColumn: "span 2" }}>
                  Closed
                </span>
              ) : (
                <>
                  <input
                    type="time"
                    className="time-input"
                    value={h.open}
                    onChange={(e) => updateHours(wd, { open: e.target.value })}
                  />
                  <input
                    type="time"
                    className="time-input"
                    value={h.close}
                    onChange={(e) => updateHours(wd, { close: e.target.value })}
                  />
                </>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) => updateHours(wd, { closed: e.target.checked })}
                />
                Off
              </label>
            </div>
          );
        })}

        <div className="card-header" style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: "0.95rem" }}>Buffers</h2>
        </div>
        <div className="btn-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Prep before open (min)</label>
            <input
              className="number-input"
              type="number"
              min="0"
              value={settings.prepBufferMin}
              onChange={(e) => setBuffer("prepBufferMin", e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Close-out after (min)</label>
            <input
              className="number-input"
              type="number"
              min="0"
              value={settings.closeBufferMin}
              onChange={(e) => setBuffer("closeBufferMin", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Staff</h2>
          <button className="btn btn-sm" onClick={addStaff}>
            + Add
          </button>
        </div>
        {settings.staff.length === 0 && <p className="empty-state">No staff yet.</p>}
        {settings.staff.map((p) => (
          <div className="list-row" key={p.id}>
            <button
              className={`star-btn${p.isDefault ? " starred" : ""}`}
              onClick={() => setDefaultStaff(p.id)}
              aria-label="Set as auto-scheduled staff"
              title="Auto-scheduled"
            >
              {p.isDefault ? "★" : "☆"}
            </button>
            <input
              className="text-input grow"
              type="text"
              value={p.name}
              onChange={(e) => updateStaff(p.id, { name: e.target.value })}
            />
            <input
              className="number-input rate-input"
              type="number"
              min="0"
              step="0.25"
              value={p.rate}
              onChange={(e) => updateStaff(p.id, { rate: Number(e.target.value) || 0 })}
            />
            <label className="checkbox-label active-toggle" title="Inactive staff cannot sign in">
              <input
                type="checkbox"
                checked={p.active !== false}
                onChange={(e) => updateStaff(p.id, { active: e.target.checked })}
              />
              Active
            </label>
            <button className="btn-ghost" onClick={() => removeStaff(p.id)} aria-label="Remove staff">
              ✕
            </button>
          </div>
        ))}
        {settings.staff.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 12 }}>Sign-in PINs</div>
            {settings.staff.map((p) => (
              <div className="pin-row" key={p.id}>
                <span className="pin-name">{p.name}</span>
                {p.active === false ? (
                  <span className="pin-none">inactive</span>
                ) : p.pin ? (
                  <code className="pin-code">{p.pin}</code>
                ) : (
                  <span className="pin-none">no PIN</span>
                )}
                <button className="btn btn-sm" onClick={() => regeneratePin(p.id)}>
                  {p.pin ? "New PIN" : "Generate"}
                </button>
              </div>
            ))}
            <p className="card-subtitle">
              Staff sign in with these 5 digits via the Staff PIN button on the login screen. They
              only ever see their own pay and hours. Issuing a new PIN immediately retires the old one,
              and switching someone to inactive stops their PIN working without touching what they are owed.
            </p>
          </>
        )}
        <p className="card-subtitle">★ marks who gets auto-scheduled for each day&apos;s default shift.</p>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Flavors</h2>
          <button className="btn btn-sm" onClick={addFlavor}>
            + Add
          </button>
        </div>
        {settings.flavors.length === 0 && <p className="empty-state">No flavors yet.</p>}
        {settings.flavors.map((f) => (
          <div className="list-row" key={f.id}>
            <input
              className="text-input grow"
              type="text"
              value={f.name}
              onChange={(e) => updateFlavor(f.id, e.target.value)}
            />
            <button className="btn-ghost" onClick={() => removeFlavor(f.id)} aria-label="Remove flavor">
              ✕
            </button>
          </div>
        ))}
      </section>

      <section className="card danger-zone">
        <div className="card-header">
          <h2>Erase all data</h2>
        </div>
        <p>
          {confirmingErase
            ? "This permanently deletes every logged count, note, and shift. Shop settings stay. Are you sure?"
            : "Wipes every logged day — counts, notes, and shift overrides. Shop settings stay untouched."}
        </p>
        <div className="btn-row">
          <button className="btn btn-danger" onClick={handleErase}>
            {confirmingErase ? "Yes, erase everything" : "Erase all data"}
          </button>
          {confirmingErase && (
            <button className="btn" onClick={() => setConfirmingErase(false)}>
              Cancel
            </button>
          )}
        </div>
      </section>
    </>
  );
}
