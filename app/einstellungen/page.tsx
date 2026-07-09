"use client";

// Einstellungen: Profil & Ziele (Basis der Science-Schicht), Darstellung,
// Installation, Datenexport, Abmelden.

import { useEffect, useMemo, useState } from "react";
import { logout, updateProfile, useStore } from "@/lib/store";
import { computeDayStats } from "@/lib/day";
import { todayKey } from "@/lib/dates";
import { GOAL_LABELS, type Goal, type Profile } from "@/lib/types";
import { InstallSection } from "@/components/InstallSection";

const GOAL_PRESETS: Record<Goal, { weeklyRatePct: number; proteinGPerKg: number }> = {
  cut: { weeklyRatePct: -0.5, proteinGPerKg: 2.2 },
  recomp: { weeklyRatePct: -0.25, proteinGPerKg: 2.2 },
  gain: { weeklyRatePct: 0.25, proteinGPerKg: 1.8 },
  maintain: { weeklyRatePct: 0, proteinGPerKg: 1.8 },
};

type Theme = "auto" | "light" | "dark";

export default function SettingsPage() {
  const store = useStore();
  const [draft, setDraft] = useState<Profile>(store.profile);
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    if (!dirty) setDraft(store.profile);
  }, [store.profile, dirty]);

  useEffect(() => {
    const stored = localStorage.getItem("bilanz.theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const stats = useMemo(() => computeDayStats(store, todayKey()), [store]);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function setGoal(goal: Goal) {
    setDraft((d) => ({ ...d, goal, ...GOAL_PRESETS[goal] }));
    setDirty(true);
  }

  function save() {
    updateProfile(draft);
    setDirty(false);
  }

  function applyTheme(t: Theme) {
    setTheme(t);
    if (t === "auto") {
      localStorage.removeItem("bilanz.theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("bilanz.theme", t);
      document.documentElement.dataset.theme = t;
    }
  }

  function exportData() {
    const { auth, pending, ...data } = store;
    void auth;
    void pending;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilanz-export-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const num = (v: string, fallback: number) => {
    const x = parseFloat(v.replace(",", "."));
    return Number.isFinite(x) ? x : fallback;
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="title">Einstellungen</h1>
          <p className="subtitle">{store.email}</p>
        </div>
      </header>

      <section className="settings-section">
        <h2>Ziel</h2>
        <p className="hint">
          Die Voreinstellung setzt Rate und Proteinziel nach aktueller Studienlage – alles darunter
          lässt sich feinjustieren.
        </p>
        <div className="chip-row">
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
            <button key={g} className={`chip ${draft.goal === g ? "selected" : ""}`} onClick={() => setGoal(g)}>
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
        <div className="field-grid" style={{ marginTop: 14 }}>
          <label className="field">
            Rate (%/Woche)
            <input
              inputMode="decimal"
              value={String(draft.weeklyRatePct)}
              onChange={(e) => set("weeklyRatePct", num(e.target.value, draft.weeklyRatePct))}
            />
          </label>
          <label className="field">
            Protein (g/kg)
            <input
              inputMode="decimal"
              value={String(draft.proteinGPerKg)}
              onChange={(e) => set("proteinGPerKg", num(e.target.value, draft.proteinGPerKg))}
            />
          </label>
          <label className="field">
            Fett (g/kg)
            <input
              inputMode="decimal"
              value={String(draft.fatGPerKg)}
              onChange={(e) => set("fatGPerKg", num(e.target.value, draft.fatGPerKg))}
            />
          </label>
          <label className="field">
            Aktivitäts-Gutschrift (%)
            <input
              inputMode="numeric"
              value={String(draft.activityCreditPct)}
              onChange={(e) => set("activityCreditPct", Math.max(0, Math.min(100, Math.round(num(e.target.value, draft.activityCreditPct)))))}
            />
          </label>
          <label className="field wide">
            Kalorienziel manuell (leer = automatisch)
            <input
              inputMode="numeric"
              placeholder={`automatisch: ${stats.targets.kcal} kcal`}
              value={draft.kcalOverride == null ? "" : String(draft.kcalOverride)}
              onChange={(e) => {
                const v = e.target.value.trim();
                set("kcalOverride", v === "" ? null : Math.round(num(v, stats.targets.kcal)));
              }}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Profil</h2>
        <div className="field-grid">
          <label className="field">
            Geschlecht
            <select value={draft.sex} onChange={(e) => set("sex", e.target.value === "w" ? "w" : "m")}>
              <option value="m">männlich</option>
              <option value="w">weiblich</option>
            </select>
          </label>
          <label className="field">
            Jahrgang
            <input
              inputMode="numeric"
              value={String(draft.birthYear)}
              onChange={(e) => set("birthYear", Math.round(num(e.target.value, draft.birthYear)))}
            />
          </label>
          <label className="field">
            Größe (cm)
            <input
              inputMode="numeric"
              value={String(draft.heightCm)}
              onChange={(e) => set("heightCm", Math.round(num(e.target.value, draft.heightCm)))}
            />
          </label>
          <label className="field">
            Alltagsaktivität (PAL)
            <select
              value={String(draft.activityLevel)}
              onChange={(e) => set("activityLevel", num(e.target.value, draft.activityLevel))}
            >
              <option value="1.3">Sitzend (1,3)</option>
              <option value="1.4">Überwiegend sitzend (1,4)</option>
              <option value="1.55">Gemischt (1,55)</option>
              <option value="1.7">Körperlich aktiv (1,7)</option>
              <option value="1.9">Schwere Arbeit (1,9)</option>
            </select>
          </label>
        </div>
        <p className="hint">
          Der PAL-Wert zählt nur als Startwert. Nach ~2 Wochen Protokoll übernimmt der adaptive
          TDEE aus deinen echten Daten{stats.tdee.adaptive ? " – läuft bereits." : "."}
        </p>
        {dirty && (
          <div className="sheet-actions">
            <button className="btn primary" onClick={save}>
              Speichern
            </button>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2>Aktuelle Tagesziele</h2>
        <p className="hint">
          {stats.targets.kcal} kcal · {stats.targets.proteinG} g Protein · {stats.targets.fatG} g Fett ·{" "}
          {stats.targets.carbsG} g Kohlenhydrate · {stats.targets.fiberG} g Ballaststoffe
        </p>
      </section>

      <section className="settings-section">
        <h2>Darstellung</h2>
        <div className="segmented">
          {(
            [
              ["auto", "Auto"],
              ["light", "Hell"],
              ["dark", "Dunkel"],
            ] as [Theme, string][]
          ).map(([t, label]) => (
            <button key={t} className={theme === t ? "active" : ""} onClick={() => applyTheme(t)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <InstallSection />

      <section className="settings-section">
        <h2>Daten</h2>
        <div className="settings-row">
          <span className="settings-label">
            Export
            <small>Alle Daten als JSON herunterladen</small>
          </span>
          <button className="nav-btn today-btn" onClick={exportData}>
            Exportieren
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-label">
            Abmelden
            <small>Lokaler Offline-Cache wird geleert</small>
          </span>
          <button className="nav-btn today-btn" style={{ color: "var(--warn)" }} onClick={() => void logout()}>
            Abmelden
          </button>
        </div>
      </section>
    </div>
  );
}
