"use client";

// =============================================================================
// Offline-first Datenschicht
//
// Prinzip: Der Client ist sofort benutzbar – auch ohne Netz.
//  1. Snapshot: Der komplette Datenstand liegt als Kopie in IndexedDB und
//     wird beim Start vor dem ersten Netz-Roundtrip geladen.
//  2. Outbox: Jede Mutation wird optimistisch auf den State angewendet UND
//     als idempotenter Request (Client-UUIDs, Upserts) in eine persistente
//     Warteschlange gelegt. Online werden die Requests der Reihe nach
//     abgespielt; danach gleicht ein Refetch den Serverstand ab.
//  3. Sync-Trigger: online-Event, Fokus/Sichtbarkeit, 60-s-Intervall.
// =============================================================================

import { useSyncExternalStore } from "react";
import type {
  ChatMessage,
  DiaryEntry,
  Food,
  Meal,
  Profile,
  StepsEntry,
  WeightEntry,
  Workout,
} from "./types";
import { DEFAULT_PROFILE } from "./types";
import { idbDelete, idbGet, idbSet } from "./idb";

export type AuthStatus = "loading" | "anon" | "authed";

export interface AppState {
  auth: AuthStatus;
  email: string | null;
  profile: Profile;
  foods: Food[];
  diary: DiaryEntry[];
  weights: WeightEntry[];
  workouts: Workout[];
  steps: StepsEntry[];
  chat: ChatMessage[];
  /** Anzahl wartender Offline-Mutationen (0 = alles synchron). */
  pending: number;
}

const EMPTY_STATE: AppState = {
  auth: "loading",
  email: null,
  profile: DEFAULT_PROFILE,
  foods: [],
  diary: [],
  weights: [],
  workouts: [],
  steps: [],
  chat: [],
  pending: 0,
};

interface OutboxItem {
  /** Dedupe-Schlüssel: ein neuer Eintrag ersetzt einen wartenden mit gleichem Schlüssel. */
  key: string;
  url: string;
  method: "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

const SNAPSHOT_KEY = "snapshot.v1";
const OUTBOX_KEY = "outbox.v1";

let state: AppState = EMPTY_STATE;
let outbox: OutboxItem[] = [];
const listeners = new Set<() => void>();
let initialized = false;
let flushing = false;

function emit(): void {
  for (const fn of listeners) fn();
}

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  emit();
}

/** Datenteil des States (ohne auth/pending) nach IndexedDB spiegeln. */
function persistSnapshot(): void {
  const { auth, pending, ...data } = state;
  void auth;
  void pending;
  void idbSet(SNAPSHOT_KEY, data);
}

function setData(patch: Partial<AppState>): void {
  setState(patch);
  persistSnapshot();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): AppState {
  init();
  return state;
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Initialisierung & Sync
// ---------------------------------------------------------------------------

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  void (async () => {
    // 1. Offline-Snapshot sofort anzeigen
    const [snapshot, storedOutbox] = await Promise.all([
      idbGet<Omit<AppState, "auth" | "pending">>(SNAPSHOT_KEY),
      idbGet<OutboxItem[]>(OUTBOX_KEY),
    ]);
    outbox = storedOutbox ?? [];
    if (snapshot) {
      setState({ ...snapshot, auth: "authed", pending: outbox.length });
    } else {
      setState({ pending: outbox.length });
    }
    // 2. Outbox abspielen, dann Serverstand holen
    await flushOutbox();
    await refetchAll();
  })();

  window.addEventListener("online", () => void sync());
  window.addEventListener("focus", () => void sync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sync();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && state.auth === "authed") void sync();
  }, 60_000);
}

async function sync(): Promise<void> {
  await flushOutbox();
  await refetchAll();
}

export async function refetchAll(): Promise<void> {
  if (outbox.length > 0) return; // erst lokale Änderungen abspielen, sonst überschreibt der Refetch sie
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 401) {
      setState({ ...EMPTY_STATE, auth: "anon" });
      void idbDelete(SNAPSHOT_KEY);
      return;
    }
    if (!res.ok) return; // transienter Fehler: alten Stand behalten
    const data = await res.json();
    setData({
      auth: "authed",
      email: data.email,
      profile: { ...DEFAULT_PROFILE, ...data.profile },
      foods: data.foods,
      diary: data.diary,
      weights: data.weights,
      workouts: data.workouts,
      steps: data.steps,
      chat: data.chat,
    });
  } catch {
    // offline – Snapshot bleibt gültig
  }
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

function persistOutbox(): void {
  void idbSet(OUTBOX_KEY, outbox);
  setState({ pending: outbox.length });
}

function enqueue(item: OutboxItem): void {
  outbox = outbox.filter((o) => o.key !== item.key);
  outbox.push(item);
  persistOutbox();
  void flushOutbox().then(() => {
    if (outbox.length === 0) void refetchAll();
  });
}

async function flushOutbox(): Promise<void> {
  if (flushing || outbox.length === 0) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    while (outbox.length > 0) {
      const item = outbox[0];
      let res: Response;
      try {
        res = await fetch(item.url, {
          method: item.method,
          headers: item.body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        });
      } catch {
        return; // Netz weg – später erneut
      }
      if (res.ok) {
        outbox.shift();
        persistOutbox();
        continue;
      }
      if (res.status === 401) return; // Session weg – Outbox behalten, Login abwarten
      if (res.status === 429 || res.status >= 500) return; // transient – später erneut
      // Permanenter Fehler (400 …): Eintrag verwerfen, sonst blockiert er die Queue.
      outbox.shift();
      persistOutbox();
    }
  } finally {
    flushing = false;
  }
}

