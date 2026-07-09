// =============================================================================
// Sportwissenschaftlicher Kern
//
// 1. Startwert-TDEE über Mifflin-St Jeor × Aktivitätsfaktor (PAL).
// 2. Trendgewicht: exponentiell gewichteter Durchschnitt (EWMA) filtert
//    Wasser-/Glykogenschwankungen aus der Waage.
// 3. Adaptiver TDEE: sobald genug Verlaufsdaten existieren, wird der wahre
//    Verbrauch aus Energiezufuhr + Trendgewichtsänderung zurückgerechnet
//    (Energiebilanzmethode, ~7700 kcal je kg Gewichtsänderung). Das ist
//    robuster als jede Formel, weil es individuelle NEAT-/Stoffwechsel-
//    unterschiede und adaptive Thermogenese automatisch einfängt.
// 4. Aktivitäts-Gutschrift: Trainingsverbrauch wird standardmäßig nur zu 50 %
//    dem Tagesbudget gutgeschrieben – Wearables und MET-Formeln überschätzen
//    systematisch, und ein Teil der Alltagsaktivität steckt bereits im PAL.
//    Schritte zählen erst oberhalb einer Basislinie (7.500), damit normales
//    Alltagsgehen nicht doppelt verbucht wird.
// 5. Qualitäts-Score: Protein, Ballaststoffe, Zucker- und Sättigungsfett-
//    Grenzen (WHO/DGE-Richtwerte) als 0–100-Index pro Tag.
// =============================================================================

import type { DiaryEntry, Nutrients, Profile, WeightEntry } from "./types";
import { diffDays } from "./dates";

export const KCAL_PER_KG = 7700;

// ---------------------------------------------------------------------------
// Formel-TDEE (Startwert)
// ---------------------------------------------------------------------------

export function bmrMifflin(profile: Profile, weightKg: number): number {
  const age = new Date().getFullYear() - profile.birthYear;
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * age;
  return Math.round(base + (profile.sex === "m" ? 5 : -161));
}

export function formulaTdee(profile: Profile, weightKg: number): number {
  return Math.round(bmrMifflin(profile, weightKg) * profile.activityLevel);
}

// ---------------------------------------------------------------------------
// Trendgewicht (EWMA, α = 0,2 – reagiert in ~1 Woche auf echte Änderungen)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  day: string;
  weightKg: number;
  trendKg: number;
}

export function trendWeights(weights: WeightEntry[]): TrendPoint[] {
  const sorted = [...weights].sort((a, b) => (a.day < b.day ? -1 : 1));
  const points: TrendPoint[] = [];
  let trend: number | null = null;
  let prevDay: string | null = null;
  for (const w of sorted) {
    if (trend === null || prevDay === null) {
      trend = w.weightKg;
    } else {
      // Bei Messlücken die Glättung pro übersprungenem Tag fortschreiben,
      // damit seltene Wiegetage den Trend nicht überproportional ziehen.
      const gap = Math.max(1, diffDays(prevDay, w.day));
      const alpha = 1 - Math.pow(1 - 0.2, gap);
      trend = trend + alpha * (w.weightKg - trend);
    }
    prevDay = w.day;
    points.push({ day: w.day, weightKg: w.weightKg, trendKg: round1(trend) });
  }
  return points;
}

/** Gewichtsänderung in kg/Woche aus dem Trend der letzten `windowDays` Tage. */
export function weeklyTrendRate(trend: TrendPoint[], windowDays = 14): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1];
  let first = trend[0];
  for (const p of trend) {
    if (diffDays(p.day, last.day) <= windowDays) {
      first = p;
      break;
    }
  }
  const days = diffDays(first.day, last.day);
  if (days < 5) return null;
  return round2(((last.trendKg - first.trendKg) / days) * 7);
}

// ---------------------------------------------------------------------------
// Adaptiver TDEE
// ---------------------------------------------------------------------------

