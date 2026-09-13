"use client";

import { useState } from "react";
import { makeId } from "@/lib/model";
import { issuePin, setPin } from "@/lib/pins";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SetupTab({ settings, onUpdateSettings, onEraseAllData }) {
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [pinError, setPinError] = useState("");
  const [editingPin, setEditingPin] = useState(null);
  const [pinDraft, setPinDraft] = useState("");

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

  async function addStaff() {
    setPinError("");
    let pin;
    try {
      pin = await issuePin();
    } catch {
      setPinError("Could not issue a PIN. Try again.");
      return;
    }
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
          pin,
        },
      ],
    }));
  }

  async function regeneratePin(id) {
    setPinError("");
    let pin;
    try {
      pin = await issuePin();
    } catch {
      setPinError("Could not issue a PIN. Try again.");
      return;
    }
    onUpdateSettings((s) => ({
      ...s,
      staff: s.staff.map((p) => (p.id === id ? { ...p, pin } : p)),
    }));
  }

  function startEditingPin(id, current) {
    setPinError("");
    setEditingPin(id);
    setPinDraft(current || "");
  }

  // The server owns uniqueness across locations, so a chosen PIN is checked
  // there before it goes into settings.
  async function saveChosenPin(id) {
    setPinError("");
    const result = await setPin({ staffId: id, pin: pinDraft });
    if (!result.ok) {
      setPinError(result.error);
      return;
    }
    onUpdateSettings((s) => ({
      ...s,
      staff: s.staff.map((p) => (p.id === id ? { ...p, pin: result.pin } : p)),
    }));
    setEditingPin(null);
    setPinDraft("");
  }

  function removeStaff(id) {
    onUpdateSettings((s) => ({ ...s, staff: s.staff.filter((p) => p.id !== id) }));
  }

  function updateProduct(id, patch) {
    onUpdateSettings((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function addProduct() {
    onUpdateSettings((s) => ({
      ...s,
      products: [...s.products, { id: makeId("product"), name: "New product", price: 0, unitCost: 0 }],
    }));
  }

  // Flavors belong to a product, so removing one would orphan its counts.
  function removeProduct(id) {
    onUpdateSettings((s) => {
      if (s.flavors.some((f) => f.productId === id)) return s;
      return { ...s, products: s.products.filter((p) => p.id !== id) };
    });
  }

  function updateFlavor(id, name) {
    onUpdateSettings((s) => ({
      ...s,
      flavors: s.flavors.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  }

  function addFlavor(productId) {
    onUpdateSettings((s) => ({
      ...s,
      flavors: [...s.flavors, { id: makeId("flavor"), productId, name: "New flavor" }],
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
            {pinError && <p className="login-error">{pinError}</p>}
            {settings.staff.map((p) => (
              <div key={p.id}>
                <div className="pin-row">
                  <span className="pin-name">{p.name}</span>
                  {p.active === false ? (
                    <span className="pin-none">inactive</span>
                  ) : p.pin ? (
                    <code className="pin-code">{p.pin}</code>
                  ) : (
                    <span className="pin-none">no PIN</span>
                  )}
                  <button className="btn btn-sm" onClick={() => startEditingPin(p.id, p.pin)}>
                    Set
                  </button>
                  <button className="btn btn-sm" onClick={() => regeneratePin(p.id)}>
                    Random
                  </button>
                </div>
                {editingPin === p.id && (
                  <div className="pin-edit-row">
                    <input
                      className="text-input pin-input pin-edit-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      aria-label={`PIN for ${p.name}`}
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value.replace(/[^0-9]/g, ""))}
                      autoFocus
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={pinDraft.length !== 5}
                      onClick={() => saveChosenPin(p.id)}
                    >
                      Save
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingPin(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
            <p className="card-subtitle">
              Staff sign in with these 5 digits via the Staff PIN button on the login screen. They
              only ever see their own pay and hours. <strong>Set</strong> picks a specific number,
              <strong> Random</strong> issues an unused one; either way the old PIN stops working at
              once. Staff can change their own PIN from their Account tab, and it stays visible here.
              Switching someone to inactive stops their PIN working without touching what they are owed.
            </p>
          </>
        )}
        <p className="card-subtitle">★ marks who gets auto-scheduled for each day&apos;s default shift.</p>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Products</h2>
          <button className="btn btn-sm" onClick={addProduct}>
            + Add
          </button>
        </div>
        <p className="card-subtitle">
          Price and ingredient cost live on the product, so every flavor under it follows. Flavors
          are what you count in the freezer.
        </p>

        {settings.products.map((product) => {
          const flavors = settings.flavors.filter((f) => f.productId === product.id);
          return (
            <div className="product-block" key={product.id}>
              <div className="list-row">
                <input
                  className="text-input grow"
                  type="text"
                  value={product.name}
                  onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                />
                <button
                  className="btn-ghost"
                  onClick={() => removeProduct(product.id)}
                  aria-label="Remove product"
                  title={
                    flavors.length > 0
                      ? "Remove its flavors first"
                      : "Remove product"
                  }
                  disabled={flavors.length > 0}
                >
                  ✕
                </button>
              </div>
              <div className="btn-row">
                <div className="field" style={{ flex: 1 }}>
                  <label>Price ($)</label>
                  <input
                    className={`number-input${product.price ? "" : " needs-value"}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.price ?? 0}
                    onChange={(e) =>
                      updateProduct(product.id, { price: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Cost ($)</label>
                  <input
                    className="number-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.unitCost ?? 0}
                    onChange={(e) =>
                      updateProduct(product.id, { unitCost: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="section-label">Flavors</div>
              {flavors.length === 0 && <p className="empty-state">No flavors yet.</p>}
              {flavors.map((f) => (
                <div className="list-row" key={f.id}>
                  <input
                    className="text-input grow"
                    type="text"
                    value={f.name}
                    onChange={(e) => updateFlavor(f.id, e.target.value)}
                  />
                  <button
                    className="btn-ghost"
                    onClick={() => removeFlavor(f.id)}
                    aria-label="Remove flavor"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="btn-row" style={{ marginTop: 6 }}>
                <button className="btn btn-sm" onClick={() => addFlavor(product.id)}>
                  + Add flavor
                </button>
              </div>
            </div>
          );
        })}
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
