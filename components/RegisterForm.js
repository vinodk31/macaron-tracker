"use client";

import { useState } from "react";

export default function RegisterForm({ onRegistered, onCancel }) {
  const [fields, setFields] = useState({ name: "", email: "", password: "", inviteCode: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        onRegistered();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const minutes = Math.ceil((body.retryInSeconds || 60) / 60);
        setError(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      } else {
        setError(body.error || `Could not register (${res.status})`);
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <h1 className="login-title">New location</h1>
      <form className="card login-card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="loc-name">Location name</label>
          <input
            id="loc-name"
            className="text-input"
            type="text"
            placeholder="The Mall, Columbia MD"
            value={fields.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="loc-email">Your email</label>
          <input
            id="loc-email"
            className="text-input"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="loc-password">Password</label>
          <input
            id="loc-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            value={fields.password}
            onChange={(e) => set("password", e.target.value)}
          />
          <p className="card-subtitle">At least 8 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="loc-invite">Invite code</label>
          <input
            id="loc-invite"
            className="text-input"
            type="text"
            value={fields.inviteCode}
            onChange={(e) => set("inviteCode", e.target.value)}
          />
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create location"}
        </button>
        <button className="btn btn-ghost login-switch" type="button" onClick={onCancel}>
          Back to sign in
        </button>
      </form>
    </div>
  );
}
