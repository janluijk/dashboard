'use client';

import { useMemo } from 'react';
import { startOfWeek } from '@/lib/week';

type Activity = {
  type: string;
  distanceM: number;
  startDate: string;
};

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

type Props = {
  activities: Activity[];
  weeks?: number;
  weeklyGoalKm?: number;
};

export function WeeklyMileageChart({ activities, weeks = 12, weeklyGoalKm }: Props) {
  const data = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const buckets: { weekStart: Date; km: number; isCurrent: boolean }[] = [];
    for (let i = weeks - 1; i >= 0; i -= 1) {
      const ws = new Date(thisWeekStart);
      ws.setDate(ws.getDate() - i * 7);
      buckets.push({ weekStart: ws, km: 0, isCurrent: i === 0 });
    }
    const earliest = buckets[0].weekStart.getTime();
    for (const a of activities) {
      const isRun = RUN_TYPES.has(a.type);
      if (!isRun) continue;
      const t = new Date(a.startDate).getTime();
      const isInRange = t >= earliest;
      if (!isInRange) continue;
      const idx = Math.floor((t - earliest) / (7 * 24 * 60 * 60 * 1000));
      const inBounds = idx >= 0 && idx < buckets.length;
      if (!inBounds) continue;
      buckets[idx].km += a.distanceM / 1000;
    }
    return buckets;
  }, [activities, weeks]);

  const maxKm = Math.max(weeklyGoalKm ?? 0, ...data.map((d) => d.km), 1);
  const niceMax = Math.ceil(maxKm / 10) * 10 || 10;

  const width = 600;
  const height = 200;
  const padL = 32;
  const padR = 12;
  const padT = 12;
  const padB = 8;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (niceMax * i) / yTicks);

  function monthLabel(d: Date): string {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Average only the completed weeks — the current week is still partway
  // through, so including it would always pull the figure down.
  const completed = data.filter((d) => !d.isCurrent);
  const avg = completed.reduce((s, d) => s + d.km, 0) / (completed.length || 1);

  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - (d.km / niceMax) * innerH;
    return { x, y, d };
  });

  function smoothPath(cmd: 'L' | 'C'): string {
    if (points.length === 0) return '';
    if (cmd === 'L' || points.length < 3) {
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }
    const tension = 0.5;
    const out: string[] = [`M ${points[0].x} ${points[0].y}`];
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;
      out.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
    }
    return out.join(' ');
  }

  const linePath = smoothPath('C');
  const baselineY = padT + innerH;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Weekly mileage</p>
        <p className="text-xs text-[var(--muted)]">
          {completed.length}-week avg <span className="text-white font-medium">{avg.toFixed(1)} km</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img">
        {ticks.map((t, i) => {
          const y = padT + innerH - (t / niceMax) * innerH;
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--card-border)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted)"
              >
                {Math.round(t)}
              </text>
            </g>
          );
        })}
        {weeklyGoalKm && weeklyGoalKm > 0 ? (
          <line
            x1={padL}
            x2={width - padR}
            y1={padT + innerH - (weeklyGoalKm / niceMax) * innerH}
            y2={padT + innerH - (weeklyGoalKm / niceMax) * innerH}
            stroke="#9ca3af"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
        <defs>
          <linearGradient id="mileageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#mileageFill)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.d.isCurrent ? 4 : 2.5}
            fill={p.d.isCurrent ? 'var(--accent)' : 'var(--background)'}
            stroke="var(--accent)"
            strokeWidth={1.5}
          >
            <title>{`${monthLabel(p.d.weekStart)}: ${p.d.km.toFixed(1)} km`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
