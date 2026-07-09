import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { TabBar } from "@/components/TabBar";
import { AuthGate } from "@/components/AuthGate";
import { PwaSetup } from "@/components/PwaSetup";
import "./globals.css";

const archivo = localFont({
  src: "../public/fonts/archivo-var.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-sans",
});

const plexMono = localFont({
  src: [
    { path: "../public/fonts/plex-mono-400.woff2", weight: "400" },
    { path: "../public/fonts/plex-mono-600.woff2", weight: "600" },
  ],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Bilanz",
  description: "Ernährung, Training und Gewicht – mit adaptivem TDEE und Coach",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bilanz",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#151714" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Setzt das gespeicherte Theme vor dem ersten Paint, um Flackern zu vermeiden.
const themeInit = `try{var t=localStorage.getItem("bilanz.theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <PwaSetup />
        <TabBar />
        <main className="app-main">
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}
