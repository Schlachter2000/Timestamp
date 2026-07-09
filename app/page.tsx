"use client";

// Heute: Tagesbilanz (Ring + Makros), Mahlzeiten, Schnellerfassung per
// Scan/Suche. Datumsnavigation erlaubt Nachtragen vergangener Tage.

import { useMemo, useState } from "react";
import { diaryForMeal, useStore } from "@/lib/store";
import { computeDayStats } from "@/lib/day";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { MEALS, MEAL_LABELS, type DiaryEntry, type Meal } from "@/lib/types";
import { KcalRing } from "@/components/KcalRing";
import { MacroBars } from "@/components/MacroBars";
import { AddFoodSheet } from "@/components/AddFoodSheet";
import { EditEntrySheet } from "@/components/EditEntrySheet";

export default function TodayPage() {
  const store = useStore();
  const [day, setDay] = useState(todayKey());
  const [addSheet, setAddSheet] = useState<{ meal: Meal; tab?: "scan" | "zuletzt" } | null>(null);
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null);

  const stats = useMemo(() => computeDayStats(store, day), [store, day]);
  const isToday = day === todayKey();

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="title">{isToday ? "Heute" : formatDay(day)}</h1>
          <p className="subtitle">
            {stats.tdee.adaptive
              ? `TDEE ${stats.tdee.tdee} kcal · adaptiv aus ${stats.tdee.daysUsed} Tagen`
              : `TDEE ${stats.tdee.tdee} kcal · Formel-Startwert`}
            {store.pending > 0 ? ` · ${store.pending} ausstehend` : ""}
          </p>
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
        <div className="day-summary">
          <KcalRing eaten={stats.eaten.kcal} budget={stats.budgetKcal} />
          <MacroBars eaten={stats.eaten} targets={stats.targets} />
        </div>
        <div className="day-meta">
          <span>
            Budget <strong className="mono">{stats.budgetKcal}</strong> kcal
          </span>
          <span>
            Gegessen <strong className="mono">{Math.round(stats.eaten.kcal)}</strong> kcal
          </span>
          <span>
            Aktivität <strong className="mono">+{stats.activityCreditKcal}</strong> kcal
            {stats.activityRawKcal > stats.activityCreditKcal ? ` (von ${stats.activityRawKcal})` : ""}
          </span>
          <span>
            Qualität <strong className="mono">{stats.score.total}</strong>/100
          </span>
        </div>
      </section>

      {MEALS.map((meal) => {
        const entries = diaryForMeal(store, day, meal);
        const kcal = Math.round(entries.reduce((s, e) => s + e.kcal, 0));
        const protein = Math.round(entries.reduce((s, e) => s + e.proteinG, 0));
        return (
          <section className="meal-section" key={meal}>
            <div className="meal-head">
              <span className="meal-name">{MEAL_LABELS[meal]}</span>
              {entries.length > 0 && (
                <span className="meal-kcal mono">
                  {kcal} kcal · {protein} g P
                </span>
              )}
            </div>
            <div className="meal-list">
              {entries.map((e) => (
                <button className="food-row" key={e.id} onClick={() => setEditEntry(e)}>
                  <div className="food-main">
                    <div className="food-name">{e.name}</div>
                    <div className="food-sub">
                      {Math.round(e.qtyG)} g · {Math.round(e.proteinG)} g Protein
                    </div>
                  </div>
                  <span className="food-kcal mono">{Math.round(e.kcal)}</span>
                </button>
              ))}
              <button className="meal-add" onClick={() => setAddSheet({ meal })}>
                + Hinzufügen
              </button>
            </div>
          </section>
        );
      })}

      <div style={{ height: 70 }} />

      <div className="fab-row">
        <button className="secondary" onClick={() => setAddSheet({ meal: guessMeal(), tab: "zuletzt" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Essen
        </button>
        <button onClick={() => setAddSheet({ meal: guessMeal(), tab: "scan" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
          </svg>
          Scannen
        </button>
      </div>

      {addSheet && (
        <AddFoodSheet
          day={day}
          initialMeal={addSheet.meal}
          initialTab={addSheet.tab}
          onClose={() => setAddSheet(null)}
        />
      )}
      {editEntry && <EditEntrySheet entry={editEntry} onClose={() => setEditEntry(null)} />}
    </div>
  );
}

/** Mahlzeit anhand der Uhrzeit vorschlagen. */
function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return "fruehstueck";
  if (h < 15) return "mittag";
  if (h < 21) return "abend";
  return "snack";
}