export interface TdeeResult {
  tdee: number;
  /** true, sobald der Wert aus deinen Daten statt aus der Formel kommt. */
  adaptive: boolean;
  /** Anzahl ausgewerteter Protokolltage. */
  daysUsed: number;
}

/**
 * TDEE aus Energiebilanz: mittlere Zufuhr − (Δ Trendgewicht × 7700) / Tage.
 * Vorbedingungen: mindestens 10 vollständig protokollierte Tage (≥ 800 kcal,
 * darunter gilt der Tag als Lücke) und Trenddaten über ≥ 10 Tage im Fenster
 * der letzten 28 Tage. Sonst Rückfall auf die Formel.
 */
export function adaptiveTdee(
  profile: Profile,
  entries: DiaryEntry[],
  trend: TrendPoint[],
  today: string
): TdeeResult {
  const latestWeight = trend.length > 0 ? trend[trend.length - 1].trendKg : 75;
  const fallback: TdeeResult = {
    tdee: formulaTdee(profile, latestWeight),
    adaptive: false,
    daysUsed: 0,
  };
  if (trend.length < 2) return fallback;

  const windowStart = -28;
  const kcalByDay = new Map<string, number>();
  for (const e of entries) {
    const offset = diffDays(today, e.day);
    if (offset > 0 || offset < windowStart || e.day === today) continue; // heute ist unvollständig
    kcalByDay.set(e.day, (kcalByDay.get(e.day) ?? 0) + e.kcal);
  }
  const loggedDays = [...kcalByDay.entries()].filter(([, kcal]) => kcal >= 800);
  if (loggedDays.length < 10) return fallback;

  const inWindow = trend.filter((p) => {
    const offset = diffDays(today, p.day);
    return offset <= 0 && offset >= windowStart;
  });
  if (inWindow.length < 2) return fallback;
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const span = diffDays(first.day, last.day);
  if (span < 10) return fallback;

  const meanIntake = loggedDays.reduce((sum, [, kcal]) => sum + kcal, 0) / loggedDays.length;
  const dailyDelta = ((last.trendKg - first.trendKg) * KCAL_PER_KG) / span;
  const tdee = Math.round(meanIntake - dailyDelta);

  // Plausibilitätsband: außerhalb 0,6–1,8 × Formelwert deutet auf Protokoll-
  // lücken hin – dann lieber die Formel als ein absurder Wert.
  const formula = formulaTdee(profile, latestWeight);
  if (tdee < formula * 0.6 || tdee > formula * 1.8) return fallback;

  return { tdee, adaptive: true, daysUsed: loggedDays.length };
}

// ---------------------------------------------------------------------------
// Tagesziele
// ---------------------------------------------------------------------------

export interface Targets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  /** Zucker-Obergrenze (10 % der Energie, WHO). */
  sugarMaxG: number;
  /** Gesättigte Fette, Obergrenze (10 % der Energie, DGE). */
  satfatMaxG: number;
}

export function dailyTargets(profile: Profile, weightKg: number, tdee: number): Targets {
  const rateKcalPerDay = (profile.weeklyRatePct / 100) * weightKg * (KCAL_PER_KG / 7);
  let kcal = profile.kcalOverride ?? Math.round(tdee + rateKcalPerDay);
  // Untergrenze: nie unter geschätzten Grundumsatz + 5 % – aggressivere
  // Defizite kosten überproportional Muskelmasse.
  kcal = Math.max(kcal, Math.round(bmrMifflin(profile, weightKg) * 1.05));

  const proteinG = Math.round(profile.proteinGPerKg * weightKg);
  const fatG = Math.round(profile.fatGPerKg * weightKg);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return {
    kcal,
    proteinG,
    fatG,
    carbsG,
    fiberG: Math.round((kcal / 1000) * 14),
    sugarMaxG: Math.round((kcal * 0.1) / 4),
    satfatMaxG: Math.round((kcal * 0.1) / 9),
  };
}

