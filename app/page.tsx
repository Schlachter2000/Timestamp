"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayTimeline } from "@/components/DayTimeline";
import { EntrySheet } from "@/components/EntrySheet";
import { activeCategories, useStore } from "@/lib/store";
import {
  SLOTS_PER_DAY,
  addDays,
  formatDayLong,
  slotOfDate,
  todayKey,
} from "@/lib/slots";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function TodayView() {
  const router = useRouter();
  const params = useSearchParams();
  const store = useStore();

  const paramDay = params.get("tag");
  const day = paramDay && DAY_KEY_RE.test(paramDay) ? paramDay : todayKey();

  // Uhrzeit erst nach dem Mount setzen (SSR kennt die lokale Zeit nicht),
  // danach im Halbminutentakt aktualisieren für die Jetzt-Linie.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const isToday = now ? day === todayKey() : false;
  const dayEntries = store.entries[day] ?? {};
  const filled = Object.keys(dayEntries).length;

  const [sheetSlot, setSheetSlot] = useState<number | null>(null);

  function goTo(target: string) {
    router.push(target === todayKey() ? "/" : `/?tag=${target}`);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="title">{formatDayLong(day)}</h1>
          <p className="subtitle mono">
            {filled} / {SLOTS_PER_DAY} Slots erfasst
          </p>
        </div>
        <div className="nav-buttons">
          {!isToday && now && (
            <button className="nav-btn today-btn" onClick={() => goTo(todayKey())}>
              Heute
            </button>
          )}
          <button className="nav-btn" aria-label="Vorheriger Tag" onClick={() => goTo(addDays(day, -1))}>
            ‹
          </button>
          <button className="nav-btn" aria-label="Nächster Tag" onClick={() => goTo(addDays(day, 1))}>
            ›
          </button>
        </div>
      </header>

      <DayTimeline
        entries={dayEntries}
        categories={store.categories}
        now={isToday ? now : null}
        onSlotClick={setSheetSlot}
      />

      {isToday && now && (
        <div className="quickbar">
          <button onClick={() => setSheetSlot(slotOfDate(now))}>
            Was machst du gerade?
            <span className="plus">+</span>
          </button>
        </div>
      )}

      {sheetSlot !== null && (
        <EntrySheet
          day={day}
          slot={sheetSlot}
          entry={dayEntries[sheetSlot]}
          categories={activeCategories(store)}
          onClose={() => setSheetSlot(null)}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TodayView />
    </Suspense>
  );
}
