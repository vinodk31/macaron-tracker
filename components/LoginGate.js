"use client";

import { useState } from "react";
import { login } from "@/lib/auth";
import RegisterForm from "./RegisterForm";

export default function LoginGate({ onSignedIn, notice }) {
  const [mode, setMode] = useState("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPinMode = mode === "pin";

  function switchTo(nextMode) {
    setMode(nextMode);
    setError("");
    setEmail("");
    setPassword("");
    setPin("");
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login(isPinMode ? { pin } : { email, password });
      if (result.ok) {
        onSignedIn();
        return;
      }
      if (result.status === 429) {
        const minutes = Math.ceil((result.retryInSeconds || 60) / 60);
        setError(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      } else {
        setError(result.error || `Sign-in failed (${result.status})`);
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "register") {
    return <RegisterForm onRegistered={onSignedIn} onCancel={() => switchTo("owner")} />;
  }

  return (
    <div className="login-screen">
      <h1 className="login-title">Macaron Tracker</h1>
      {notice && <p className="login-notice">{notice}</p>}
      <form className="card login-card" onSubmit={submit}>
        {isPinMode ? (
          <div className="field">
            <label htmlFor="pin">Staff PIN</label>
            <input
              id="pin"
              className="text-input pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={5}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              autoFocus
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="text-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="text-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="login-error">{error}</p>}

        <button
          className="btn btn-primary login-submit"
          type="submit"
          disabled={busy || (isPinMode && pin.length !== 5)}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          className="btn btn-ghost login-switch"
          type="button"
          onClick={() => switchTo(isPinMode ? "owner" : "pin")}
        >
          {isPinMode ? "Owner sign-in" : "Staff PIN"}
        </button>
        {!isPinMode && (
          <button
            className="btn btn-ghost login-switch"
            type="button"
            onClick={() => switchTo("register")}
          >
            Register a new location
          </button>
        )}
      </form>
    </div>
  );
}
