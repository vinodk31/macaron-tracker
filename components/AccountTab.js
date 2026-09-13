"use client";

import { useState } from "react";
import { setPin } from "@/lib/pins";

// Where an employee changes their own sign-in PIN. The current one is asked
// for because a kiosk tablet is shared: a session left open shouldn't let the
// next person lock its owner out.
export default function AccountTab({ name }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = current.length === 5 && next.length === 5 && confirm.length === 5;

  // Retyping means they are starting again, so the last result stops applying.
  function edit(setter) {
    return (value) => {
      setter(value);
      setError("");
      setDone(false);
    };
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (next !== confirm) {
      setError("The two new PINs don't match.");
      return;
    }

    setBusy(true);
    const result = await setPin({ pin: next, currentPin: current });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Your PIN</h2>
      </div>
      <p className="card-subtitle">
        Signed in as {name}. Pick any five digits you&apos;ll remember — you&apos;ll use it the next
        time you sign in. Your manager can still see it in Setup, so ask them if you ever forget it.
      </p>

      <form className="pin-form" onSubmit={submit}>
        <PinField id="current-pin" label="Current PIN" value={current} onChange={edit(setCurrent)} autoFocus />
        <PinField id="new-pin" label="New PIN" value={next} onChange={edit(setNext)} />
        <PinField id="confirm-pin" label="Repeat new PIN" value={confirm} onChange={edit(setConfirm)} />

        {error && <p className="login-error">{error}</p>}
        {done && <p className="pin-saved">Saved. Use your new PIN next time you sign in.</p>}

        <button className="btn btn-primary login-submit" type="submit" disabled={busy || !ready}>
          {busy ? "Saving…" : "Change PIN"}
        </button>
      </form>
    </section>
  );
}

function PinField({ id, label, value, onChange, autoFocus = false }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="text-input pin-input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={5}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        autoFocus={autoFocus}
      />
    </div>
  );
}
