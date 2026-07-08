import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "timestamp_session";
const SESSION_TTL_S = 60 * 60 * 24 * 365; // 1 Jahr – persönliche App, lange Session

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ist nicht gesetzt");
  return s;
}

// ---------------------------------------------------------------------------
// Passwort-Hashing: scrypt aus node:crypto, keine native Zusatz-Dependency.
// Format: scrypt:N:r:p:salt_hex:key_hex
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 32 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT.keyLen, SCRYPT);
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltHex, keyHex] = parts;
  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// Session-Token: base64url(JSON{uid,exp}) + "." + HMAC-SHA256-Signatur.
// Zustandslos, im httpOnly-Cookie – kein Session-Store nötig.
// ---------------------------------------------------------------------------

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const givenSig = token.slice(dot + 1);
  const expectedSig = sign(payload);
  const a = Buffer.from(givenSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now() / 1000) return null;
    return data.uid;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie-Helfer für Route-Handler
// ---------------------------------------------------------------------------

export async function setSessionCookie(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** User-ID der aktuellen Session oder null. */
export async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
