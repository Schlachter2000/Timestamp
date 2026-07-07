// Slot- und Datums-Arithmetik. Ein Tag = 96 Slots à 15 Minuten.

export const SLOTS_PER_DAY = 96;
export const SLOT_MINUTES = 15;

/** "YYYY-MM-DD" für ein Date im lokalen Kalender. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date (lokale Mitternacht) aus einem "YYYY-MM-DD"-Key. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return dayKey(new Date());
}

export function addDays(key: string, delta: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** Aktueller Slot-Index (0–95) für einen Zeitpunkt. */
export function slotOfDate(date: Date): number {
  return date.getHours() * 4 + Math.floor(date.getMinutes() / SLOT_MINUTES);
}

/** Anteil (0–1), wie weit der Zeitpunkt im aktuellen Slot fortgeschritten ist. */
export function slotProgress(date: Date): number {
  return ((date.getMinutes() % SLOT_MINUTES) * 60 + date.getSeconds()) / (SLOT_MINUTES * 60);
}

/** "09:45" – Startzeit eines Slots. */
export function slotStart(slot: number): string {
  const h = Math.floor(slot / 4);
  const m = (slot % 4) * SLOT_MINUTES;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:45 – 10:00" – Zeitspanne eines Slots (oder mehrerer aufeinanderfolgender). */
export function slotRangeLabel(slot: number, count = 1): string {
  const end = slot + count;
  const endLabel = end >= SLOTS_PER_DAY ? "24:00" : slotStart(end);
  return `${slotStart(slot)} – ${endLabel}`;
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** "Dienstag, 7. Juli" */
export function formatDayLong(key: string): string {
  const d = parseDayKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

/** "Di 07.07." */
export function formatDayShort(key: string): string {
  const d = parseDayKey(key);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS_SHORT[d.getDay()]} ${dd}.${mm}.`;
}

/** "Juli 2026" */
export function formatMonth(key: string): string {
  const d = parseDayKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Montag der Woche, in der `key` liegt. */
export function weekStart(key: string): string {
  const d = parseDayKey(key);
  const shift = (d.getDay() + 6) % 7; // Mo=0 … So=6
  d.setDate(d.getDate() - shift);
  return dayKey(d);
}

/** Erster Tag des Monats, in dem `key` liegt. */
export function monthStart(key: string): string {
  const d = parseDayKey(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Alle Tages-Keys von `from` bis `to` (inklusive). */
export function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

/** "3 h 45 min" aus einer Slot-Anzahl. */
export function formatSlotCount(slots: number): string {
  const minutes = slots * SLOT_MINUTES;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
