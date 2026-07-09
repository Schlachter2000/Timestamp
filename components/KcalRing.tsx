"use client";

/**
 * Kalorienring: Fortschritt der Zufuhr gegen das Tagesbudget.
 * Bei Überschreitung wechselt der Ring auf die Warnfarbe.
 */
export function KcalRing({ eaten, budget }: { eaten: number; budget: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const ratio = budget > 0 ? eaten / budget : 0;
  const filled = Math.min(1, ratio);
  const over = ratio > 1.02;
  const remaining = Math.round(budget - eaten);

  return (
    <div className="kcal-ring" role="img" aria-label={`${Math.round(eaten)} von ${Math.round(budget)} kcal`}>
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={over ? "var(--warn)" : "var(--accent)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c}`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-value mono">{Math.abs(remaining)}</span>
        <span className="ring-label">{remaining >= 0 ? "kcal übrig" : "kcal drüber"}</span>
      </div>
    </div>
  );
}
