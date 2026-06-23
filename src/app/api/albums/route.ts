import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq, isNull, max, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { albums } from '@/lib/db/schema';

export async function GET() {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Queue first (ordered by position), then most recently listened.
  const rows = await db
    .select()
    .from(albums)
    .where(eq(albums.userId, user.id))
    .orderBy(asc(albums.listenedOn), asc(albums.position), desc(albums.createdAt));
  return NextResponse.json({ albums: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const artist = String(body.artist ?? '').trim();
  const title = String(body.title ?? '').trim();
  const isValid = artist.length > 0 && title.length > 0;
  if (!isValid) {
    return NextResponse.json({ error: 'artist and title required' }, { status: 400 });
  }
  // Append to the end of the queue.
  const [{ value: maxPosition }] = await db
    .select({ value: max(albums.position) })
    .from(albums)
    .where(sql`${albums.userId} = ${user.id} and ${isNull(albums.listenedOn)}`);
  const [row] = await db
    .insert(albums)
    .values({
      userId: user.id,
      artist,
      title,
      position: (maxPosition ?? 0) + 1,
    })
    .returning();
  return NextResponse.json({ album: row });
}
