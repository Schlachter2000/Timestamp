// Kleine Validierungshelfer für die API-Routen. Der Client ist vertrauens-
// würdig (eigene App), aber Replays aus der Offline-Outbox müssen idempotent
// und formal sauber sein.

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function str(v: unknown, maxLen = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, maxLen);
}

export function num(v: unknown, min: number, max: number, fallback: number | null = null): number | null {
  const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
  if (Number.isNaN(n) || n < min || n > max) return fallback;
  return n;
}

export function day(v: unknown): string | null {
  return typeof v === "string" && DAY_RE.test(v) ? v : null;
}

export function uuid(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}
