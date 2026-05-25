'use client';

import { useMemo } from 'react';

type Activity = { startDate: string; movingTimeS: number };
type StudySession = { startedAt: string; durationS: number };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Heatmap({
  activities,
  studySessions,
}: {
  activities: Activity[];
  studySessions: StudySession[];
}) {
  const { weeks, max } = useMemo(() => {
    const days = 12 * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const dayOfWeek = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayOfWeek);

    const totals = new Map<string, number>();
    for (const a of activities) {
      const k = ymd(new Date(a.startDate));
      totals.set(k, (totals.get(k) ?? 0) + a.movingTimeS);
    }
    for (const s of studySessions) {
      const k = ymd(new Date(s.startedAt));
      totals.set(k, (totals.get(k) ?? 0) + s.durationS);
    }

    let max = 0;
    for (const v of totals.values()) if (v > max) max = v;

    const cells: { date: string; value: number; isFuture: boolean }[] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const k = ymd(cur);
      cells.push({ date: k, value: totals.get(k) ?? 0, isFuture: false });
      cur.setDate(cur.getDate() + 1);
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: '', value: 0, isFuture: true });
    }

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return { weeks, max };
  }, [activities, studySessions]);

  function color(value: number, isFuture: boolean): string {
    if (isFuture) return 'transparent';
    if (value === 0) return '#1c2030';
    const ratio = max > 0 ? value / max : 0;
    if (ratio < 0.25) return '#3a1a05';
    if (ratio < 0.5) return '#7a3308';
    if (ratio < 0.75) return '#c44509';
    return '#fc5200';
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
        Activity (12 weeks)
      </p>
      <div className="flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) => (
              <div
                key={di}
                title={cell.date ? `${cell.date}: ${Math.round(cell.value / 60)} min` : ''}
                className="w-3 h-3 rounded-[2px]"
                style={{ background: color(cell.value, cell.isFuture) }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)] mt-3">Workouts + study time combined.</p>
    </div>
  );
}
