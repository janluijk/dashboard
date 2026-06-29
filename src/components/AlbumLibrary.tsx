'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Cover, SpotifyLink, StarRating, formatDate, type Album } from './albums/parts';

type Sort = 'recent' | 'rating' | 'artist';

function averageRating(albums: Album[]): number | null {
  const rated = albums.filter((a) => a.rating != null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, a) => sum + (a.rating ?? 0), 0) / rated.length;
}

export function AlbumLibrary({ initialAlbums }: { initialAlbums: Album[] }) {
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [sort, setSort] = useState<Sort>('recent');

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

  const listened = useMemo(() => {
    const rows = albums.filter((a) => a.listenedOn);
    const sorted = [...rows];
    if (sort === 'recent') {
      sorted.sort((x, y) => (y.listenedOn! < x.listenedOn! ? -1 : 1));
    } else if (sort === 'rating') {
      sorted.sort((x, y) => (y.rating ?? -1) - (x.rating ?? -1));
    } else {
      sorted.sort((x, y) => x.artist.localeCompare(y.artist));
    }
    return sorted;
  }, [albums, sort]);

  const queue = useMemo(
    () => albums.filter((a) => !a.listenedOn).sort((x, y) => x.position - y.position),
    [albums],
  );

  const avg = averageRating(albums);

  return (
    <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Albums</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {albums.length} album{albums.length === 1 ? '' : 's'} · {listened.length} listened ·{' '}
            {queue.length} in queue
            {avg != null ? ` · avg ${avg.toFixed(1)}★` : ''}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Dashboard
        </Link>
      </header>

      {/* Listened */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[var(--muted)]">Listened</h2>
        {listened.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded border border-[var(--card-border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
            >
              <option value="recent">Recently listened</option>
              <option value="rating">Highest rated</option>
              <option value="artist">Artist</option>
            </select>
          </label>
        )}
      </div>

      {listened.length === 0 ? (
        <p className="mb-10 text-sm text-[var(--muted)]">
          Nothing listened yet — mark an album as listened on the dashboard.
        </p>
      ) : (
        <ul className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listened.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4"
            >
              <div className="flex gap-3">
                <Cover album={a} size={72} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-tight">{a.title}</p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {a.artist}
                    {a.releaseYear ? ` · ${a.releaseYear}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{formatDate(a.listenedOn!)}</p>
                  <div className="mt-1">
                    <SpotifyLink url={a.spotifyUrl} />
                  </div>
                </div>
              </div>
              <StarRating value={a.rating} onChange={(r) => patch(a.id, { rating: r })} />
              <input
                value={a.note ?? ''}
                onChange={(e) => patchLocal(a.id, { note: e.target.value })}
                onBlur={(e) => patch(a.id, { note: e.target.value })}
                placeholder="A thought on this album…"
                className="w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </li>
          ))}
        </ul>
      )}

      {/* Added but not yet listened */}
      <h2 className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)]">
        Added — not yet listened
      </h2>
      {queue.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">The queue is empty.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {queue.map((a) => (
            <li key={a.id} className="group flex flex-col gap-1.5">
              <div className="relative aspect-square">
                <Cover album={a} dimmed fill />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-md bg-black/55 px-1.5 py-0.5 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                  {a.title}
                </span>
              </div>
              <p className="truncate text-xs font-medium" title={`${a.title} — ${a.artist}`}>
                {a.title}
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">{a.artist}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
