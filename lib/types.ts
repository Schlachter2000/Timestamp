// Zentrale Typen – spiegeln db/schema.sql, damit der Wechsel von
// localStorage (Phase 1) auf die API (Phase 2) ohne UI-Änderungen geht.

export interface Category {
  id: string;
  name: string;
  color: string; // "#RRGGBB"
  position: number;
  archived: boolean;
}

export interface Entry {
  day: string; // "YYYY-MM-DD" (lokales Datum)
  slot: number; // 0–95, Slot 0 = 00:00–00:15
  categoryId: string | null;
  note: string | null;
}

/** Alle Einträge eines Tages, indiziert nach Slot. */
export type DayEntries = Partial<Record<number, Entry>>;

export interface StoreState {
  categories: Category[];
  /** Einträge nach Tag ("YYYY-MM-DD") und Slot. */
  entries: Record<string, DayEntries>;
}
