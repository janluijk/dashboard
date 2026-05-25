'use client';

import { useState } from 'react';

type Goal = { id: number; kind: string; targetValue: number; unit: string };

type Props = {
  goals: Goal[];
  weeklyKm: number;
  workoutHours: number;
  studyHours: number;
};

const DEFAULTS: Record<string, { label: string; unit: string; target: number }> = {
  weekly_km: { label: 'Weekly mileage', unit: 'km', target: 30 },
  weekly_workout_hours: { label: 'Workout time', unit: 'h', target: 5 },
  weekly_study_hours: { label: 'Study time', unit: 'h', target: 15 },
};

export function GoalsPanel({ goals, weeklyKm, workoutHours, studyHours }: Props) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const kind of Object.keys(DEFAULTS)) {
      const match = goals.find((g) => g.kind === kind);
      out[kind] = match?.targetValue ?? DEFAULTS[kind].target;
    }
    return out;
  });
  const [saving, setSaving] = useState(false);

  const currents: Record<string, number> = {
    weekly_km: weeklyKm,
    weekly_workout_hours: workoutHours,
    weekly_study_hours: studyHours,
  };

  async function save() {
    setSaving(true);
    for (const kind of Object.keys(local)) {
      await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, targetValue: local[kind], unit: DEFAULTS[kind].unit }),
      });
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Weekly goals</p>
        <button
          onClick={() => (editing ? save() : setEditing(true))}
          disabled={saving}
          className="text-xs text-[var(--muted)] hover:text-white"
        >
          {editing ? (saving ? 'Saving…' : 'Save') : 'Edit'}
        </button>
      </div>
      <div className="space-y-4">
        {Object.entries(DEFAULTS).map(([kind, def]) => {
          const target = local[kind];
          const current = currents[kind];
          const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
          return (
            <div key={kind}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{def.label}</span>
                <span className="text-[var(--muted)]">
                  {current.toFixed(1)} /{' '}
                  {editing ? (
                    <input
                      type="number"
                      value={target}
                      onChange={(e) =>
                        setLocal((cur) => ({ ...cur, [kind]: Number(e.target.value) }))
                      }
                      className="w-16 bg-transparent border border-[var(--card-border)] rounded px-1 text-right"
                    />
                  ) : (
                    target
                  )}{' '}
                  {def.unit}
                </span>
              </div>
              <div className="h-2 bg-[var(--card-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
