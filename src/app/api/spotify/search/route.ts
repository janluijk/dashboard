import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { searchAlbums } from '@/lib/spotify/client';

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (q.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await searchAlbums(q);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'search failed';
    const isConfigError = message.includes('must be set');
    return NextResponse.json(
      { error: isConfigError ? 'Spotify is not configured' : 'search failed' },
      { status: isConfigError ? 503 : 502 },
    );
  }
}
