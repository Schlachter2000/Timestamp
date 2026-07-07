"use client";

import { useEffect, useRef } from "react";
import type { Category, DayEntries } from "@/lib/types";
import { SLOTS_PER_DAY, slotProgress, slotOfDate, slotStart } from "@/lib/slots";

interface Props {
  entries: DayEntries;
  categories: Category[];
  /** Aktuelle Uhrzeit, wenn der angezeigte Tag heute ist – steuert die Jetzt-Linie. */
  now: Date | null;
  onSlotClick: (slot: number) => void;
}

/**
 * Vertikale Tages-Timeline: 96 Zeilen à 15 Minuten, Stundenmarken links,
 * Einträge als farbige Balken (aufeinanderfolgende gleiche Einträge werden
 * optisch verbunden), Jetzt-Linie in Ultramarin mit Auto-Scroll.
 */
export function DayTimeline({ entries, categories, now, onSlotClick }: Props) {
  const nowRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);

  const nowSlot = now ? slotOfDate(now) : null;

  useEffect(() => {
    if (nowSlot !== null && !scrolledRef.current && nowRef.current) {
      scrolledRef.current = true;
      nowRef.current.scrollIntoView({ block: "center" });
    }
  }, [nowSlot]);

  const colorOf = (categoryId: string | null): string => {
    if (!categoryId) return "var(--note-fill)";
    return categories.find((c) => c.id === categoryId)?.color ?? "var(--note-fill)";
  };

  const rows = [];
  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    const entry = entries[slot];
    const prev = entries[slot - 1];
    const next = entries[slot + 1];
    const joinPrev =
      !!entry && !!prev && prev.categoryId === entry.categoryId && prev.note === entry.note;
    const joinNext =
      !!entry && !!next && next.categoryId === entry.categoryId && next.note === entry.note;
    const isHour = slot % 4 === 0;

    rows.push(
      <div key={slot} className={`tl-row${isHour ? " hour" : ""}`}>
        <div className="tl-time mono">{isHour ? slotStart(slot) : ""}</div>
        <button
          className="tl-slot"
          aria-label={`Slot ${slotStart(slot)}`}
          onClick={() => onSlotClick(slot)}
        >
          {entry && (
            <span
              className={`tl-fill${joinPrev ? " join-prev" : ""}${joinNext ? " join-next" : ""}`}
              style={{ background: colorOf(entry.categoryId) }}
            >
              {!joinPrev &&
                (entry.categoryId ? (
                  <>
                    {categories.find((c) => c.id === entry.categoryId)?.name ?? "?"}
                    {entry.note && <span className="fill-note">&nbsp;· {entry.note}</span>}
                  </>
                ) : (
                  <span className="fill-note">{entry.note}</span>
                ))}
            </span>
          )}
          {slot === nowSlot && now && (
            <div
              ref={nowRef}
              className="tl-now"
              style={{ top: `${slotProgress(now) * 100}%` }}
            />
          )}
        </button>
      </div>
    );
  }

  return <div className="timeline">{rows}</div>;
}
