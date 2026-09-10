"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UnauthorizedError, load, save } from "@/lib/storage";
import { logout } from "@/lib/auth";
import { useIdleTimeout } from "@/lib/useIdleTimeout";
import { defaultState, makeId, normalizeState, roundMoney } from "@/lib/model";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  formatMonthYear,
  formatWeekRange,
  startOfMonth,
  startOfWeek,
  todayKey,
} from "@/lib/dates";
import DayTab from "@/components/DayTab";
import WeekTab from "@/components/WeekTab";
import MonthTab from "@/components/MonthTab";
import SetupTab from "@/components/SetupTab";
import LoginGate from "@/components/LoginGate";
import MyPayTab from "@/components/MyPayTab";

const IDLE_LIMIT_MS = 5 * 60 * 1000;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const ADMIN_TABS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "setup", label: "Setup" },
];

const STAFF_TABS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export default function Home() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [role, setRole] = useState("admin");
  const [signOutNotice, setSignOutNotice] = useState("");
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
      .then(({ state, role: nextRole }) => {
        const next = state ? normalizeState(state) : defaultState();
        lastPersisted.current = state ? next : null;
        setRole(nextRole || "admin");
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
    setSignOutNotice("");
    runLoad();
  }, [runLoad]);

  const endSession = useCallback(async (notice) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await logout();
    lastPersisted.current = null;
    setData(null);
    setSignOutNotice(notice);
    setStatus("locked");
  }, []);

  const handleSignOut = useCallback(() => endSession(""), [endSession]);
  const handleIdle = useCallback(
    () => endSession("Signed out after 5 minutes of inactivity."),
    [endSession]
  );

  useEffect(() => {
    runLoad();
  }, [runLoad]);

  useIdleTimeout({
    timeoutMs: IDLE_LIMIT_MS,
    enabled: status === "ready",
    onIdle: handleIdle,
  });

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
    return <LoginGate onSignedIn={reload} notice={signOutNotice} />;
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

  const isStaff = role === "staff";
  const tabs = isStaff ? STAFF_TABS : ADMIN_TABS;
  const staffName = data.settings.staff[0]?.name || "there";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <h1>{isStaff ? `${greeting()}, ${staffName}` : data.settings.shopName || "Macaron Tracker"}</h1>
          <span className="save-indicator">
            <span className={`save-dot${saveState === "saving" ? " saving" : ""}${saveState === "error" ? " failed" : ""}`} />
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm sign-out-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <main className="main">
        {tab === "day" && (
          <DayTab
            settings={data.settings}
            days={data.days}
            isStaff={isStaff}
            dateKey={dayDate}
            onDateChange={setDayDate}
            onUpdateDay={updateDay}
          />
        )}
        {tab === "week" && isStaff && (
          <>
            <div className="date-nav">
              <button className="icon-btn" onClick={() => setWeekAnchor(addDays(startOfWeek(weekAnchor), -7))} aria-label="Previous week">
                ‹
              </button>
              <span className="date-label">{formatWeekRange(weekAnchor)}</span>
              <button className="icon-btn" onClick={() => setWeekAnchor(addDays(startOfWeek(weekAnchor), 7))} aria-label="Next week">
                ›
              </button>
            </div>
            <MyPayTab
              settings={data.settings}
              days={data.days}
              payments={data.payments}
              startKey={startOfWeek(weekAnchor)}
              endKey={endOfWeek(weekAnchor)}
              periodLabel="This week"
            />
          </>
        )}
        {tab === "week" && !isStaff && (
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
        {tab === "month" && isStaff && (
          <>
            <div className="date-nav">
              <button className="icon-btn" onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))} aria-label="Previous month">
                ‹
              </button>
              <span className="date-label">{formatMonthYear(monthAnchor)}</span>
              <button className="icon-btn" onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))} aria-label="Next month">
                ›
              </button>
            </div>
            <MyPayTab
              settings={data.settings}
              days={data.days}
              payments={data.payments}
              startKey={startOfMonth(monthAnchor)}
              endKey={endOfMonth(monthAnchor)}
              periodLabel="This month"
            />
          </>
        )}
        {tab === "month" && !isStaff && (
          <MonthTab
            settings={data.settings}
            days={data.days}
            payments={data.payments}
            anchor={monthAnchor}
            onAnchorChange={setMonthAnchor}
            onJumpToDay={jumpToDay}
          />
        )}
        {tab === "setup" && !isStaff && (
          <SetupTab
            settings={data.settings}
            onUpdateSettings={updateSettings}
            onEraseAllData={eraseAllData}
          />
        )}
      </main>

      <nav className="tabbar">
        {tabs.map((t) => (
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
