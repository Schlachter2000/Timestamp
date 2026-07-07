"use client";

// Datenschicht für Phase 1: localStorage, reaktiv über useSyncExternalStore.
// Die öffentlichen Funktionen (upsertEntry, addCategory, …) sind bewusst so
// geschnitten wie die späteren API-Routen – Phase 2 tauscht nur die
// Implementierung gegen fetch-Aufrufe plus Server-Sync aus.

import { useSyncExternalStore } from "react";
import type { Category, DayEntries, Entry, StoreState } from "./types";
import { SLOTS_PER_DAY } from "./slots";

const CATEGORIES_KEY = "timestamp.categories";
const ENTRIES_KEY = "timestamp.entries";

// Farbset mit scripts/validate_palette.js (dataviz) gegen beide Themes geprüft:
// Chroma-Floor, CVD-Trennung und Kontrast bestehen; im Dark Mode gilt die
// Label-Auflage, die Timeline und Auswertung durch direkte Textlabels erfüllen.
export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Arbeit", color: "#2E8A5C", position: 0, archived: false },
  { name: "Meeting", color: "#B13A4B", position: 1, archived: false },
  { name: "Essen", color: "#B0622D", position: 2, archived: false },
  { name: "Pause", color: "#C2497B", position: 3, archived: false },
  { name: "Sport", color: "#2B7BBF", position: 4, archived: false },
  { name: "Schlaf", color: "#7A55C2", position: 5, archived: false },
];

/** Gedeckte Werkbank-Farben für den Kategorie-Editor. */
export const CATEGORY_PALETTE = [
  "#2E8A5C", "#B13A4B", "#B0622D", "#C2497B", "#2B7BBF",
  "#7A55C2", "#B08427", "#5C6470",
];

const EMPTY_STATE: StoreState = { categories: [], entries: {} };

let state: StoreState = EMPTY_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const rawCategories = window.localStorage.getItem(CATEGORIES_KEY);
    const rawEntries = window.localStorage.getItem(ENTRIES_KEY);
    let categories: Category[];
    if (rawCategories) {
      categories = JSON.parse(rawCategories);
    } else {
      categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: makeId() }));
      window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    }
    const entries: StoreState["entries"] = rawEntries ? JSON.parse(rawEntries) : {};
    state = { categories, entries };
  } catch {
    state = { categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, id: makeId() })), entries: {} };
  }
}

function persist(): void {
  window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(state.categories));
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(state.entries));
}

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): StoreState {
  load();
  return state;
}

function getServerSnapshot(): StoreState {
  return EMPTY_STATE;
}

/** Reaktiver Zugriff auf den gesamten Store. */
export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Änderungen aus anderen Tabs/Fenstern übernehmen.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CATEGORIES_KEY || e.key === ENTRIES_KEY) {
      loaded = false;
      load();
      emit();
    }
  });
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
  load();
  const dayEntries: DayEntries = { ...state.entries[day] };
  for (let s = slot; s < Math.min(slot + slotCount, SLOTS_PER_DAY); s++) {
    dayEntries[s] = { day, slot: s, categoryId: data.categoryId, note: data.note };
  }
  state = { ...state, entries: { ...state.entries, [day]: dayEntries } };
  persist();
  emit();
}

export function clearEntry(day: string, slot: number): void {
  load();
  const dayEntries: DayEntries = { ...state.entries[day] };
  delete dayEntries[slot];
  state = { ...state, entries: { ...state.entries, [day]: dayEntries } };
  persist();
  emit();
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

export function addCategory(name: string, color: string): Category {
  load();
  const category: Category = {
    id: makeId(),
    name: name.trim(),
    color,
    position: state.categories.length,
    archived: false,
  };
  state = { ...state, categories: [...state.categories, category] };
  persist();
  emit();
  return category;
}

export function updateCategory(id: string, patch: Partial<Pick<Category, "name" | "color" | "archived">>): void {
  load();
  state = {
    ...state,
    categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
  persist();
  emit();
}

export function categoryById(s: StoreState, id: string | null): Category | undefined {
  if (!id) return undefined;
  return s.categories.find((c) => c.id === id);
}

export function activeCategories(s: StoreState): Category[] {
  return s.categories.filter((c) => !c.archived);
}
