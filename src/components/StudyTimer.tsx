'use client';

import { useEffect, useRef, useState } from 'react';

function format(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function StudyTimer() {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running || !startedAt) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, startedAt]);

  function start() {
    setStartedAt(Date.now());
    setElapsed(0);
    setRunning(true);
  }

  async function stop() {
    setRunning(false);
    const endedAt = Date.now();
    const start = startedAt ?? endedAt;
    const duration = Math.floor((endedAt - start) / 1000);
    const shouldSave = duration >= 10;
    if (!shouldSave) {
      setStartedAt(null);
      setElapsed(0);
      return;
    }
    setSaving(true);
    await fetch('/api/study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        label: label || null,
        manual: false,
      }),
    });
    setSaving(false);
    setStartedAt(null);
    setElapsed(0);
    setLabel('');
    window.location.reload();
  }

  async function saveManual() {
    const minutes = Number(manualMinutes);
    const isValid = Number.isFinite(minutes) && minutes > 0;
    if (!isValid) return;
    setSaving(true);
    const endedAt = new Date();
    const startedAtDate = new Date(endedAt.getTime() - minutes * 60 * 1000);
    await fetch('/api/study', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startedAt: startedAtDate.toISOString(),
        endedAt: endedAt.toISOString(),
        label: label || null,
        manual: true,
      }),
    });
    setSaving(false);
    setManualMinutes('');
    setLabel('');
    setShowManual(false);
    window.location.reload();
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Study timer</p>
      <div className="text-4xl font-mono tabular-nums tracking-tight mb-3">{format(elapsed)}</div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="What are you working on?"
        className="w-full bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-[var(--accent)]"
      />
      <div className="flex gap-2">
        {!running ? (
          <button
            onClick={start}
            className="flex-1 rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium"
          >
            Start
          </button>
        ) : (
          <button
            onClick={stop}
            disabled={saving}
            className="flex-1 rounded-lg bg-red-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Stop & save'}
          </button>
        )}
        <button
          onClick={() => setShowManual((v) => !v)}
          className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          + manual
        </button>
      </div>
      {showManual ? (
        <div className="mt-3 flex gap-2">
          <input
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            placeholder="Minutes"
            type="number"
            className="flex-1 bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={saveManual}
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}
