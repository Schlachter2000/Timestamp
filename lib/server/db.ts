import { neon } from "@neondatabase/serverless";

// Neon SQL-over-HTTP: pro Query ein zustandsloser HTTPS-Request –
// ideal für Serverless (kein Connection-Pooling im Function-Kontext nötig).
type Sql = ReturnType<typeof neon>;

let client: Sql | null = null;

export function db(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL ist nicht gesetzt");
    client = neon(url);
  }
  return client;
}
