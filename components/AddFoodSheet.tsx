"use client";

// Lebensmittel erfassen: Schnellauswahl, Suche (lokal + Open Food Facts),
// Barcode-Scan und manuelle Eingabe – münden alle im Portionsschritt.

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { BarcodeScanner } from "./BarcodeScanner";
import { newId, recentFoods, upsertDiaryEntry, upsertFood, useStore } from "@/lib/store";
import { scaleNutrients } from "@/lib/day";
import { MEALS, MEAL_LABELS, type Food, type Meal } from "@/lib/types";

type Tab = "zuletzt" | "suche" | "scan" | "manuell";

interface Picked {
  food: Food;
  /** true, wenn das Food noch nicht in der eigenen Bibliothek liegt. */
  isNew: boolean;
}

const EMPTY_MANUAL = {
  name: "",
  brand: "",
  kcal: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  sugarG: "",
  satfatG: "",
  servingG: "",
  barcode: "",
};

export function AddFoodSheet({
  day,
  initialMeal,
  initialTab = "zuletzt",
  onClose,
}: {
  day: string;
  initialMeal: Meal;
  initialTab?: Tab;
  onClose: () => void;
}) {
  const store = useStore();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [qty, setQty] = useState("");

  const [query, setQuery] = useState("");
  const [offResults, setOffResults] = useState<Food[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [manual, setManual] = useState(EMPTY_MANUAL);

  const recent = useMemo(() => recentFoods(store), [store]);
  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return store.foods
      .filter((f) => f.name.toLowerCase().includes(q) || (f.brand ?? "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [store.foods, query]);

  function pick(food: Food, isNew: boolean) {
    setPicked({ food, isNew });
    setQty(String(food.servingG ?? 100));
  }

  async function searchOff() {
    setSearching(true);
    setOffResults(null);
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOffResults(
        (data.results as Omit<Food, "id" | "favorite">[]).map((r) => ({
          ...r,
          id: newId(),
          favorite: false,
        }))
      );
    } catch {
      setOffResults([]);
    }
    setSearching(false);
  }

  async function handleScan(code: string) {
    setScanStatus("Suche Produkt …");
    try {
      const res = await fetch(`/api/barcode/${code}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.found) {
        const food = data.cached
          ? (data.food as Food)
          : { ...(data.food as Omit<Food, "id" | "favorite">), id: newId(), favorite: false };
        pick(food, !data.cached);
        setScanStatus(null);
      } else {
        setScanStatus("Produkt nicht in Open Food Facts – bitte manuell anlegen.");
        setManual({ ...EMPTY_MANUAL, barcode: code });
        setTab("manuell");
      }
    } catch {
      setScanStatus("Lookup fehlgeschlagen – bist du online?");
    }
  }

  function pickManual() {
    const name = manual.name.trim();
    if (!name) return;
    const n = (v: string) => {
      const x = parseFloat(v.replace(",", "."));
      return Number.isFinite(x) && x >= 0 ? x : 0;
    };
    const servingG = n(manual.servingG);
    pick(
      {
        id: newId(),
        barcode: manual.barcode.trim() || null,
        name,
        brand: manual.brand.trim() || null,
        baseUnit: "g",
        kcal: n(manual.kcal),
        proteinG: n(manual.proteinG),
        carbsG: n(manual.carbsG),
        fatG: n(manual.fatG),
        fiberG: n(manual.fiberG),
        sugarG: n(manual.sugarG),
        satfatG: n(manual.satfatG),
        saltG: 0,
        servingG: servingG > 0 ? servingG : null,
        source: "manual",
        favorite: false,
      },
      true
    );
  }

  function save() {
    if (!picked) return;
    const qtyG = parseFloat(qty.replace(",", "."));
    if (!Number.isFinite(qtyG) || qtyG <= 0) return;
    if (picked.isNew) upsertFood(picked.food);
    const scaled = scaleNutrients(picked.food, qtyG);
    upsertDiaryEntry({
      id: newId(),
      day,
      meal,
      foodId: picked.food.id,
      name: picked.food.brand ? `${picked.food.name} (${picked.food.brand})` : picked.food.name,
      qtyG,
      ...scaled,
    });
    onClose();
  }

  // ---------------------------------------------------------- Portionsschritt

  if (picked) {
    const qtyG = parseFloat(qty.replace(",", "."));
    const valid = Number.isFinite(qtyG) && qtyG > 0;
    const preview = valid ? scaleNutrients(picked.food, qtyG) : null;
    const unit = picked.food.baseUnit;
    return (
      <Sheet onClose={onClose}>
        <h2>{picked.food.name}</h2>
        {picked.food.brand && <p className="hint" style={{ marginTop: -10 }}>{picked.food.brand}</p>}

        <p className="section-label">Menge ({unit})</p>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {[picked.food.servingG, 50, 100, 150, 200, 250]
            .filter((v, i, arr): v is number => v != null && v > 0 && arr.indexOf(v) === i)
            .map((v) => (
              <button
                key={v}
                className={`chip ${qty === String(v) ? "selected" : ""}`}
                onClick={() => setQty(String(v))}
              >
                {v === picked.food.servingG ? `Portion (${v} ${unit})` : `${v} ${unit}`}
              </button>
            ))}
        </div>
        <div className="field">
          <input
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label={`Menge in ${unit}`}
          />
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
          <button className="btn ghost" onClick={() => setPicked(null)}>
            Zurück
          </button>
          <button className="btn primary" disabled={!valid} onClick={save}>
            Eintragen
          </button>
        </div>
      </Sheet>
    );
  }

  // ---------------------------------------------------------------- Auswahl

  return (
    <Sheet onClose={onClose}>
      <h2>Essen erfassen</h2>
      <div className="segmented" role="tablist" style={{ marginBottom: 12 }}>
        {(
          [
            ["zuletzt", "Zuletzt"],
            ["suche", "Suche"],
            ["scan", "Scan"],
            ["manuell", "Manuell"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "zuletzt" && (
        <div className="result-list">
          {recent.length === 0 && (
            <p className="result-note">Noch keine Lebensmittel – scanne einen Barcode oder nutze die Suche.</p>
          )}
          {recent.map((f) => (
            <FoodRow key={f.id} food={f} onPick={() => pick(f, false)} />
          ))}
        </div>
      )}

      {tab === "suche" && (
        <div>
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              void searchOff();
            }}
          >
            <input
              placeholder="Lebensmittel suchen …"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffResults(null);
              }}
              autoFocus
            />
          </form>
          <div className="result-list">
            {localMatches.map((f) => (
              <FoodRow key={f.id} food={f} onPick={() => pick(f, false)} />
            ))}
            {query.trim().length >= 2 && offResults === null && (
              <button className="meal-add" onClick={() => void searchOff()} disabled={searching}>
                {searching ? "Suche in Open Food Facts …" : "In Open Food Facts suchen →"}
              </button>
            )}
            {offResults !== null && offResults.length === 0 && (
              <p className="result-note">Nichts gefunden – lege es manuell an.</p>
            )}
            {offResults?.map((f) => (
              <FoodRow key={f.id} food={f} onPick={() => pick(f, true)} />
            ))}
          </div>
        </div>
      )}

      {tab === "scan" && (
        <div>
          <BarcodeScanner onScan={(code) => void handleScan(code)} />
          {scanStatus && <p className="scanner-status">{scanStatus}</p>}
        </div>
      )}

      {tab === "manuell" && (
        <div>
          <div className="field-grid">
            <label className="field wide">
              Name
              <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            </label>
            <label className="field wide">
              Marke (optional)
              <input value={manual.brand} onChange={(e) => setManual({ ...manual, brand: e.target.value })} />
            </label>
            {(
              [
                ["kcal", "kcal / 100 g"],
                ["proteinG", "Protein g / 100 g"],
                ["carbsG", "Kohlenhydrate g"],
                ["fatG", "Fett g"],
                ["fiberG", "Ballaststoffe g"],
                ["sugarG", "davon Zucker g"],
                ["satfatG", "ges. Fettsäuren g"],
                ["servingG", "Portionsgröße g"],
              ] as [keyof typeof EMPTY_MANUAL, string][]
            ).map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <input
                  inputMode="decimal"
                  value={manual[key]}
                  onChange={(e) => setManual({ ...manual, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="sheet-actions">
            <button className="btn primary" disabled={manual.name.trim() === ""} onClick={pickManual}>
              Weiter zur Portion
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function FoodRow({ food, onPick }: { food: Food; onPick: () => void }) {
  return (
    <button className="food-row" onClick={onPick}>
      <div className="food-main">
        <div className="food-name">{food.name}</div>
        <div className="food-sub">
          {food.brand ? `${food.brand} · ` : ""}
          {Math.round(food.kcal)} kcal · {Math.round(food.proteinG)} g P / 100 {food.baseUnit}
        </div>
      </div>
      <span className="food-kcal mono">+</span>
    </button>
  );
}