// ---------------------------------------------------------------------------
// Aktivität (MET-Kompendium, Auswahl) und Gutschrift
// ---------------------------------------------------------------------------

export interface ActivityKind {
  id: string;
  label: string;
  met: number;
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  { id: "kraft", label: "Krafttraining", met: 5.0 },
  { id: "laufen", label: "Laufen", met: 9.8 },
  { id: "radfahren", label: "Radfahren", met: 7.5 },
  { id: "schwimmen", label: "Schwimmen", met: 7.0 },
  { id: "hiit", label: "HIIT / Zirkel", met: 8.0 },
  { id: "gehen", label: "Spazieren / Wandern", met: 3.8 },
  { id: "fussball", label: "Fußball", met: 7.0 },
  { id: "tennis", label: "Tennis / Squash", met: 7.3 },
  { id: "klettern", label: "Klettern / Bouldern", met: 6.5 },
  { id: "yoga", label: "Yoga / Mobility", met: 2.8 },
  { id: "sonstiges", label: "Sonstiges", met: 5.0 },
];

export function activityKind(id: string): ActivityKind {
  return ACTIVITY_KINDS.find((k) => k.id === id) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];
}

/**
 * Netto-Verbrauch einer Aktivität: (MET − 1) zieht den Ruheumsatz ab, der
 * ohnehin im TDEE steckt. kcal = (MET − 1) × 3,5 × kg / 200 × Minuten.
 */
export function workoutKcal(met: number, weightKg: number, minutes: number): number {
  return Math.round(((met - 1) * 3.5 * weightKg * minutes) / 200);
}

const STEP_BASELINE = 7500;

/** Netto-kcal aus Schritten oberhalb der Alltagsbasislinie (~0,00035 kcal/kg je Schritt). */
export function stepsKcal(steps: number, weightKg: number): number {
  return Math.round(Math.max(0, steps - STEP_BASELINE) * weightKg * 0.00035);
}

/** Gutschrift aufs Tagesbudget nach Vertrauensabschlag. */
export function creditedActivityKcal(rawKcal: number, profile: Profile): number {
  return Math.round((rawKcal * profile.activityCreditPct) / 100);
}

// ---------------------------------------------------------------------------
// Tagesbilanz & Qualitäts-Score
// ---------------------------------------------------------------------------

export function sumNutrients(entries: DiaryEntry[]): Nutrients {
  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, satfatG: 0 };
  for (const e of entries) {
    total.kcal += e.kcal;
    total.proteinG += e.proteinG;
    total.carbsG += e.carbsG;
    total.fatG += e.fatG;
    total.fiberG += e.fiberG;
    total.sugarG += e.sugarG;
    total.satfatG += e.satfatG;
  }
  return total;
}

export interface QualityScore {
  total: number; // 0–100
  protein: number; // 0–35
  fiber: number; // 0–25
  sugar: number; // 0–20
  satfat: number; // 0–20
}

export function qualityScore(day: Nutrients, targets: Targets): QualityScore {
  const protein = 35 * clamp01(day.proteinG / targets.proteinG);
  const fiber = 25 * clamp01(day.fiberG / targets.fiberG);
  // Volle Punkte bis zur Grenze, danach linear auf 0 bei der doppelten Menge.
  const sugar = 20 * clamp01(2 - day.sugarG / Math.max(1, targets.sugarMaxG));
  const satfat = 20 * clamp01(2 - day.satfatG / Math.max(1, targets.satfatMaxG));
  return {
    total: Math.round(protein + fiber + sugar + satfat),
    protein: Math.round(protein),
    fiber: Math.round(fiber),
    sugar: Math.round(sugar),
    satfat: Math.round(satfat),
  };
}

/** Protein-Verteilungshinweis: ≥ 0,4 g/kg in einer Mahlzeit gilt als anaboler Reiz. */
export function mealProteinThreshold(weightKg: number): number {
  return Math.round(0.4 * weightKg);
}

// ---------------------------------------------------------------------------

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
