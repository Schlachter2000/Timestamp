"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  // null = Status wird noch geladen
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => setHasUser(Boolean(data.hasUser)))
      .catch(() => setHasUser(true));
  }, []);

  const registering = hasUser === false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.assign("/");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Anmeldung fehlgeschlagen.");
    } catch {
      setError("Keine Verbindung zum Server.");
    }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <p className="login-kicker mono">TIMESTAMP</p>
        <h1>{registering ? "Konto anlegen" : "Anmelden"}</h1>
        <p className="login-hint">
          {registering
            ? "Erster Start: Lege dein Konto an – damit sind deine Slots auf allen Geräten synchron."
            : "Melde dich an, um deine Slots auf allen Geräten zu sehen."}
        </p>
        <label>
          E-Mail
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Passwort
          <input
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            required
            minLength={registering ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {registering && <p className="login-hint">Mindestens 8 Zeichen.</p>}
        {error && <p className="login-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy || hasUser === null}>
          {busy ? "Einen Moment …" : registering ? "Konto anlegen" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
