"use client";

// Training/Aktivität erfassen: Art (MET-Katalog), Dauer, RPE.
// Der Verbrauch wird als Netto-kcal über (MET − 1) vorgeschlagen und
// kann manuell übersteuert werden (z. B. Uhr-Messwert).

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { deleteWorkout, newId, upsertWorkout, useStore } from "@/lib/store";
import { ACTIVITY_KINDS, activityKind, trendWeights, workoutKcal } from "@/lib/science";
import type { Workout } from "@/lib/types";

export function WorkoutSheet({
  day,
  existing,
  onClose,
}: {
  day: string;
  existing: Workout | null;
  onClose: () => void;
}) {
  const store = useStore();
  const weightKg = useMemo(() => {
    const trend = trendWeights(store.weights);
    return trend.length > 0 ? trend[trend.length - 1].trendKg : 75;
  }, [store.weights]);

  const [kind, setKind] = useState(existing?.kind ?? "kraft");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [duration, setDuration] = useState(String(existing?.durationMin ?? 60));
  const [rpe, setRpe] = useState(existing?.rpe != null ? String(existing.rpe) : "");
  const [kcalOverride, setKcalOverride] = useState(existing ? String(Math.round(existing.kcal)) : "");
  const [kcalTouched, setKcalTouched] = useState(existing !== null);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const durationMin = parseInt(duration, 10);
  const validDuration = Number.isInteger(durationMin) && durationMin > 0 && durationMin <= 1440;
  const suggested = validDuration ? workoutKcal(activityKind(kind).met, weightKg, durationMin) : 0;
  const kcal = kcalTouched && kcalOverride !== "" ? parseFloat(kcalOverride) : suggested;

  function save() {
    if (!validDuration || !Number.isFinite(kcal) || kcal < 0) return;
    upsertWorkout({
      id: existing?.id ?? newId(),
      day,
      kind,
      title: title.trim() || null,
      durationMin,
      rpe: rpe === "" ? null : Math.min(10, Math.max(1, parseInt(rpe, 10) || 5)),
      kcal: Math.round(kcal),
      notes: notes.trim() || null,
    });
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{existing ? "Training bearbeiten" : "Training erfassen"}</h2>

      <p className="section-label">Art</p>
      <div className="chip-row">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k.id}
            className={`chip ${kind === k.id ? "selected" : ""}`}
            onClick={() => {
              setKind(k.id);
              setKcalTouched(false);
              setKcalOverride("");
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="field-grid" style={{ marginTop: 14 }}>
        <label className="field">
          Dauer (min)
          <input inputMode="numeric" value={duration} onChange={(e) => {
            setDuration(e.target.value);
            if (!kcalTouched) setKcalOverride("");
          }} />
        </label>
        <label className="field">
          Anstrengung (RPE 1–10)
          <input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="optional" />
        </label>
        <label className="field">
          Verbrauch (kcal)
          <input
            inputMode="numeric"
            value={kcalTouched && kcalOverride !== "" ? kcalOverride : String(suggested)}
            onChange={(e) => {
              setKcalTouched(true);
              setKcalOverride(e.target.value);
            }}
          />
        </label>
        <label className="field">
          Titel (optional)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Push Day" />
        </label>
        <label className="field wide">
          Notizen
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Übungen, Gewichte, PRs …" />
        </label>
      </div>
      <p className="hint">
        Vorschlag: {suggested} kcal netto ({activityKind(kind).met} MET bei {Math.round(weightKg)} kg).
      </p>

      <div className="sheet-actions">
        {existing && (
          <button
            className="btn danger"
            onClick={() => {
              deleteWorkout(existing.id);
              onClose();
            }}
          >
            Löschen
          </button>
        )}
        <button className="btn primary" disabled={!validDuration} onClick={save}>
          Speichern
        </button>
      </div>
    </Sheet>
  );
}
