"use client";

import { useEffect, useState } from "react";
import { CATEGORY_PALETTE, addCategory, logout, updateCategory, useStore } from "@/lib/store";
import { InstallSection } from "@/components/InstallSection";
import { PushSection } from "@/components/PushSection";
import type { Category } from "@/lib/types";

type Theme = "system" | "light" | "dark";

const THEME_KEY = "timestamp.theme";

function ThemeSection() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    if (next === "system") {
      window.localStorage.removeItem(THEME_KEY);
      delete document.documentElement.dataset.theme;
    } else {
      window.localStorage.setItem(THEME_KEY, next);
      document.documentElement.dataset.theme = next;
    }
  }

  return (
    <section className="settings-section">
      <h2>Darstellung</h2>
      <p className="hint">Hell, dunkel oder wie das Betriebssystem.</p>
      <div className="segmented">
        {(["system", "light", "dark"] as Theme[]).map((t) => (
          <button key={t} className={theme === t ? "active" : ""} onClick={() => apply(t)}>
            {t === "system" ? "System" : t === "light" ? "Hell" : "Dunkel"}
          </button>
        ))}
      </div>
    </section>
  );
}

function CategoryEditor({
  initial,
  onDone,
}: {
  initial?: Category;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? CATEGORY_PALETTE[0]);
  const canSave = name.trim().length > 0;

  function save() {
    if (!canSave) return;
    if (initial) {
      updateCategory(initial.id, { name: name.trim(), color });
    } else {
      addCategory(name.trim(), color);
    }
    onDone();
  }

  return (
    <div className="cat-editor">
      <input
        type="text"
        placeholder="Name der Kategorie"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      <div className="palette">
        {CATEGORY_PALETTE.map((c) => (
          <button
            key={c}
            aria-label={`Farbe ${c}`}
            className={color === c ? "selected" : ""}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="editor-actions">
        <button className="btn primary" disabled={!canSave} onClick={save}>
          {initial ? "Speichern" : "Anlegen"}
        </button>
        <button className="btn ghost" onClick={onDone}>
          Abbrechen
        </button>
        {initial && (
          <button
            className="btn ghost"
            onClick={() => {
              updateCategory(initial.id, { archived: !initial.archived });
              onDone();
            }}
          >
            {initial.archived ? "Reaktivieren" : "Archivieren"}
          </button>
        )}
      </div>
    </div>
  );
}

function CategoriesSection() {
  const store = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const sorted = [...store.categories].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position
  );

  return (
    <section className="settings-section">
      <h2>Kategorien</h2>
      <p className="hint">
        Archivierte Kategorien verschwinden aus der Schnelleingabe, alte Einträge behalten ihre Farbe.
      </p>
      <div className="cat-list">
        {sorted.map((cat) =>
          editingId === cat.id ? (
            <CategoryEditor key={cat.id} initial={cat} onDone={() => setEditingId(null)} />
          ) : (
            <div key={cat.id} className="cat-row">
              <span className="dot" style={{ background: cat.color }} />
              <span className={`name${cat.archived ? " archived" : ""}`}>{cat.name}</span>
              <button className="row-action" onClick={() => setEditingId(cat.id)}>
                Bearbeiten
              </button>
            </div>
          )
        )}
        {adding ? (
          <CategoryEditor onDone={() => setAdding(false)} />
        ) : (
          <div className="cat-row">
            <button className="row-action" onClick={() => setAdding(true)}>
              + Neue Kategorie
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function AccountSection() {
  const store = useStore();
  return (
    <section className="settings-section">
      <h2>Konto &amp; Sync</h2>
      <p className="hint">
        Angemeldet als <strong>{store.email}</strong>. Einträge und Kategorien werden auf allen
        Geräten synchronisiert.
      </p>
      <button className="btn ghost" onClick={() => void logout()}>
        Abmelden
      </button>
    </section>
  );
}

export default function EinstellungenPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="title">Einstellungen</h1>
        </div>
      </header>

      <ThemeSection />
      <CategoriesSection />

      <AccountSection />
      <InstallSection />
      <PushSection />
      <section className="settings-section placeholder">
        <h2>Google Sheets Export</h2>
        <p className="hint">Kommt in Phase 5: wählbaren Zeitraum in ein Sheet exportieren.</p>
      </section>
      <section className="settings-section placeholder">
        <h2>Mit Claude analysieren</h2>
        <p className="hint">Kommt in Phase 6: Muster und Optimierungsvorschläge zu deiner Zeitverwendung.</p>
      </section>
    </>
  );
}
