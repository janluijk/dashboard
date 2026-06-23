// Spotify catalog access via the Client Credentials flow. This needs only an
// app client id/secret (no per-user OAuth), so it can search the public catalog
// but cannot read any user's library or playback. Used by /api/spotify/search.

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TOKEN_LEEWAY_MS = 60 * 1000;

type CachedToken = { token: string; expiresAt: number };
// Module-level cache: the app token is shared across all requests and lives as
// long as the server process. Refreshed when it's within the leeway window.
let cached: CachedToken | null = null;

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const isConfigured = !!clientId && !!clientSecret;
  if (!isConfigured) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  }
  return { clientId, clientSecret };
}

async function getAppToken(): Promise<string> {
  const isFresh = cached && cached.expiresAt - TOKEN_LEEWAY_MS > Date.now();
  if (isFresh) {
    return cached!.token;
  }

  const { clientId, clientSecret } = getCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

export type SpotifyAlbumResult = {
  spotifyId: string;
  artist: string;
  title: string;
  imageUrl: string | null;
  releaseYear: number | null;
  spotifyUrl: string | null;
};

type RawAlbum = {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string; width: number; height: number }[];
  release_date: string;
  external_urls: { spotify?: string };
};

function toResult(a: RawAlbum): SpotifyAlbumResult {
  // Spotify returns images largest-first; the middle one (~300px) is a good
  // thumbnail, falling back to whatever exists.
  const image = a.images[1] ?? a.images[0] ?? null;
  const year = Number(a.release_date?.slice(0, 4));
  return {
    spotifyId: a.id,
    artist: a.artists.map((x) => x.name).join(', '),
    title: a.name,
    imageUrl: image?.url ?? null,
    releaseYear: Number.isFinite(year) ? year : null,
    spotifyUrl: a.external_urls?.spotify ?? null,
  };
}

export async function searchAlbums(query: string, limit = 8): Promise<SpotifyAlbumResult[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  const token = await getAppToken();
  const url = `${SPOTIFY_API_BASE}/search?type=album&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { albums?: { items: RawAlbum[] } };
  return (data.albums?.items ?? []).map(toResult);
}
