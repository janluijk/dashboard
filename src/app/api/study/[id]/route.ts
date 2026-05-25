import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { studySessions } from '@/lib/db/schema';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  await db
    .delete(studySessions)
    .where(and(eq(studySessions.id, Number(id)), eq(studySessions.userId, user.id)));
  return NextResponse.json({ ok: true });
}
