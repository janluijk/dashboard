'use client';

import { useEffect, useState } from 'react';

type Goal = { id: number; kind: string; targetValue: number; unit: string };

export type WeekMetric = {
  kind: string;
  label: string;
  // Headline shown inside the ring (e.g. "12.4" or "1h 20m").
  centerValue: string;
  centerUnit?: string;
  // Numeric current + unit, used for the ring fill and the target line.
  current: number;
  unit: string;
  sub: string;
  defaultTarget: number;
};

function Ring({ pct, value, unit }: { pct: number; value: string; unit?: string }) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // Animate from empty to filled once, on mount.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const offset = circ * (1 - Math.min(1, Math.max(0, shown / 100)));
  const complete = pct >= 100;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          opacity={complete ? 1 : 0.95}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono tabular-nums text-lg leading-none tracking-tight">{value}</span>
        {unit ? <span className="text-[10px] text-[var(--muted)] mt-0.5">{unit}</span> : null}
      </div>
    </div>
  );
}

export function WeekProgress({ goals, metrics }: { goals: Goal[]; metrics: WeekMetric[] }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targets, setTargets] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const m of metrics) {
      out[m.kind] = goals.find((g) => g.kind === m.kind)?.targetValue ?? m.defaultTarget;
    }
    return out;
  });

  async function save() {
    setSaving(true);
    for (const m of metrics) {
      await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: m.kind, targetValue: targets[m.kind], unit: m.unit }),
      });
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">This week</p>
        <button
          onClick={() => (editing ? save() : setEditing(true))}
          disabled={saving}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-60"
        >
          {editing ? (saving ? 'Saving…' : 'Save goals') : 'Edit goals'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const target = targets[m.kind];
          const pct = target > 0 ? (m.current / target) * 100 : 0;
          const hit = pct >= 100;
          return (
            <div
              key={m.kind}
              className="flex items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5"
            >
              <Ring pct={pct} value={m.centerValue} unit={m.centerUnit} />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{m.label}</p>
                <p className="mt-1 text-sm">
                  <span className={hit ? 'text-[var(--accent)] font-medium' : 'text-[var(--foreground)]'}>
                    {m.current.toFixed(1)}
                  </span>
                  <span className="text-[var(--muted)]"> / </span>
                  {editing ? (
                    <input
                      type="number"
                      step="0.5"
                      value={target}
                      onChange={(e) =>
                        setTargets((cur) => ({ ...cur, [m.kind]: Number(e.target.value) }))
                      }
                      className="w-14 bg-transparent border border-[var(--card-border)] rounded px-1 text-right tabular-nums outline-none focus:border-[var(--accent)]"
                    />
                  ) : (
                    <span className="text-[var(--muted)] tabular-nums">{target}</span>
                  )}
                  <span className="text-[var(--muted)]"> {m.unit}</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{m.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
