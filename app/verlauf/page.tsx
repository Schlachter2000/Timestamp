"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { activeCategories, useStore } from "@/lib/store";
import type { Category, DayEntries, StoreState } from "@/lib/types";
import {
  SLOTS_PER_DAY,
  addDays,
  dayKey,
  formatMonth,
  formatDayShort,
  monthStart,
  parseDayKey,
  todayKey,
  weekStart,
} from "@/lib/slots";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function colorOf(categories: Category[], categoryId: string | null): string {
  if (!categoryId) return "var(--note-fill)";
  return categories.find((c) => c.id === categoryId)?.color ?? "var(--note-fill)";
}

/** Vertikaler Tagesstreifen: 96 Segmente von 00:00 (oben) bis 24:00 (unten). */
function DayStrip({ entries, categories }: { entries: DayEntries; categories: Category[] }) {
  const segments = [];
  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    const entry = entries[slot];
    segments.push(
      <div
        key={slot}
        className="seg"
        style={entry ? { background: colorOf(categories, entry.categoryId) } : undefined}
      />
    );
  }
  return <div className="week-strip">{segments}</div>;
}

function WeekView({ store, anchor, onOpenDay }: { store: StoreState; anchor: string; onOpenDay: (day: string) => void }) {
  const start = weekStart(anchor);
  const today = todayKey();
  return (
    <div className="week-grid">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        return (
          <button key={day} className={`week-col${day === today ? " today" : ""}`} onClick={() => onOpenDay(day)}>
            <span className="col-label">
              <strong>{WEEKDAY_LABELS[i]}</strong>
              {formatDayShort(day).slice(3)}
            </span>
            <DayStrip entries={store.entries[day] ?? {}} categories={store.categories} />
          </button>
        );
      })}
    </div>
  );
}

function MonthView({ store, anchor, onOpenDay }: { store: StoreState; anchor: string; onOpenDay: (day: string) => void }) {
  const first = monthStart(anchor);
  const month = parseDayKey(first).getMonth();
  const gridStart = weekStart(first);
  const today = todayKey();

  // 6 Wochen decken jeden Monat ab; letzte Zeile weglassen, wenn komplett im Folgemonat.
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
  const lastRowInMonth = cells.slice(35).some((d) => parseDayKey(d).getMonth() === month);
  const visible = lastRowInMonth ? cells : cells.slice(0, 35);

  return (
    <div className="month-grid">
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className="dow">
          {label}
        </div>
      ))}
      {visible.map((day) => {
        const inMonth = parseDayKey(day).getMonth() === month;
        const entries = store.entries[day] ?? {};
        // Anteile pro Kategorie für den Mini-Balken des Tages
        const counts = new Map<string, number>();
        let total = 0;
        for (const entry of Object.values(entries)) {
          if (!entry) continue;
          total++;
          const key = entry.categoryId ?? "__note__";
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return (
          <button
            key={day}
            className={`month-cell${inMonth ? "" : " outside"}${day === today ? " today" : ""}`}
            onClick={() => onOpenDay(day)}
          >
            <span className="daynum mono">{parseDayKey(day).getDate()}</span>
            <span className="mini-bar">
              {[...counts.entries()].map(([key, count]) => (
                <span
                  key={key}
                  style={{
                    width: `${(count / SLOTS_PER_DAY) * 100}%`,
                    background: key === "__note__" ? "var(--note-fill)" : colorOf(store.categories, key),
                  }}
                />
              ))}
              {total === 0 && <span />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function VerlaufPage() {
  const router = useRouter();
  const store = useStore();
  const [mode, setMode] = useState<"woche" | "monat">("woche");
  const [anchor, setAnchor] = useState(todayKey);

  function shift(delta: number) {
    if (mode === "woche") {
      setAnchor(addDays(weekStart(anchor), delta * 7));
    } else {
      const d = parseDayKey(monthStart(anchor));
      d.setMonth(d.getMonth() + delta);
      setAnchor(dayKey(d));
    }
  }

  const title =
    mode === "woche"
      ? `${formatDayShort(weekStart(anchor))} – ${formatDayShort(addDays(weekStart(anchor), 6))}`
      : formatMonth(anchor);

  function openDay(day: string) {
    router.push(day === todayKey() ? "/" : `/?tag=${day}`);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="title">Verlauf</h1>
          <p className="subtitle mono">{title}</p>
        </div>
        <div className="nav-buttons">
          <button className="nav-btn" aria-label="Zurück" onClick={() => shift(-1)}>
            ‹
          </button>
          <button className="nav-btn" aria-label="Weiter" onClick={() => shift(1)}>
            ›
          </button>
        </div>
      </header>

      <div style={{ padding: "0 16px 12px" }}>
        <div className="segmented">
          <button className={mode === "woche" ? "active" : ""} onClick={() => setMode("woche")}>
            Woche
          </button>
          <button className={mode === "monat" ? "active" : ""} onClick={() => setMode("monat")}>
            Monat
          </button>
        </div>
      </div>

      {mode === "woche" ? (
        <WeekView store={store} anchor={anchor} onOpenDay={openDay} />
      ) : (
        <MonthView store={store} anchor={anchor} onOpenDay={openDay} />
      )}

      <div className="legend">
        {activeCategories(store).map((cat) => (
          <span key={cat.id}>
            <span className="dot" style={{ background: cat.color }} />
            {cat.name}
          </span>
        ))}
      </div>
    </>
  );
}
