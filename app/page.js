"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { load, save } from "@/lib/storage";
import { defaultState } from "@/lib/model";
import { todayKey } from "@/lib/dates";
import DayTab from "@/components/DayTab";
import WeekTab from "@/components/WeekTab";
import MonthTab from "@/components/MonthTab";
import SetupTab from "@/components/SetupTab";

const TABS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "setup", label: "Setup" },
];

export default function Home() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("day");
  const [dayDate, setDayDate] = useState(todayKey());
  const [weekAnchor, setWeekAnchor] = useState(todayKey());
  const [monthAnchor, setMonthAnchor] = useState(todayKey());

  const saveTimer = useRef(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    load().then((stored) => {
      if (cancelled) return;
      setData(stored || defaultState());
      hasLoaded.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded.current || !data) return;
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(data).then(() => setSaving(false));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data]);

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

  const eraseAllData = useCallback(() => {
    setData((prev) => ({ ...prev, days: {} }));
  }, []);

  if (!data) {
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
          <span className={`save-dot${saving ? " saving" : ""}`} />
          {saving ? "Saving…" : "Saved"}
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
            anchor={weekAnchor}
            onAnchorChange={setWeekAnchor}
            onJumpToDay={jumpToDay}
          />
        )}
        {tab === "month" && (
          <MonthTab
            settings={data.settings}
            days={data.days}
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
