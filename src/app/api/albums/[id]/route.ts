import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { albums } from '@/lib/db/schema';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  const hasArtist = typeof body.artist === 'string';
  if (hasArtist) patch.artist = body.artist.trim();
  const hasTitle = typeof body.title === 'string';
  if (hasTitle) patch.title = body.title.trim();
  // listenedOn: a YYYY-MM-DD string moves the album into history; null sends it
  // back to the queue.
  const hasListenedOn = 'listenedOn' in body;
  if (hasListenedOn) patch.listenedOn = body.listenedOn ?? null;
  const hasRating = 'rating' in body;
  if (hasRating) patch.rating = body.rating === null ? null : Number(body.rating);
  const hasNote = 'note' in body;
  if (hasNote) patch.note = body.note === null ? null : String(body.note);

  const [row] = await db
    .update(albums)
    .set(patch)
    .where(and(eq(albums.id, Number(id)), eq(albums.userId, user.id)))
    .returning();
  return NextResponse.json({ album: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  await db.delete(albums).where(and(eq(albums.id, Number(id)), eq(albums.userId, user.id)));
  return NextResponse.json({ ok: true });
}
