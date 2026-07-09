// Rendert das App-Icon (SVG) in die PNG-Größen für Manifest und iOS.
// Aufruf: node scripts/make-icons.mjs  (nutzt das lokal installierte Playwright-Chromium)
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const svg = readFileSync(resolve(import.meta.dirname, "../app/icon.svg"), "utf8");

// Maskable-Variante: Motiv verkleinert auf sicherer Fläche, volle Hintergrundfarbe.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1C6B4F"/>
  <g transform="translate(8,8) scale(0.75)">
    <circle cx="32" cy="32" r="17" fill="none" stroke="#F7F6F1" stroke-opacity="0.28" stroke-width="7"/>
    <path d="M32 15 a17 17 0 1 1 -14.7 8.5" fill="none" stroke="#F7F6F1" stroke-width="7" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="4.5" fill="#F7F6F1"/>
  </g>
</svg>`;

const targets = [
  { file: "icon-192.png", size: 192, svg },
  { file: "icon-512.png", size: 512, svg },
  { file: "apple-touch-icon.png", size: 180, svg },
  { file: "maskable-512.png", size: 512, svg: maskable },
];

// In der Remote-Umgebung liegt Chromium unter /opt/pw-browsers/chromium;
// lokal reicht das per `npx playwright install chromium` geladene Binary.
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: "/opt/pw-browsers/chromium" } : {}
);
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<style>*{margin:0}</style><div style="width:${t.size}px;height:${t.size}px">${t.svg.replace(
      "<svg ",
      `<svg width="${t.size}" height="${t.size}" `
    )}</div>`
  );
  const buf = await page.screenshot({ omitBackground: true });
  writeFileSync(resolve(import.meta.dirname, "../public/icons", t.file), buf);
  console.log("ok:", t.file);
}
await browser.close();
