"use client";

// Bestehenden Tagebucheintrag bearbeiten: Menge/Mahlzeit ändern oder löschen.
// Die Nährwerte je 100 g werden aus dem gespeicherten Eintrag zurückgerechnet.

import { useState } from "react";
import { Sheet } from "./Sheet";
import { deleteDiaryEntry, upsertDiaryEntry } from "@/lib/store";
import { scaleNutrients } from "@/lib/day";
import { MEALS, MEAL_LABELS, type DiaryEntry, type Meal, type Nutrients } from "@/lib/types";

export function EditEntrySheet({ entry, onClose }: { entry: DiaryEntry; onClose: () => void }) {
  const [qty, setQty] = useState(String(entry.qtyG));
  const [meal, setMeal] = useState<Meal>(entry.meal);

  const per100: Nutrients = {
    kcal: (entry.kcal / entry.qtyG) * 100,
    proteinG: (entry.proteinG / entry.qtyG) * 100,
    carbsG: (entry.carbsG / entry.qtyG) * 100,
    fatG: (entry.fatG / entry.qtyG) * 100,
    fiberG: (entry.fiberG / entry.qtyG) * 100,
    sugarG: (entry.sugarG / entry.qtyG) * 100,
    satfatG: (entry.satfatG / entry.qtyG) * 100,
  };

  const qtyG = parseFloat(qty.replace(",", "."));
  const valid = Number.isFinite(qtyG) && qtyG > 0;
  const preview = valid ? scaleNutrients(per100, qtyG) : null;

  function save() {
    if (!valid) return;
    upsertDiaryEntry({ ...entry, meal, qtyG, ...scaleNutrients(per100, qtyG) });
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <h2>{entry.name}</h2>

      <p className="section-label">Menge (g/ml)</p>
      <div className="field">
        <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      </div>

      <p className="section-label">Mahlzeit</p>
      <div className="chip-row">
        {MEALS.map((m) => (
          <button key={m} className={`chip ${meal === m ? "selected" : ""}`} onClick={() => setMeal(m)}>
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {preview && (
        <p className="hint" style={{ marginTop: 14 }}>
          {preview.kcal} kcal · {preview.proteinG} g Protein · {preview.carbsG} g KH · {preview.fatG} g Fett
        </p>
      )}

      <div className="sheet-actions">
        <button
          className="btn danger"
          onClick={() => {
            deleteDiaryEntry(entry.id);
            onClose();
          }}
        >
          Löschen
        </button>
        <button className="btn primary" disabled={!valid} onClick={save}>
          Speichern
        </button>
      </div>
    </Sheet>
  );
}
