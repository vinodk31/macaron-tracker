"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMonthYear } from "@/lib/dates";
import { isSettled } from "@/lib/model";

export default function LocationsScreen({ onOpenLocation, onSignOut }) {
  const [locations, setLocations] = useState(null);
  const [month, setMonth] = useState("");
  const [error, setError] = useState("");

  const fetchLocations = useCallback(() => {
    fetch("/api/locations", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load locations (${res.status})`);
        return res.json();
      })
      .then(({ locations: rows, month: monthKey }) => {
        setLocations(rows);
        setMonth(monthKey);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const totals = (locations || []).reduce(
    (acc, l) => ({
      unitsSold: acc.unitsSold + l.unitsSold,
      cogs: acc.cogs + l.cogs,
      outstanding: acc.outstanding + l.outstanding,
    }),
    { unitsSold: 0, cogs: 0, outstanding: 0 }
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">
          <h1>All locations</h1>
          {month && <span className="save-indicator">{formatMonthYear(month)}</span>}
        </div>
        <button className="btn btn-ghost btn-sm sign-out-btn" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <main className="main">
        {error && <p className="empty-state">{error}</p>}
        {!locations && !error && <p className="empty-state">Loading…</p>}

        {locations && locations.length === 0 && (
          <p className="empty-state">No locations registered yet.</p>
        )}

        {locations && locations.length > 0 && (
          <>
            <div className="stat-grid">
              <div className="stat-tile accent-raspberry">
                <div className="stat-label">Units sold</div>
                <div className="stat-value">{totals.unitsSold}</div>
                <div className="stat-sub">across {locations.length} locations</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Total COGS</div>
                <div className="stat-value">${totals.cogs.toFixed(0)}</div>
                <div className="stat-sub">this month</div>
              </div>
            </div>

            <section className="card">
              <div className="card-header">
                <h2>Locations</h2>
              </div>
              {locations.map((l) => (
                <button className="location-row" key={l.id} onClick={() => onOpenLocation(l.id)}>
                  <span className="location-main">
                    <span className="location-name">{l.name}</span>
                    <span className="location-meta">
                      {l.unitsSold} sold · {l.staffCount} staff
                      {!isSettled(l.outstanding) && (
                        <span className="location-owing"> · ${l.outstanding.toFixed(2)} owed</span>
                      )}
                    </span>
                  </span>
                  <span className="location-cogs">${l.cogs.toFixed(0)}</span>
                  <span className="location-chevron">›</span>
                </button>
              ))}
              <p className="card-subtitle">
                Figures are for {month ? formatMonthYear(month) : "this month"}. Open a location to
                work in it.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
