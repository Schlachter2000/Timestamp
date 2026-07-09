// Abgeleitete Tageswerte: verbindet Store-Daten mit der Science-Schicht.

import type { AppState } from "./store";
import { diaryForDay, stepsForDay, workoutsForDay } from "./store";
import {
  adaptiveTdee,
  creditedActivityKcal,
  dailyTargets,
  qualityScore,
  stepsKcal,
  sumNutrients,
  trendWeights,
  type QualityScore,
  type Targets,
  type TdeeResult,
  type TrendPoint,
} from "./science";
import type { Nutrients } from "./types";
import { todayKey } from "./dates";

export interface DayStats {
  day: string;
  eaten: Nutrients;
  targets: Targets;
  /** Budget des Tages inkl. Aktivitäts-Gutschrift. */
  budgetKcal: number;
  remainingKcal: number;
  activityRawKcal: number;
  activityCreditKcal: number;
  tdee: TdeeResult;
  trend: TrendPoint[];
  weightKg: number;
  score: QualityScore;
}

export function computeDayStats(s: AppState, day: string): DayStats {
  const trend = trendWeights(s.weights);
  const weightKg = trend.length > 0 ? trend[trend.length - 1].trendKg : 75;
  const tdee = adaptiveTdee(s.profile, s.diary, trend, todayKey());
  const targets = dailyTargets(s.profile, weightKg, tdee.tdee);

  const workouts = workoutsForDay(s, day);
  const rawActivity =
    workouts.reduce((sum, w) => sum + w.kcal, 0) + stepsKcal(stepsForDay(s, day), weightKg);
  const credit = creditedActivityKcal(rawActivity, s.profile);

  const eaten = sumNutrients(diaryForDay(s, day));
  const budgetKcal = targets.kcal + credit;

  return {
    day,
    eaten,
    targets,
    budgetKcal,
    remainingKcal: Math.round(budgetKcal - eaten.kcal),
    activityRawKcal: Math.round(rawActivity),
    activityCreditKcal: credit,
    tdee,
    trend,
    weightKg,
    score: qualityScore(eaten, targets),
  };
}

/** Nährwerte eines Lebensmittels für eine Menge in g/ml. */
export function scaleNutrients(
  per100: Nutrients,
  qtyG: number
): Nutrients {
  const f = qtyG / 100;
  const r = (x: number) => Math.round(x * f * 10) / 10;
  return {
    kcal: Math.round(per100.kcal * f),
    proteinG: r(per100.proteinG),
    carbsG: r(per100.carbsG),
    fatG: r(per100.fatG),
    fiberG: r(per100.fiberG),
    sugarG: r(per100.sugarG),
    satfatG: r(per100.satfatG),
  };
}
