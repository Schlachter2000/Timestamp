// Gemeinsame Typen für Client und Server.
// Nährwerte je 100 g/ml; Mengen in Gramm; Energie in kcal.

export type Sex = "m" | "w";
export type Goal = "cut" | "recomp" | "gain" | "maintain";
export type Meal = "fruehstueck" | "mittag" | "abend" | "snack";
export type FoodSource = "off" | "manual";

export const MEALS: Meal[] = ["fruehstueck", "mittag", "abend", "snack"];

export const MEAL_LABELS: Record<Meal, string> = {
  fruehstueck: "Frühstück",
  mittag: "Mittag",
  abend: "Abend",
  snack: "Snacks",
};

export const GOAL_LABELS: Record<Goal, string> = {
  cut: "Fettabbau",
  recomp: "Rekomposition",
  gain: "Muskelaufbau",
  maintain: "Erhalt",
};

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  /** Aktivitätsfaktor (PAL) als Startwert, bis der adaptive TDEE greift. */
  activityLevel: number;
  goal: Goal;
  /** Ziel-Gewichtsänderung in % Körpergewicht pro Woche (negativ = Abnahme). */
  weeklyRatePct: number;
  proteinGPerKg: number;
  fatGPerKg: number;
  /** Anteil des Trainings-/Aktivitätsverbrauchs, der dem Budget gutgeschrieben wird (0–100). */
  activityCreditPct: number;
  /** Manuelles Kalorienziel; überschreibt die Berechnung, wenn gesetzt. */
  kcalOverride: number | null;
}

export const DEFAULT_PROFILE: Profile = {
  sex: "m",
  birthYear: 1995,
  heightCm: 180,
  activityLevel: 1.4,
  goal: "recomp",
  weeklyRatePct: -0.25,
  proteinGPerKg: 2.2,
  fatGPerKg: 0.9,
  activityCreditPct: 50,
  kcalOverride: null,
};

/** Nährwerte je 100 g/ml. */
export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  satfatG: number;
}

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  satfatG: 0,
};

export interface Food extends Nutrients {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  baseUnit: "g" | "ml";
  saltG: number;
  /** Portionsgröße in g/ml, falls bekannt. */
  servingG: number | null;
  source: FoodSource;
  favorite: boolean;
}

export interface DiaryEntry extends Nutrients {
  id: string;
  day: string; // YYYY-MM-DD
  meal: Meal;
  foodId: string | null;
  name: string;
  qtyG: number;
}

export interface WeightEntry {
  day: string;
  weightKg: number;
}

export interface Workout {
  id: string;
  day: string;
  kind: string;
  title: string | null;
  durationMin: number;
  rpe: number | null;
  kcal: number;
  notes: string | null;
}

export interface StepsEntry {
  day: string;
  steps: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
