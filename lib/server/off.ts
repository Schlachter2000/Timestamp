// Open Food Facts: Normalisierung der Produktdaten auf unser Food-Format.
// Nährwerte je 100 g/ml aus dem "nutriments"-Block.

const USER_AGENT = "Bilanz/0.1 (persönliche Tracking-App)";

interface OffNutriments {
  [key: string]: unknown;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  quantity?: string;
  serving_quantity?: string | number;
  nutriments?: OffNutriments;
}

export interface NormalizedFood {
  barcode: string | null;
  name: string;
  brand: string | null;
  baseUnit: "g" | "ml";
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  satfatG: number;
  saltG: number;
  servingG: number | null;
  source: "off";
}

function n100(nutriments: OffNutriments | undefined, key: string): number {
  const v = nutriments?.[`${key}_100g`];
  const x = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : 0;
}

export function normalizeOffProduct(p: OffProduct): NormalizedFood | null {
  const name = (p.product_name_de || p.product_name || "").trim();
  if (!name || !p.nutriments) return null;
  const kcal = n100(p.nutriments, "energy-kcal");
  if (kcal === 0 && n100(p.nutriments, "proteins") === 0 && n100(p.nutriments, "fat") === 0) {
    return null; // ohne Nährwerte nutzlos
  }
  const quantity = (p.quantity ?? "").toLowerCase();
  const servingRaw =
    typeof p.serving_quantity === "number" ? p.serving_quantity : parseFloat(String(p.serving_quantity ?? ""));
  return {
    barcode: p.code ?? null,
    name: name.slice(0, 200),
    brand: p.brands ? p.brands.split(",")[0].trim().slice(0, 200) : null,
    baseUnit: /\d\s*(ml|cl|l)\b/.test(quantity) ? "ml" : "g",
    kcal,
    proteinG: n100(p.nutriments, "proteins"),
    carbsG: n100(p.nutriments, "carbohydrates"),
    fatG: n100(p.nutriments, "fat"),
    fiberG: n100(p.nutriments, "fiber"),
    sugarG: n100(p.nutriments, "sugars"),
    satfatG: n100(p.nutriments, "saturated-fat"),
    saltG: n100(p.nutriments, "salt"),
    servingG: Number.isFinite(servingRaw) && servingRaw > 0 ? servingRaw : null,
    source: "off",
  };
}

const OFF_FIELDS =
  "code,product_name,product_name_de,brands,quantity,serving_quantity,nutriments";

export async function offByBarcode(code: string): Promise<NormalizedFood | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`,
    { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return normalizeOffProduct({ ...data.product, code });
}

export async function offSearch(query: string): Promise<NormalizedFood[]> {
  const url =
    `https://de.openfoodfacts.org/cgi/search.pl?action=process&json=1&search_simple=1` +
    `&page_size=20&fields=${OFF_FIELDS}&search_terms=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? [])
    .map(normalizeOffProduct)
    .filter((f): f is NormalizedFood => f !== null);
}
