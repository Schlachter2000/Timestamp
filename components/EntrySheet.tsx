"use client";

import { useEffect, useState } from "react";
import type { Category, Entry } from "@/lib/types";
import { SLOTS_PER_DAY, slotRangeLabel } from "@/lib/slots";
import { clearEntry, upsertEntry } from "@/lib/store";

const DURATIONS = [1, 2, 3, 4]; // × 15 min

interface Props {
  day: string;
  slot: number;
  entry: Entry | undefined;
  categories: Category[];
  onClose: () => void;
}

/**
 * Bottom-Sheet für die Schnelleingabe eines Slots: Kategorie-Chip antippen,
 * optional Dauer (15–60 min) und Freitext, speichern. Der häufigste Fall –
 * Kategorie wählen + Speichern – braucht genau zwei Taps.
 */
export function EntrySheet({ day, slot, entry, categories, onClose }: Props) {
  const [categoryId, setCategoryId] = useState<string | null>(entry?.categoryId ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxDuration = Math.min(4, SLOTS_PER_DAY - slot);
  const canSave = categoryId !== null || note.trim() !== "";

  function save() {
    if (!canSave) return;
    upsertEntry(day, slot, { categoryId, note: note.trim() || null }, duration);
    onClose();
  }

  function remove() {
    clearEntry(day, slot);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Eintrag für ${slotRangeLabel(slot, duration)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="handle" />
        <div className="slot-label mono">{slotRangeLabel(slot, duration)}</div>
        <h2>{entry ? "Eintrag bearbeiten" : "Was machst du gerade?"}</h2>

        <div className="chip-row">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`chip${categoryId === cat.id ? " selected" : ""}`}
              onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
            >
              <span className="dot" style={{ background: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>

        <div className="section-label">Dauer</div>
        <div className="chip-row">
          {DURATIONS.filter((d) => d <= maxDuration).map((d) => (
            <button
              key={d}
              className={`chip duration${duration === d ? " selected" : ""}`}
              onClick={() => setDuration(d)}
            >
              {d * 15} min
            </button>
          ))}
        </div>

        <div className="section-label">Notiz</div>
        <input
          className="note-input"
          type="text"
          placeholder="… oder freier Text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />

        <div className="sheet-actions">
          {entry && (
            <button className="btn danger" onClick={remove}>
              Löschen
            </button>
          )}
          <button className="btn primary" disabled={!canSave} onClick={save}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
