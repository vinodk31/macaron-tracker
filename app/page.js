"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UnauthorizedError, load, save } from "@/lib/storage";
import { defaultState, makeId, normalizeState, roundMoney } from "@/lib/model";
import { todayKey } from "@/lib/dates";
import DayTab from "@/components/DayTab";
import WeekTab from "@/components/WeekTab";
import MonthTab from "@/components/MonthTab";
import SetupTab from "@/components/SetupTab";
import LoginGate from "@/components/LoginGate";

const TABS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "setup", label: "Setup" },
];

export default function Home() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [tab, setTab] = useState("day");
  const [dayDate, setDayDate] = useState(todayKey());
  const [weekAnchor, setWeekAnchor] = useState(todayKey());
  const [monthAnchor, setMonthAnchor] = useState(todayKey());

  const saveTimer = useRef(null);
  // What the server already has, so a freshly loaded state isn't written
  // straight back.
  const lastPersisted = useRef(null);

  const runLoad = useCallback(() => {
    load()
      .then((stored) => {
        const next = stored ? normalizeState(stored) : defaultState();
        lastPersisted.current = stored ? next : null;
        setData(next);
        setStatus("ready");
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          setStatus("locked");
          return;
        }
        setLoadError(err.message);
        setStatus("error");
      });
  }, []);

  // Retrying from the error screen or after signing in, where resetting the
  // status back to "loading" is an event, not an effect.
  const reload = useCallback(() => {
    setStatus("loading");
    setLoadError("");
    runLoad();
  }, [runLoad]);

  useEffect(() => {
    runLoad();
  }, [runLoad]);

  useEffect(() => {
    if (status !== "ready" || !data || data === lastPersisted.current) return;

    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(data)
        .then(() => {
          lastPersisted.current = data;
          setSaveState("idle");
        })
        .catch((err) => {
          if (err instanceof UnauthorizedError) {
            setStatus("locked");
            return;
          }
          setSaveState("error");
        });
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, status]);

  const updateSettings = useCallback((updater) => {
    setData((prev) => ({
      ...prev,
      settings: typeof updater === "function" ? updater(prev.settings) : updater,
    }));
  }, []);

  const updateDay = useCallback((dateKey, updater) => {
    setData((prev) => {
      const prevDay = prev.days[dateKey] || {};
      const nextDay = typeof updater === "function" ? updater(prevDay) : updater;
      return { ...prev, days: { ...prev.days, [dateKey]: nextDay } };
    });
  }, []);

  const jumpToDay = useCallback((dateKey) => {
    setDayDate(dateKey);
    setTab("day");
  }, []);

  const recordPayment = useCallback((staffId, weekStart, amount) => {
    setData((prev) => ({
      ...prev,
      payments: [
        ...prev.payments.filter((p) => !(p.staffId === staffId && p.weekStart === weekStart)),
        {
          id: makeId("payment"),
          staffId,
          weekStart,
          amount: roundMoney(amount),
          paidOn: todayKey(),
        },
      ],
    }));
  }, []);

  const removePayment = useCallback((paymentId) => {
    setData((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== paymentId),
    }));
  }, []);

  const eraseAllData = useCallback(() => {
    setData((prev) => ({ ...prev, days: {}, payments: [] }));
  }, []);

  if (status === "locked") {
    return <LoginGate onSignedIn={reload} />;
  }

  if (status === "error") {
    return (
      <div className="app">
        <div className="main">
          <p className="empty-state">{loadError}</p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn" onClick={reload}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "loading" || !data) {
    return (
      <div className="app">
        <div className="main">
          <p className="empty-state">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{data.settings.shopName || "Macaron Tracker"}</h1>
        <span className="save-indicator">
          <span className={`save-dot${saveState === "saving" ? " saving" : ""}${saveState === "error" ? " failed" : ""}`} />
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
        </span>
      </header>

      <main className="main">
        {tab === "day" && (
          <DayTab
            settings={data.settings}
            days={data.days}
            dateKey={dayDate}
            onDateChange={setDayDate}
            onUpdateDay={updateDay}
          />
        )}
        {tab === "week" && (
          <WeekTab
            settings={data.settings}
            days={data.days}
            payments={data.payments}
            onRecordPayment={recordPayment}
            onRemovePayment={removePayment}
            anchor={weekAnchor}
            onAnchorChange={setWeekAnchor}
            onJumpToDay={jumpToDay}
          />
        )}
        {tab === "month" && (
          <MonthTab
            settings={data.settings}
            days={data.days}
            payments={data.payments}
            anchor={monthAnchor}
            onAnchorChange={setMonthAnchor}
            onJumpToDay={jumpToDay}
          />
        )}
        {tab === "setup" && (
          <SetupTab
            settings={data.settings}
            onUpdateSettings={updateSettings}
            onEraseAllData={eraseAllData}
          />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-dot" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
