"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Heute",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5c-4 4.2-6.5 7-6.5 10a6.5 6.5 0 0 0 13 0c0-3-2.5-5.8-6.5-10Z" />
        <path d="M12 17.5a3.5 3.5 0 0 0 3.5-3.5" />
      </svg>
    ),
  },
  {
    href: "/training",
    label: "Training",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a8 8 0 0 0-8 8c0 1.8.6 3.4 1.6 4.8L4.5 20l4.4-1.1A8 8 0 1 0 12 3Z" />
        <path d="M8.5 10.5h7M8.5 13.5h4.5" />
      </svg>
    ),
  },
  {
    href: "/fortschritt",
    label: "Fortschritt",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 20.5h17" />
        <path d="M4.5 16.5 9 11.5l3.5 3 6.5-8" />
        <path d="M15.5 6.5H19v3.5" />
      </svg>
    ),
  },
  {
    href: "/einstellungen",
    label: "Mehr",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </svg>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""}>
          {tab.icon}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
