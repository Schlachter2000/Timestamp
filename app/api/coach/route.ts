import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/server/db";
import { sessionUserId } from "@/lib/server/auth";
import { str, uuid } from "@/lib/server/validate";
import { DEFAULT_PROFILE, MEAL_LABELS, type DiaryEntry, type Meal, type Profile } from "@/lib/types";
import {
  adaptiveTdee,
  dailyTargets,
  mealProteinThreshold,
  qualityScore,
  sumNutrients,
  trendWeights,
  weeklyTrendRate,
} from "@/lib/science";

// Streaming-Antworten können bei ausführlichen Vorschlägen etwas dauern.
export const maxDuration = 120;

const SYSTEM_PROMPT = `Du bist der Ernährungs- und Trainingscoach in der App "Bilanz" – promovierter Sportwissenschaftler mit Schwerpunkt Ernährungsphysiologie und Körperkomposition. Dein Klient trackt Ernährung, Training, Aktivität und Gewicht in der App; seine aktuellen Daten bekommst du unten mitgeliefert.

Arbeitsweise:
- Antworte auf Deutsch, per Du, warm aber präzise. Kurze Fragen bekommen kurze Antworten.
- Stütze dich auf die mitgelieferten Daten: nenne konkrete Zahlen (offene Kalorien, Protein-Lücke, Trend), statt allgemein zu bleiben.
- Wissenschaftlich fundiert, aber ohne Dogma: Energiebilanz und Proteinzufuhr sind die Hebel, alles andere ist Feintuning. Keine Wunderdiäten, keine Supplement-Verkaufe.
- Bei Gerichtsvorschlägen: schlage 3 konkrete Gerichte vor, die zur verbleibenden Tagesbilanz passen (v. a. Protein-Lücke schließen, Kalorienrahmen halten). Gib je Gericht eine kurze Zutatenliste mit Mengen und die ungefähren Nährwerte (kcal, Protein). Berücksichtige, was der Klient häufig isst und mag – schlage Vertrautes in Varianten vor, plus eine neue Idee.
- Achte auf Warnsignale: sehr niedrige Zufuhr, stark negative Trends, zu wenig Protein, viele Tage ohne Protokoll. Sprich sie kurz an, ohne zu moralisieren.
- Du bist kein Arzt: bei medizinischen Themen (Essstörungen, Diabetes, Medikamente) empfiehl professionelle Abklärung.`;

interface DbDiaryRow extends DiaryEntry {
  meal: Meal;
}

