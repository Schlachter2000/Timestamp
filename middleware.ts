import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "timestamp_session";

// Schneller Redirect anhand der Cookie-Präsenz; die eigentliche Prüfung der
// Signatur passiert in den API-Routen. Ein ungültiges Cookie führt dort zu
// 401, worauf der Client-Store zum Login umleitet.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/verlauf", "/auswertung", "/einstellungen", "/login"],
};
