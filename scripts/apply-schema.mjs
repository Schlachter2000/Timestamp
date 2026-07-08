// Spielt db/schema.sql in die Datenbank aus DATABASE_URL ein.
// Aufruf: npm run db:schema
// Der Neon-HTTP-Driver kann nur Einzel-Statements, daher wird die Datei
// an den Semikolons am Statement-Ende aufgeteilt.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ist nicht gesetzt (in .env.local eintragen und z. B. mit `node --env-file=.env.local` starten).");
  process.exit(1);
}

const sql = neon(url);
const file = readFileSync(resolve(import.meta.dirname, "../db/schema.sql"), "utf8");

// Erst Kommentare entfernen, dann an Statement-Enden splitten.
// (Kein '--' und kein ';' innerhalb von String-Literalen im Schema.)
const statements = file
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const statement of statements) {
  const label = statement.replace(/\s+/g, " ").slice(0, 72);
  await sql.query(statement);
  console.log("ok:", label);
}
console.log(`Fertig – ${statements.length} Statements ausgeführt.`);
