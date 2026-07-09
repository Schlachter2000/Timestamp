"use client";

// Gewichtsverlauf als SVG: Messpunkte (Rohwerte) + geglättete Trendlinie.

import type { TrendPoint } from "@/lib/science";
import { diffDays } from "@/lib/dates";

export function WeightChart({ trend, days = 90 }: { trend: TrendPoint[]; days?: number }) {
  if (trend.length < 2) {
    return <p className="hint">Ab zwei Messungen erscheint hier dein Verlauf.</p>;
  }

  const last = trend[trend.length - 1];
  const points = trend.filter((p) => diffDays(p.day, last.day) <= days);
  const first = points[0];
  const span = Math.max(1, diffDays(first.day, last.day));

  const values = points.flatMap((p) => [p.weightKg, p.trendKg]);
  const min = Math.min(...values) - 0.4;
  const max = Math.max(...values) + 0.4;

  const W = 600;
  const H = 220;
  const PAD_L = 42;
  const PAD_R = 10;
  const PAD_T = 12;
  const PAD_B = 24;

  const x = (day: string) => PAD_L + (diffDays(first.day, day) / span) * (W - PAD_L - PAD_R);
  const y = (kg: number) => PAD_T + (1 - (kg - min) / (max - min)) * (H - PAD_T - PAD_B);

  const trendPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.trendKg).toFixed(1)}`).join(" ");

  // 3–4 horizontale Rasterlinien auf halbe Kilo gerundet
  const gridLines: number[] = [];
  const step = Math.max(0.5, Math.round(((max - min) / 3) * 2) / 2);
  for (let v = Math.ceil(min * 2) / 2; v <= max; v += step) gridLines.push(v);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gewichtsverlauf">
        {gridLines.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {points.map((p) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.weightKg)} r="3" fill="var(--line-strong)" />
        ))}
        <path d={trendPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        <text x={PAD_L} y={H - 8} fontSize="10" fill="var(--muted)">
          {first.day}
        </text>
        <text x={W - PAD_R} y={H - 8} fontSize="10" fill="var(--muted)" textAnchor="end">
          {last.day}
        </text>
      </svg>
      <div className="chart-legend">
        <span>
          <span className="dot" style={{ background: "var(--line-strong)" }} />
          Messung
        </span>
        <span>
          <span className="dot" style={{ background: "var(--accent)" }} />
          Trend (geglättet)
        </span>
      </div>
    </div>
  );
}
