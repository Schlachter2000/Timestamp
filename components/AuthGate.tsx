"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * Rendert die App erst mit geladenem Serverstand; bei ungültiger/abgelaufener
 * Session (401 vom Server, obwohl ein Cookie da ist) geht es zum Login.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const pathname = usePathname();

  useEffect(() => {
    if (store.auth === "anon" && pathname !== "/login") {
      window.location.assign("/login");
    }
  }, [store.auth, pathname]);

  if (pathname === "/login") return <>{children}</>;
  if (store.auth !== "authed") {
    return <div className="empty-state">Lade …</div>;
  }
  return <>{children}</>;
}
