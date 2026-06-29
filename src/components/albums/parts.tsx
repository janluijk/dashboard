'use client';

// Shared album types and presentational bits used by both the dashboard's
// "Album of the day" widget and the standalone albums library page.

export type Album = {
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

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function Cover({
  album,
  size,
  dimmed = false,
  fill = false,
}: {
  album: { imageUrl: string | null; title: string };
  // Fixed pixel size. Ignored when `fill` is set.
  size?: number;
  // Renders the cover grayed-out — used for albums added but not yet listened.
  dimmed?: boolean;
  // Fill the parent (which controls the dimensions) instead of a fixed size.
  fill?: boolean;
}) {
  const style = fill ? undefined : { width: size, height: size };
  const sizing = fill ? 'h-full w-full' : 'shrink-0';
  if (album.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={album.imageUrl}
        alt=""
        style={style}
        className={`rounded-md object-cover transition ${sizing} ${
          dimmed ? 'grayscale opacity-50' : ''
        }`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-md grid place-items-center bg-[var(--card-border)] text-[var(--muted)] ${sizing} ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      ♪
    </div>
  );
}

export function SpotifyLink({ url }: { url: string | null }) {
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
export function StarRating({
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
