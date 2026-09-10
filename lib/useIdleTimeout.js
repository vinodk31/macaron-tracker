"use client";

import { useEffect, useRef } from "react";

// Deliberately excludes focus/visibility: coming back to the tab after ten
// minutes away should log you out, not count as activity.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"];

export function useIdleTimeout({ timeoutMs, enabled, onIdle }) {
  // Seeded in the effect below rather than here: reading the clock during
  // render is impure.
  const lastActivity = useRef(0);
  const handler = useRef(onIdle);

  useEffect(() => {
    handler.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return undefined;
    lastActivity.current = Date.now();

    const bump = () => {
      lastActivity.current = Date.now();
    };
    // Comparing timestamps on a short interval rather than running one long
    // timer: background tabs get their timers throttled, so a plain setTimeout
    // could fire minutes late (or not until the tab is reopened).
    const check = () => {
      if (Date.now() - lastActivity.current >= timeoutMs) handler.current();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, bump, { passive: true });
    }
    document.addEventListener("visibilitychange", check);
    const intervalId = setInterval(check, 10000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, bump);
      }
      document.removeEventListener("visibilitychange", check);
      clearInterval(intervalId);
    };
  }, [enabled, timeoutMs]);
}