// ---------------------------------------------------------------------------
// Mutationen (optimistisch + Outbox)
// ---------------------------------------------------------------------------

export function upsertFood(food: Food): void {
  const exists = state.foods.some((f) => f.id === food.id);
  setData({
    foods: exists ? state.foods.map((f) => (f.id === food.id ? food : f)) : [food, ...state.foods],
  });
  enqueue({ key: `food:${food.id}`, url: "/api/foods", method: "PUT", body: food });
}

export function deleteFood(id: string): void {
  setData({ foods: state.foods.filter((f) => f.id !== id) });
  outbox = outbox.filter((o) => o.key !== `food:${id}`);
  enqueue({ key: `food-del:${id}`, url: `/api/foods?id=${id}`, method: "DELETE" });
}

export function upsertDiaryEntry(entry: DiaryEntry): void {
  const exists = state.diary.some((e) => e.id === entry.id);
  setData({
    diary: exists ? state.diary.map((e) => (e.id === entry.id ? entry : e)) : [...state.diary, entry],
  });
  enqueue({ key: `diary:${entry.id}`, url: "/api/diary", method: "PUT", body: entry });
}

export function deleteDiaryEntry(id: string): void {
  setData({ diary: state.diary.filter((e) => e.id !== id) });
  outbox = outbox.filter((o) => o.key !== `diary:${id}`);
  enqueue({ key: `diary-del:${id}`, url: `/api/diary?id=${id}`, method: "DELETE" });
}

export function setWeight(day: string, weightKg: number): void {
  const rest = state.weights.filter((w) => w.day !== day);
  setData({ weights: [...rest, { day, weightKg }].sort((a, b) => (a.day < b.day ? -1 : 1)) });
  enqueue({ key: `weight:${day}`, url: "/api/weights", method: "PUT", body: { day, weightKg } });
}

export function deleteWeight(day: string): void {
  setData({ weights: state.weights.filter((w) => w.day !== day) });
  outbox = outbox.filter((o) => o.key !== `weight:${day}`);
  enqueue({ key: `weight-del:${day}`, url: `/api/weights?day=${day}`, method: "DELETE" });
}

export function upsertWorkout(workout: Workout): void {
  const exists = state.workouts.some((w) => w.id === workout.id);
  setData({
    workouts: exists
      ? state.workouts.map((w) => (w.id === workout.id ? workout : w))
      : [...state.workouts, workout],
  });
  enqueue({ key: `workout:${workout.id}`, url: "/api/workouts", method: "PUT", body: workout });
}

export function deleteWorkout(id: string): void {
  setData({ workouts: state.workouts.filter((w) => w.id !== id) });
  outbox = outbox.filter((o) => o.key !== `workout:${id}`);
  enqueue({ key: `workout-del:${id}`, url: `/api/workouts?id=${id}`, method: "DELETE" });
}

export function setSteps(day: string, steps: number): void {
  const rest = state.steps.filter((s) => s.day !== day);
  setData({
    steps: steps > 0 ? [...rest, { day, steps }].sort((a, b) => (a.day < b.day ? -1 : 1)) : rest,
  });
  enqueue({ key: `steps:${day}`, url: "/api/steps", method: "PUT", body: { day, steps } });
}

export function updateProfile(patch: Partial<Profile>): void {
  const profile = { ...state.profile, ...patch };
  setData({ profile });
  enqueue({ key: "profile", url: "/api/profile", method: "PATCH", body: profile });
}

/** Chat-Nachrichten lokal ergänzen (Persistenz übernimmt die Coach-Route). */
export function appendChat(messages: ChatMessage[]): void {
  setData({ chat: [...state.chat, ...messages].slice(-80) });
}

export function replaceLastAssistant(content: string): void {
  const chat = [...state.chat];
  for (let i = chat.length - 1; i >= 0; i--) {
    if (chat[i].role === "assistant") {
      chat[i] = { ...chat[i], content };
      break;
    }
  }
  setData({ chat });
}

export function clearChat(): void {
  setData({ chat: [] });
  enqueue({ key: "chat-clear", url: "/api/coach", method: "DELETE" });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  outbox = [];
  void idbDelete(SNAPSHOT_KEY);
  void idbDelete(OUTBOX_KEY);
  window.location.assign("/login");
}

// ---------------------------------------------------------------------------
// Selektoren
// ---------------------------------------------------------------------------

export function diaryForDay(s: AppState, day: string): DiaryEntry[] {
  return s.diary.filter((e) => e.day === day);
}

export function diaryForMeal(s: AppState, day: string, meal: Meal): DiaryEntry[] {
  return s.diary.filter((e) => e.day === day && e.meal === meal);
}

export function workoutsForDay(s: AppState, day: string): Workout[] {
  return s.workouts.filter((w) => w.day === day);
}

export function stepsForDay(s: AppState, day: string): number {
  return s.steps.find((e) => e.day === day)?.steps ?? 0;
}

export function weightForDay(s: AppState, day: string): WeightEntry | undefined {
  return s.weights.find((w) => w.day === day);
}

/** Favoriten und am häufigsten geloggte Lebensmittel für die Schnellauswahl. */
export function recentFoods(s: AppState, limit = 12): Food[] {
  const counts = new Map<string, number>();
  for (const e of s.diary) {
    if (e.foodId) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
  }
  return [...s.foods]
    .sort((a, b) => {
      const fav = Number(b.favorite) - Number(a.favorite);
      if (fav !== 0) return fav;
      return (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    })
    .slice(0, limit);
}
