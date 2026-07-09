"use client";

// Fortschritt: Gewicht loggen, Trend + Verlauf, adaptiver TDEE,
// Wochenmittel und Qualitäts-Score.

import { useMemo, useState } from "react";
import { deleteWeight, setWeight, useStore, weightForDay, diaryForDay } from "@/lib/store";
import { computeDayStats } from "@/lib/day";
import { addDays, todayKey } from "@/lib/dates";
import { sumNutrients, weeklyTrendRate } from "@/lib/science";
import { GOAL_LABELS } from "@/lib/types";
import { WeightChart } from "@/components/WeightChart";

export default function ProgressPage() {
  const store = useStore();
  const today = todayKey();
  const stats = useMemo(() => computeDayStats(store, today), [store, today]);
  const todaysWeight = weightForDay(store, today);
  const [draft, setDraft] = useState<string | null>(null);

  const rate = useMemo(() => weeklyTrendRate(stats.trend), [stats.trend]);
  const targetRate = (store.profile.weeklyRatePct / 100) * stats.weightKg;

  const week = useMemo(() => {
    let days = 0;
    let kcal = 0;
    let protein = 0;
    for (let i = 1; i <= 7; i++) {
      const entries = diaryForDay(store, addDays(today, -i));
      if (entries.length === 0) continue;
      const sum = sumNutrients(entries);
      if (sum.kcal < 800) continue; // unvollständige Tage nicht werten
      days++;
      kcal += sum.kcal;
      protein += sum.proteinG;
    }
    return days > 0 ? { days, kcal: Math.round(kcal / days), protein: Math.round(protein / days) } : null;
  }, [store, today]);

  function commitWeight() {
    if (draft === null) return;
    const v = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(v) && v >= 30 && v <= 300) setWeight(today, Math.round(v * 10) / 10);
    else if (draft.trim() === "" && todaysWeight) deleteWeight(today);
    setDraft(null);
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="title">Fortschritt</h1>
          <p className="subtitle">
            Ziel: {GOAL_LABELS[store.profile.goal]} ({store.profile.weeklyRatePct > 0 ? "+" : ""}
            {store.profile.weeklyRatePct} %/Woche)
          </p>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>Gewicht heute</h2>
          {stats.tdee.adaptive && <span className="badge">TDEE adaptiv</span>}
        </div>
        <div className="field-grid">
          <label className="field">
            kg
            <input
              inputMode="decimal"
              placeholder="z. B. 82,4"
              value={draft ?? (todaysWeight ? String(todaysWeight.weightKg) : "")}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
          <div className="stat-tile">
            <div className="stat-label">Trendgewicht</div>
            <div className="stat-value mono">
              {stats.trend.length > 0 ? `${stats.trend[stats.trend.length - 1].trendKg} kg` : "–"}
            </div>
            <div className="stat-sub">geglättet, ohne Wasserrauschen</div>
          </div>
        </div>
        <WeightChart trend={stats.trend} />
      </section>

      <section className="card">
        <h2>Bilanz</h2>
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-label">Trend / Woche</div>
            <div className="stat-value mono">{rate !== null ? `${rate > 0 ? "+" : ""}${rate} kg` : "–"}</div>
            <div className="stat-sub">
              Ziel {targetRate > 0 ? "+" : ""}
              {Math.round(targetRate * 100) / 100} kg
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">TDEE</div>
            <div className="stat-value mono">{stats.tdee.tdee} kcal</div>
            <div className="stat-sub">
              {stats.tdee.adaptive ? `aus ${stats.tdee.daysUsed} Protokolltagen` : "Formel – tracke ~2 Wochen"}
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Ø Zufuhr (7 Tage)</div>
            <div className="stat-value mono">{week ? `${week.kcal} kcal` : "–"}</div>
            <div className="stat-sub">{week ? `${week.days} gewertete Tage` : "zu wenig Protokoll"}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Ø Protein (7 Tage)</div>
            <div className="stat-value mono">{week ? `${week.protein} g` : "–"}</div>
            <div className="stat-sub">Ziel {stats.targets.proteinG} g</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Qualitäts-Score heute · {stats.score.total}/100</h2>
        <div className="score-row">
          {(
            [
              ["Protein", stats.score.protein, 35],
              ["Ballaststoffe", stats.score.fiber, 25],
              ["Zucker im Rahmen", stats.score.sugar, 20],
              ["Ges. Fette im Rahmen", stats.score.satfat, 20],
            ] as [string, number, number][]
          ).map(([label, value, max]) => (
            <div className="score-part" key={label}>
              <span className="score-name">{label}</span>
              <div className="macro-track">
                <div
                  className="macro-bar"
                  style={{ width: `${(value / max) * 100}%`, background: "var(--accent)" }}
                />
              </div>
              <span className="score-num mono">
                {value}/{max}
              </span>
            </div>
          ))}
        </div>
        <p className="hint">
          Bewertet Proteinziel, Ballaststoffe (14 g je 1000 kcal) sowie WHO-Grenzen für Zucker und
          gesättigte Fette (je 10 % der Energie).
        </p>
      </section>
    </div>
  );
}
