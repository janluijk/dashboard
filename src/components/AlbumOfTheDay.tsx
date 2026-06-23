'use client';

import { useMemo, useState } from 'react';

type Album = {
  id: number;
  artist: string;
  title: string;
  position: number;
  listenedOn: string | null;
  rating: number | null;
  note: string | null;
};

// Local YYYY-MM-DD (respects the user's timezone, unlike toISOString).
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function StarRating({
  value,
  onChange,
  size = 'sm',
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  size?: 'sm' | 'lg';
}) {
  const cls = size === 'lg' ? 'text-2xl' : 'text-base';
  return (
    <div className={`flex items-center gap-0.5 ${cls}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (value ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onChange(value === n ? null : n)}
            className={`leading-none transition ${
              filled ? 'text-[var(--accent)]' : 'text-[var(--card-border)] hover:text-[var(--muted)]'
            }`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export function AlbumOfTheDay({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const queue = useMemo(
    () => albums.filter((a) => !a.listenedOn).sort((x, y) => x.position - y.position),
    [albums],
  );
  const history = useMemo(
    () =>
      albums
        .filter((a) => a.listenedOn)
        .sort((x, y) => (y.listenedOn! < x.listenedOn! ? -1 : 1))
        .slice(0, 7),
    [albums],
  );

  const today = queue[0] ?? null;
  const upNext = queue.slice(1, 6);

  function patchLocal(id: number, fields: Partial<Album>) {
    setAlbums((cur) => cur.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  }

  async function patch(id: number, fields: Partial<Album>) {
    patchLocal(id, fields);
    await fetch(`/api/albums/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  }

  async function add() {
    const a = artist.trim();
    const t = title.trim();
    const isValid = a.length > 0 && t.length > 0;
    if (!isValid) return;
    setBusy(true);
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist: a, title: t }),
    });
    setBusy(false);
    if (!res.ok) return;
    const data = await res.json();
    setAlbums((cur) => [...cur, data.album]);
    setArtist('');
    setTitle('');
  }

  async function markListened(id: number) {
    await patch(id, { listenedOn: todayLocal() });
  }

  async function remove(id: number) {
    setAlbums((cur) => cur.filter((a) => a.id !== id));
    await fetch(`/api/albums/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Album of the day</p>

      {/* Today */}
      {today ? (
        <div className="rounded-xl border border-[var(--card-border)] p-4 mb-5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1">Today</p>
          <p className="text-lg font-semibold leading-tight">{today.title}</p>
          <p className="text-sm text-[var(--muted)] mb-3">{today.artist}</p>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <StarRating
              value={today.rating}
              onChange={(r) => patch(today.id, { rating: r })}
              size="lg"
            />
            <button
              onClick={() => markListened(today.id)}
              className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium"
            >
              Mark as listened
            </button>
          </div>
          <input
            value={today.note ?? ''}
            onChange={(e) => patchLocal(today.id, { note: e.target.value })}
            onBlur={(e) => patch(today.id, { note: e.target.value })}
            placeholder="A thought on this album…"
            className="mt-3 w-full bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)] mb-5">
          Queue is empty — add an album to listen to next.
        </p>
      )}

      {/* Up next */}
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Up next</p>
      <ul className="space-y-1 mb-3">
        {upNext.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-1 group">
            <span className="flex-1 text-sm">
              <span className="font-medium">{a.title}</span>
              <span className="text-[var(--muted)]"> — {a.artist}</span>
            </span>
            <button
              onClick={() => remove(a.id)}
              className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
        {upNext.length === 0 ? (
          <li className="text-sm text-[var(--muted)] py-1">Nothing queued yet.</li>
        ) : null}
      </ul>

      <div className="flex gap-2 mb-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Album"
          className="flex-1 bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Artist"
          className="flex-1 bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {/* Recently listened */}
      {history.length > 0 ? (
        <>
          <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
            Recently listened
          </p>
          <ul className="space-y-2">
            {history.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-1 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <span className="font-medium">{a.title}</span>
                    <span className="text-[var(--muted)]"> — {a.artist}</span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">{formatDate(a.listenedOn!)}</p>
                  {a.note ? <p className="text-xs text-[var(--muted)] italic mt-0.5">{a.note}</p> : null}
                </div>
                <StarRating value={a.rating} onChange={(r) => patch(a.id, { rating: r })} />
                <button
                  onClick={() => remove(a.id)}
                  className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
