"use client";

// Training & Aktivität: Einheiten (MET-basiert) und Tagesschritte.
// Alles fließt als Aktivitäts-Gutschrift (mit Abschlag) ins Kalorienbudget.

import { useMemo, useState } from "react";
import { setSteps, stepsForDay, useStore, workoutsForDay } from "@/lib/store";
import { computeDayStats } from "@/lib/day";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { activityKind, stepsKcal } from "@/lib/science";
import type { Workout } from "@/lib/types";
import { WorkoutSheet } from "@/components/WorkoutSheet";

export default function TrainingPage() {
  const store = useStore();
  const [day, setDay] = useState(todayKey());
  const [sheet, setSheet] = useState<{ existing: Workout | null } | null>(null);
  const [stepsDraft, setStepsDraft] = useState<string | null>(null);

  const stats = useMemo(() => computeDayStats(store, day), [store, day]);
  const workouts = workoutsForDay(store, day);
  const steps = stepsForDay(store, day);
  const isToday = day === todayKey();

  const weekKcal = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(todayKey(), -i);
      sum += workoutsForDay(store, d).reduce((s, w) => s + w.kcal, 0);
      sum += stepsKcal(stepsForDay(store, d), stats.weightKg);
    }
    return Math.round(sum);
  }, [store, stats.weightKg]);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="title">{isToday ? "Training" : formatDay(day)}</h1>
          <p className="subtitle">Letzte 7 Tage: ~{weekKcal} kcal Aktivität</p>
        </div>
        <div className="nav-buttons">
          <button className="nav-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Vorheriger Tag">
            ‹
          </button>
          {!isToday && (
            <button className="nav-btn today-btn" onClick={() => setDay(todayKey())}>
              Heute
            </button>
          )}
          <button
            className="nav-btn"
            onClick={() => setDay(addDays(day, 1))}
            disabled={isToday}
            style={isToday ? { opacity: 0.35 } : undefined}
            aria-label="Nächster Tag"
          >
            ›
          </button>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>Einheiten</h2>
          <button className="action" onClick={() => setSheet({ existing: null })}>
            + Erfassen
          </button>
        </div>
        {workouts.length === 0 && <p className="hint">Keine Einheit an diesem Tag.</p>}
        {workouts.map((w) => (
          <button
            key={w.id}
            className="workout-row"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => setSheet({ existing: w })}
          >
            <div className="w-main">
              <div className="w-title">{w.title ?? activityKind(w.kind).label}</div>
              <div className="w-sub">
                {activityKind(w.kind).label} · {w.durationMin} min
                {w.rpe ? ` · RPE ${w.rpe}` : ""}
              </div>
            </div>
            <span className="w-kcal mono">{Math.round(w.kcal)} kcal</span>
          </button>
        ))}
      </section>

      <section className="card">
        <h2>Schritte</h2>
        <div className="field-grid">
          <label className="field">
            Schritte heute
            <input
              inputMode="numeric"
              value={stepsDraft ?? (steps > 0 ? String(steps) : "")}
              placeholder="z. B. 9500"
              onChange={(e) => setStepsDraft(e.target.value)}
              onBlur={() => {
                if (stepsDraft === null) return;
                const n = parseInt(stepsDraft, 10);
                if (Number.isInteger(n) && n >= 0) setSteps(day, n);
                setStepsDraft(null);
              }}
            />
          </label>
          <div className="stat-tile">
            <div className="stat-label">Netto-Verbrauch</div>
            <div className="stat-value mono">{stepsKcal(steps, stats.weightKg)} kcal</div>
            <div className="stat-sub">oberhalb 7.500 Schritten</div>
          </div>
        </div>
        <p className="hint">
          Alltagsgehen bis ~7.500 Schritte steckt schon im Grundbedarf – nur der Überschuss zählt,
          und davon werden {store.profile.activityCreditPct} % gutgeschrieben (Einstellungen).
        </p>
      </section>

      <section className="card">
        <h2>Heutige Gutschrift</h2>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-label">Aktivität gesamt</div>
            <div className="stat-value mono">{stats.activityRawKcal} kcal</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Aufs Budget</div>
            <div className="stat-value mono">+{stats.activityCreditKcal} kcal</div>
            <div className="stat-sub">{store.profile.activityCreditPct} % Gutschrift</div>
          </div>
        </div>
      </section>

      {sheet && <WorkoutSheet day={day} existing={sheet.existing} onClose={() => setSheet(null)} />}
    </div>
  );
}
