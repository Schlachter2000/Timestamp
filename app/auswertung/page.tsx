"use client";

import { useState } from "react";
import { categoryById, entriesInRange, useStore } from "@/lib/store";
import {
  addDays,
  dayKey,
  formatDayShort,
  formatSlotCount,
  monthStart,
  parseDayKey,
  todayKey,
  weekStart,
} from "@/lib/slots";

type Range = "heute" | "woche" | "monat" | "gesamt";

const RANGE_LABELS: Record<Range, string> = {
  heute: "Heute",
  woche: "Woche",
  monat: "Monat",
  gesamt: "Gesamt",
};

export default function AuswertungPage() {
  const store = useStore();
  const [range, setRange] = useState<Range>("heute");

  const today = todayKey();
  let from = today;
  let to = today;
  if (range === "woche") {
    from = weekStart(today);
    to = addDays(from, 6);
  } else if (range === "monat") {
    from = monthStart(today);
    const d = parseDayKey(from);
    to = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  } else if (range === "gesamt") {
    const days = Object.keys(store.entries).filter((d) => Object.keys(store.entries[d]).length > 0);
    from = days.length > 0 ? days.reduce((a, b) => (a < b ? a : b)) : today;
    to = today;
  }

  const entries = entriesInRange(store, from, to);

  // Slots pro Kategorie zählen; Einträge ohne Kategorie landen im Freitext-Sammler.
  const counts = new Map<string | null, number>();
  for (const entry of entries) {
    counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([categoryId, slots]) => {
      const category = categoryById(store, categoryId);
      return {
        key: categoryId ?? "__note__",
        name: categoryId ? (category?.name ?? "Gelöschte Kategorie") : "Freitext",
        color: categoryId ? (category?.color ?? "var(--note-fill)") : "var(--note-fill)",
        slots,
      };
    })
    .sort((a, b) => b.slots - a.slots);

  const total = entries.length;
  const max = rows.length > 0 ? rows[0].slots : 1;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="title">Auswertung</h1>
          <p className="subtitle mono">
            {range === "heute" ? formatDayShort(today) : `${formatDayShort(from)} – ${formatDayShort(to)}`}
          </p>
        </div>
      </header>

      <div style={{ padding: "0 16px 12px" }}>
        <div className="segmented">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          Noch keine Einträge in diesem Zeitraum.
          <br />
          Erfasse deinen ersten Slot in der Tagesansicht.
        </div>
      ) : (
        <>
          <p className="stats-summary">
            Erfasst: <strong className="mono">{formatSlotCount(total)}</strong>{" "}
            <span className="mono">({total} Slots)</span>
          </p>
          <div className="stats-list">
            {rows.map((row) => (
              <div key={row.key} className="stat-row">
                <div className="stat-head">
                  <span className="stat-name">
                    <span className="dot" style={{ background: row.color }} />
                    {row.name}
                  </span>
                  <span className="stat-value mono">
                    {formatSlotCount(row.slots)} · {Math.round((row.slots / total) * 100)} %
                  </span>
                </div>
                <div className="stat-track">
                  <div
                    className="stat-bar"
                    style={{ width: `${(row.slots / max) * 100}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