async function buildContext(userId: string): Promise<string> {
  const sql = db();
  const [profiles, diary, weights, workouts, steps, topFoods] = await Promise.all([
    sql`
      select sex, birth_year as "birthYear", height_cm as "heightCm",
             activity_level as "activityLevel", goal, weekly_rate_pct as "weeklyRatePct",
             protein_g_per_kg as "proteinGPerKg", fat_g_per_kg as "fatGPerKg",
             activity_credit_pct as "activityCreditPct", kcal_override as "kcalOverride"
      from profiles where user_id = ${userId}
    `,
    sql`
      select id, to_char(day, 'YYYY-MM-DD') as day, meal, food_id as "foodId", name,
             qty_g as "qtyG", kcal, protein_g as "proteinG", carbs_g as "carbsG",
             fat_g as "fatG", fiber_g as "fiberG", sugar_g as "sugarG", satfat_g as "satfatG"
      from diary_entries where user_id = ${userId} and day > current_date - 35
      order by day, created_at
    `,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, weight_kg as "weightKg"
      from weights where user_id = ${userId} and day > current_date - 120 order by day
    `,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, kind, title, duration_min as "durationMin", rpe, kcal
      from workouts where user_id = ${userId} and day > current_date - 14 order by day
    `,
    sql`
      select to_char(day, 'YYYY-MM-DD') as day, steps
      from daily_steps where user_id = ${userId} and day > current_date - 14 order by day
    `,
    sql`
      select name, count(*)::int as times
      from diary_entries where user_id = ${userId} and day > current_date - 60
      group by name order by times desc limit 15
    `,
  ]);

  const profile = ((profiles as Profile[])[0] ?? DEFAULT_PROFILE) as Profile;
  const entries = diary as DbDiaryRow[];
  const trend = trendWeights(weights as { day: string; weightKg: number }[]);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  const tdee = adaptiveTdee(profile, entries, trend, today);
  const latestTrendKg = trend.length > 0 ? trend[trend.length - 1].trendKg : 75;
  const targets = dailyTargets(profile, latestTrendKg, tdee.tdee);
  const rate = weeklyTrendRate(trend);

  const todayEntries = entries.filter((e) => e.day === today);
  const todaySum = sumNutrients(todayEntries);
  const score = qualityScore(todaySum, targets);

  const byMeal = todayEntries
    .map((e) => `  - ${MEAL_LABELS[e.meal]}: ${e.name} (${Math.round(e.qtyG)} g, ${Math.round(e.kcal)} kcal, ${Math.round(e.proteinG)} g Protein)`)
    .join("\n");

  // Wochenmittel der letzten 7 vollständigen Tage
  const last7 = new Map<string, { kcal: number; proteinG: number }>();
  for (const e of entries) {
    if (e.day >= today) continue;
    const d = last7.get(e.day) ?? { kcal: 0, proteinG: 0 };
    d.kcal += e.kcal;
    d.proteinG += e.proteinG;
    last7.set(e.day, d);
  }
  const recent = [...last7.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
  const avgKcal = recent.length > 0 ? Math.round(recent.reduce((s, [, d]) => s + d.kcal, 0) / recent.length) : null;
  const avgProtein = recent.length > 0 ? Math.round(recent.reduce((s, [, d]) => s + d.proteinG, 0) / recent.length) : null;

  const workoutLines = (workouts as { day: string; kind: string; title: string | null; durationMin: number; rpe: number | null; kcal: number }[])
    .map((w) => `  - ${w.day}: ${w.title ?? w.kind} (${w.durationMin} min${w.rpe ? `, RPE ${w.rpe}` : ""}, ~${Math.round(w.kcal)} kcal)`)
    .join("\n");

  const stepsLines = (steps as { day: string; steps: number }[])
    .slice(-7)
    .map((s) => `${s.day}: ${s.steps}`)
    .join(", ");

  const favLines = (topFoods as { name: string; times: number }[])
    .map((f) => `${f.name} (${f.times}×)`)
    .join(", ");

  return `AKTUELLE DATEN DES KLIENTEN (Stand ${today}):

Profil: ${profile.sex === "m" ? "männlich" : "weiblich"}, Jahrgang ${profile.birthYear}, ${profile.heightCm} cm, Ziel: ${profile.goal} (${profile.weeklyRatePct} %/Woche), Proteinziel ${profile.proteinGPerKg} g/kg.
Gewicht: aktuell ${trend.length > 0 ? `${trend[trend.length - 1].weightKg} kg (Trend ${latestTrendKg} kg)` : "keine Messungen"}${rate !== null ? `, Trend ${rate > 0 ? "+" : ""}${rate} kg/Woche` : ""}.
TDEE: ${tdee.tdee} kcal (${tdee.adaptive ? `adaptiv aus ${tdee.daysUsed} Protokolltagen` : "Formel-Startwert, noch zu wenig Daten"}).
Tagesziele: ${targets.kcal} kcal, ${targets.proteinG} g Protein, ${targets.fatG} g Fett, ${targets.carbsG} g Kohlenhydrate, ${targets.fiberG} g Ballaststoffe. Protein-Schwelle pro Mahlzeit: ~${mealProteinThreshold(latestTrendKg)} g.

HEUTE bisher: ${Math.round(todaySum.kcal)} kcal, ${Math.round(todaySum.proteinG)} g Protein, ${Math.round(todaySum.carbsG)} g KH, ${Math.round(todaySum.fatG)} g Fett, ${Math.round(todaySum.fiberG)} g Ballaststoffe. Qualitäts-Score ${score.total}/100.
Offen: ${Math.round(targets.kcal - todaySum.kcal)} kcal, ${Math.round(targets.proteinG - todaySum.proteinG)} g Protein.
${byMeal ? `Einträge heute:\n${byMeal}` : "Noch keine Einträge heute."}

Ø letzte ${recent.length} Protokolltage: ${avgKcal ?? "–"} kcal, ${avgProtein ?? "–"} g Protein.
Training (14 Tage):
${workoutLines || "  keine Einheiten erfasst"}
Schritte (7 Tage): ${stepsLines || "keine Daten"}
Häufige Lebensmittel (60 Tage): ${favLines || "noch keine"}`;
}

export async function POST(request: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ist nicht konfiguriert – der Coach braucht den Key (Einstellungen der Vercel-Umgebung)." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const messageId = uuid(body.id) ?? crypto.randomUUID();
  const message =
    body.action === "suggest"
      ? "Schlag mir bitte 3 Gerichte vor, die jetzt zu meiner restlichen Tagesbilanz passen."
      : str(body.message, 4000);
  if (!message) return NextResponse.json({ error: "Leere Nachricht." }, { status: 400 });

  const sql = db();
  const [context, historyRows] = await Promise.all([
    buildContext(userId),
    sql`
      select role, content from chat_messages
      where user_id = ${userId}
      order by created_at desc limit 20
    `,
  ]);

  // Nutzernachricht sofort persistieren (idempotent bei Outbox-Replay).
  await sql`
    insert into chat_messages (id, user_id, role, content)
    values (${messageId}, ${userId}, 'user', ${message})
    on conflict (id) do nothing
  `;

  const history = (historyRows as { role: "user" | "assistant"; content: string }[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 3000,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: context },
    ],
    messages: [...history, { role: "user" as const, content: message }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      let full = "";
      stream.on("text", (delta) => {
        full += delta;
        controller.enqueue(encoder.encode(delta));
      });
      stream.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n\n[Fehler: ${err instanceof Error ? err.message : "Coach nicht erreichbar"}]`));
        controller.close();
      });
      stream.on("end", () => {
        void (async () => {
          try {
            const final = await stream.finalMessage();
            if (final.stop_reason === "refusal" || full.trim() === "") {
              full = full.trim() || "Dazu kann ich nichts sagen – frag mich gern etwas zu Ernährung, Training oder deinen Daten.";
              controller.enqueue(encoder.encode(full));
            }
            await sql`
              insert into chat_messages (id, user_id, role, content)
              values (${crypto.randomUUID()}, ${userId}, 'assistant', ${full})
            `;
          } catch {
            // Antwort konnte nicht gespeichert werden – Client hat sie trotzdem erhalten.
          }
          controller.close();
        })();
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Chatverlauf löschen. */
export async function DELETE() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  await db()`delete from chat_messages where user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
