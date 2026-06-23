import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { albums } from '@/lib/db/schema';

// Persist a new queue order. Body: { ids: number[] } — the queued albums in
// their new order. Each album's position is set to its index, so the first id
// becomes the album of the day.
export async function PUT(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i += 1) {
      await tx
        .update(albums)
        .set({ position: i })
        .where(and(eq(albums.id, ids[i]), eq(albums.userId, user.id)));
    }
  });
  return NextResponse.json({ ok: true });
}
