"use client";

import type { Nutrients } from "@/lib/types";
import type { Targets } from "@/lib/science";

const ROWS = [
  { key: "proteinG", label: "Protein", color: "var(--protein)" },
  { key: "carbsG", label: "Kohlenhydrate", color: "var(--carbs)" },
  { key: "fatG", label: "Fett", color: "var(--fat)" },
] as const;

export function MacroBars({ eaten, targets }: { eaten: Nutrients; targets: Targets }) {
  return (
    <div className="macro-list">
      {ROWS.map((row) => {
        const value = eaten[row.key];
        const target = targets[row.key];
        const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
        return (
          <div className="macro-row" key={row.key}>
            <div className="macro-head">
              <span className="macro-name">{row.label}</span>
              <span className="macro-value mono">
                {Math.round(value)} / {target} g
              </span>
            </div>
            <div className="macro-track">
              <div className="macro-bar" style={{ width: `${pct}%`, background: row.color }} />
            </div>
          </div>
        );
      })}
      <div className="macro-row">
        <div className="macro-head">
          <span className="macro-name">Ballaststoffe</span>
          <span className="macro-value mono">
            {Math.round(eaten.fiberG)} / {targets.fiberG} g
          </span>
        </div>
        <div className="macro-track">
          <div
            className="macro-bar"
            style={{
              width: `${targets.fiberG > 0 ? Math.min(100, (eaten.fiberG / targets.fiberG) * 100) : 0}%`,
              background: "var(--muted)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
