"use client";

// Datenschicht ab Phase 2: Der Server (Postgres via API-Routes) ist die
// Quelle der Wahrheit; dieser Store hält eine reaktive Kopie im Speicher.
// Mutationen werden optimistisch angewendet und an die API geschrieben;
// schlägt ein Write fehl, wird der Serverstand neu geladen. Refetch bei
// Fokus/Sichtbarkeit und alle 60 s hält mehrere Geräte synchron.

import { useSyncExternalStore } from "react";
import type { Category, DayEntries, Entry, StoreState } from "./types";
import { SLOTS_PER_DAY } from "./slots";

export type AuthStatus = "loading" | "anon" | "authed";

export interface SyncState extends StoreState {
  auth: AuthStatus;
  email: string | null;
}

/** Gedeckte Werkbank-Farben für den Kategorie-Editor. */
export const CATEGORY_PALETTE = [
  "#2E8A5C", "#B13A4B", "#B0622D", "#C2497B", "#2B7BBF",
  "#7A55C2", "#B08427", "#5C6470",
];

const EMPTY_STATE: SyncState = { auth: "loading", email: null, categories: [], entries: {} };

let state: SyncState = EMPTY_STATE;
const listeners = new Set<() => void>();
let initialized = false;

function emit(): void {
  for (const fn of listeners) fn();
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): SyncState {
  init();
  return state;
}

function getServerSnapshot(): SyncState {
  return EMPTY_STATE;
}

export function useStore(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------------------------------------------------------------------------
// Laden & Sync
// ---------------------------------------------------------------------------

interface ApiEntry {
  day: string;
  slot: number;
  categoryId: string | null;
  note: string | null;
}

export async function refetchAll(): Promise<void> {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 401) {
      setState({ auth: "anon", email: null, categories: [], entries: {} });
      return;
    }
    if (!res.ok) return; // transienter Fehler: alten Stand behalten
    const data: { email: string; categories: Category[]; entries: ApiEntry[] } = await res.json();
    const entries: Record<string, DayEntries> = {};
    for (const e of data.entries) {
      (entries[e.day] ??= {})[e.slot] = e;
    }
    setState({ auth: "authed", email: data.email, categories: data.categories, entries });
    void migrateLegacyLocalData();
  } catch {
    // offline o. ä. – alten Stand behalten
  }
}

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void refetchAll();
  window.addEventListener("focus", () => void refetchAll());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refetchAll();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && state.auth === "authed") void refetchAll();
  }, 60_000);
}

/** Nach fehlgeschlagenem Write: Serverstand ist maßgeblich. */
function reconcile(): void {
  void refetchAll();
}

async function apiWrite(input: RequestInfo, init?: RequestInit): Promise<boolean> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      reconcile();
      return false;
    }
    return true;
  } catch {
    reconcile();
    return false;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign("/login");
}

// ---------------------------------------------------------------------------
// Einträge
// ---------------------------------------------------------------------------

export function upsertEntry(
  day: string,
  slot: number,
  data: { categoryId: string | null; note: string | null },
  slotCount = 1
): void {
  const dayEntries: DayEntries = { ...state.entries[day] };
  for (let s = slot; s < Math.min(slot + slotCount, SLOTS_PER_DAY); s++) {
    dayEntries[s] = { day, slot: s, categoryId: data.categoryId, note: data.note };
  }
  setState({ entries: { ...state.entries, [day]: dayEntries } });

  void apiWrite("/api/entries", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, slot, slotCount, ...data }),
  });
}

export function clearEntry(day: string, slot: number): void {
  const dayEntries: DayEntries = { ...state.entries[day] };
  delete dayEntries[slot];
  setState({ entries: { ...state.entries, [day]: dayEntries } });

  void apiWrite(`/api/entries?day=${day}&slot=${slot}`, { method: "DELETE" });
}

/** Alle Einträge in [from, to] (Tages-Keys, inklusive) als flache Liste. */
export function entriesInRange(s: StoreState, from: string, to: string): Entry[] {
  const result: Entry[] = [];
  for (const [day, dayEntries] of Object.entries(s.entries)) {
    if (day < from || day > to) continue;
    for (const entry of Object.values(dayEntries)) {
      if (entry) result.push(entry);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export function addCategory(name: string, color: string): void {
  // Nicht optimistisch: Die Server-ID wird für Folge-Writes gebraucht.
  void (async () => {
    const ok = await apiWrite("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (ok) reconcile();
  })();
}

export function updateCategory(
  id: string,
  patch: Partial<Pick<Category, "name" | "color" | "archived">>
): void {
  setState({
    categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  });
  void apiWrite(`/api/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function categoryById(s: StoreState, id: string | null): Category | undefined {
  if (!id) return undefined;
  return s.categories.find((c) => c.id === id);
}

export function activeCategories(s: StoreState): Category[] {
  return s.categories.filter((c) => !c.archived);
}

// ---------------------------------------------------------------------------
// Einmaliger Import des Phase-1-Stands aus localStorage
// ---------------------------------------------------------------------------

const LEGACY_CATEGORIES_KEY = "timestamp.categories";
const LEGACY_ENTRIES_KEY = "timestamp.entries";
const MIGRATED_KEY = "timestamp.migrated";

async function migrateLegacyLocalData(): Promise<void> {
  if (window.localStorage.getItem(MIGRATED_KEY)) return;
  const rawCategories = window.localStorage.getItem(LEGACY_CATEGORIES_KEY);
  const rawEntries = window.localStorage.getItem(LEGACY_ENTRIES_KEY);
  if (!rawEntries) return;
  // Nur importieren, solange das Konto leer ist (Server prüft das ebenfalls).
  if (Object.keys(state.entries).length > 0) {
    window.localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }
  try {
    const localCategories: Category[] = rawCategories ? JSON.parse(rawCategories) : [];
    const localEntries: Record<string, DayEntries> = JSON.parse(rawEntries);
    const nameById = new Map(localCategories.map((c) => [c.id, c.name]));
    const entries = Object.values(localEntries)
      .flatMap((day) => Object.values(day))
      .filter((e): e is Entry => Boolean(e))
      .map((e) => ({
        day: e.day,
        slot: e.slot,
        category: e.categoryId ? (nameById.get(e.categoryId) ?? null) : null,
        note: e.note,
      }));
    if (entries.length === 0) {
      window.localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories: localCategories.map((c) => ({ name: c.name, color: c.color, archived: c.archived })),
        entries,
      }),
    });
    if (res.ok) {
      window.localStorage.setItem(MIGRATED_KEY, "1");
      await refetchAll();
    }
  } catch {
    // beim nächsten Laden erneut versuchen
  }
}
