"use client";

// Coach: Chat mit Claude. Der Server reichert jede Anfrage mit den aktuellen
// Tracking-Daten an (TDEE, offene Makros, Historie, Lieblingsessen), sodass
// Antworten und Gerichtsvorschläge auf der echten Bilanz basieren.

import { useEffect, useRef, useState } from "react";
import { appendChat, clearChat, newId, replaceLastAssistant, useStore } from "@/lib/store";

export default function CoachPage() {
  const store = useStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [store.chat, busy]);

  async function send(message: string, action?: "suggest") {
    if (busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    const now = new Date().toISOString();
    appendChat([
      { id: newId(), role: "user", content: message, createdAt: now },
      { id: newId(), role: "assistant", content: "…", createdAt: now },
    ]);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action ? { id: newId(), action } : { id: newId(), message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Der Coach ist gerade nicht erreichbar.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        replaceLastAssistant(text);
      }
      if (text.trim() === "") replaceLastAssistant("(keine Antwort)");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Der Coach ist gerade nicht erreichbar.";
      replaceLastAssistant(`⚠️ ${msg}`);
      setError(msg);
    }
    setBusy(false);
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <h1 className="title">Coach</h1>
          <p className="subtitle">kennt deine Bilanz, dein Training und deinen Trend</p>
        </div>
        {store.chat.length > 0 && (
          <div className="nav-buttons">
            <button
              className="nav-btn today-btn"
              onClick={() => {
                if (window.confirm("Chatverlauf löschen?")) clearChat();
              }}
            >
              Leeren
            </button>
          </div>
        )}
      </header>

      <div className="suggest-row">
        <button
          disabled={busy}
          onClick={() => void send("Schlag mir bitte 3 Gerichte vor, die zu meiner restlichen Tagesbilanz passen.", "suggest")}
        >
          🍽 3 Gerichtsvorschläge
        </button>
        <button disabled={busy} onClick={() => void send("Wie läuft meine Woche? Gib mir einen ehrlichen Wochen-Check mit konkreten Zahlen und 2–3 Empfehlungen.")}>
          📊 Wochen-Check
        </button>
        <button disabled={busy} onClick={() => void send("Was sollte ich heute noch essen, um mein Proteinziel zu erreichen?")}>
          🥚 Protein-Lücke
        </button>
      </div>

      <div className="chat-wrap">
        {store.chat.length === 0 && (
          <div className="empty-state">
            Frag mich etwas – zu deiner Ernährung, deinem Training oder was du heute noch essen
            solltest. Ich sehe deine aktuellen Zahlen.
          </div>
        )}
        {store.chat.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {error && <p className="login-error">{error}</p>}
        <div ref={bottomRef} style={{ height: 130 }} />
      </div>

      <div className="chat-input-bar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const msg = input.trim();
            if (msg) void send(msg);
          }}
        >
          <textarea
            rows={1}
            placeholder="Nachricht an deinen Coach …"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const msg = input.trim();
                if (msg && !busy) void send(msg);
              }
            }}
          />
          <button type="submit" disabled={busy || input.trim() === ""} aria-label="Senden">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
