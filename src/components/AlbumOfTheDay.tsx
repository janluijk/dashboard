'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Album = {
  id: number;
  artist: string;
  title: string;
  position: number;
  listenedOn: string | null;
  rating: number | null;
  note: string | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
  releaseYear: number | null;
};

type SearchResult = {
  spotifyId: string;
  artist: string;
  title: string;
  imageUrl: string | null;
  releaseYear: number | null;
  spotifyUrl: string | null;
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

function Cover({
  album,
  size,
}: {
  album: { imageUrl: string | null; title: string };
  size: number;
}) {
  const style = { width: size, height: size };
  if (album.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={album.imageUrl}
        alt=""
        style={style}
        className="rounded-md object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={style}
      className="rounded-md shrink-0 bg-[var(--card-border)] grid place-items-center text-[var(--muted)]"
    >
      ♪
    </div>
  );
}

function SpotifyLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
    >
      Play on Spotify ↗
    </a>
  );
}

// Half-star rating. Each star is split into two click targets: the left half
// sets an x.5 value, the right half sets a whole value. Clicking the current
// value again clears the rating. The fill is rendered by overlaying a clipped
// accent-colored star on top of an empty one.
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
  const current = value ?? 0;
  return (
    <div className={`flex items-center gap-0.5 ${cls}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        // Portion of this star that should be filled: 0, 0.5, or 1.
        const fill = Math.max(0, Math.min(1, current - (n - 1)));
        const half = n - 0.5;
        return (
          <span key={n} className="relative inline-block leading-none align-middle">
            <span className="text-[var(--card-border)]">★</span>
            {fill > 0 && (
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden text-[var(--accent)]"
                style={{ width: `${fill * 100}%` }}
              >
                ★
              </span>
            )}
            <button
              type="button"
              aria-label={`${half} star${half === 1 ? '' : 's'}`}
              onClick={() => onChange(current === half ? null : half)}
              className="absolute inset-y-0 left-0 z-10 w-1/2"
            />
            <button
              type="button"
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => onChange(current === n ? null : n)}
              className="absolute inset-y-0 right-0 z-10 w-1/2"
            />
          </span>
        );
      })}
    </div>
  );
}

export function AlbumOfTheDay({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const seq = useRef(0);

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

  // Debounced catalog search against /api/spotify/search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++seq.current;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
        if (id !== seq.current) return; // a newer query superseded this one
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setResults([]);
          setSearchError(data.error ?? 'Search unavailable');
        } else {
          const data = await res.json();
          setResults(data.results ?? []);
          setSearchError(null);
        }
      } catch {
        if (id === seq.current) setSearchError('Search unavailable');
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

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

  async function addAlbum(payload: {
    artist: string;
    title: string;
    spotifyId?: string;
    imageUrl?: string | null;
    spotifyUrl?: string | null;
    releaseYear?: number | null;
  }) {
    setBusy(true);
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) return;
    const data = await res.json();
    setAlbums((cur) => [...cur, data.album]);
    setQuery('');
    setResults([]);
  }

  function addFromResult(r: SearchResult) {
    addAlbum({
      artist: r.artist,
      title: r.title,
      spotifyId: r.spotifyId,
      imageUrl: r.imageUrl,
      spotifyUrl: r.spotifyUrl,
      releaseYear: r.releaseYear,
    });
  }

  // Fallback: add whatever was typed as "Title — Artist" (or just a title)
  // when search is unavailable or finds nothing.
  function addManual() {
    const raw = query.trim();
    if (raw.length === 0) return;
    const [titlePart, artistPart] = raw.split('—').map((s) => s.trim());
    addAlbum({ title: titlePart || raw, artist: artistPart || 'Unknown artist' });
  }

  async function markListened(id: number) {
    await patch(id, { listenedOn: todayLocal() });
  }

  async function remove(id: number) {
    setAlbums((cur) => cur.filter((a) => a.id !== id));
    await fetch(`/api/albums/${id}`, { method: 'DELETE' });
  }

  // --- Drag to reorder the queue. The first item is the album of the day, so
  // dragging a queued album above the current one promotes it to today. ---

  function resetDrag() {
    setDragId(null);
    setOverId(null);
  }

  function onDragStart(e: React.DragEvent, id: number) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    // Drag the whole card/row as the ghost image, not just the grip handle.
    const card = (e.currentTarget as HTMLElement).closest('[data-drag-card]');
    if (card) e.dataTransfer.setDragImage(card as Element, 16, 16);
  }

  function onDragOver(e: React.DragEvent, id: number) {
    if (dragId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== overId) setOverId(id);
  }

  function drop(dropId: number) {
    if (dragId === null || dragId === dropId) {
      resetDrag();
      return;
    }
    const ids = queue.map((a) => a.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(dropId);
    if (from === -1 || to === -1) {
      resetDrag();
      return;
    }
    const next = [...queue];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const orderedIds = next.map((a) => a.id);
    // Optimistic: positions become the new indices, which re-sorts the queue.
    setAlbums((cur) =>
      cur.map((a) => {
        const idx = orderedIds.indexOf(a.id);
        return idx === -1 ? a : { ...a, position: idx };
      }),
    );
    resetDrag();
    fetch('/api/albums/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orderedIds }),
    });
  }

  // Shared props that make an element a drop target for the dragged album.
  function dropTargetProps(id: number) {
    return {
      onDragOver: (e: React.DragEvent) => onDragOver(e, id),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        drop(id);
      },
      'data-drag-card': true,
    };
  }

  // A render helper (not a nested component) so it isn't remounted on every
  // re-render — remounting mid-drag would cancel the drag.
  function gripHandle(id: number) {
    return (
      <button
        type="button"
        aria-label="Drag to reorder"
        draggable
        onDragStart={(e) => onDragStart(e, id)}
        onDragEnd={resetDrag}
        className="cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] leading-none select-none touch-none"
      >
        ⠿
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Album of the day</p>

      {/* Today */}
      {today ? (
        <div
          {...dropTargetProps(today.id)}
          className={`rounded-xl border p-4 mb-5 transition-colors ${
            overId === today.id && dragId !== today.id
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--card-border)]'
          } ${dragId === today.id ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--accent)]">Today</p>
            {gripHandle(today.id)}
          </div>
          <div className="flex gap-4">
            <Cover album={today} size={72} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-tight">{today.title}</p>
              <p className="text-sm text-[var(--muted)]">
                {today.artist}
                {today.releaseYear ? ` · ${today.releaseYear}` : ''}
              </p>
              <div className="mt-1">
                <SpotifyLink url={today.spotifyUrl} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
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
          Queue is empty — search for an album to listen to next.
        </p>
      )}

      {/* Up next */}
      <p className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Up next</p>
      <ul className="space-y-1 mb-3">
        {upNext.map((a) => (
          <li
            key={a.id}
            {...dropTargetProps(a.id)}
            className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded-lg group transition-colors ${
              overId === a.id && dragId !== a.id ? 'bg-[var(--accent)]/10' : ''
            } ${dragId === a.id ? 'opacity-50' : ''}`}
          >
            {gripHandle(a.id)}
            <Cover album={a} size={32} />
            <span className="flex-1 min-w-0 text-sm truncate">
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

      {/* Search / add */}
      <div className="relative mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length === 0) addManual();
          }}
          placeholder="Search Spotify for an album…"
          className="w-full bg-transparent border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        {query.trim().length >= 2 ? (
          <div className="mt-2 rounded-lg border border-[var(--card-border)] overflow-hidden">
            {searching ? (
              <p className="px-3 py-2 text-sm text-[var(--muted)]">Searching…</p>
            ) : results.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.spotifyId}>
                    <button
                      onClick={() => addFromResult(r)}
                      disabled={busy}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--card-border)]/40 disabled:opacity-60"
                    >
                      <Cover album={r} size={40} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{r.title}</span>
                        <span className="block text-xs text-[var(--muted)] truncate">
                          {r.artist}
                          {r.releaseYear ? ` · ${r.releaseYear}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2">
                <p className="text-sm text-[var(--muted)] mb-1">
                  {searchError ?? 'No matches.'}
                </p>
                <button
                  onClick={addManual}
                  disabled={busy}
                  className="text-xs text-[var(--accent)] hover:underline disabled:opacity-60"
                >
                  Add “{query.trim()}” manually
                </button>
              </div>
            )}
          </div>
        ) : null}
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
                <Cover album={a} size={40} />
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
