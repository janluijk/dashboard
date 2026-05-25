import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { studySessions } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
  const rows = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, user.id), gte(studySessions.startedAt, since)))
    .orderBy(desc(studySessions.startedAt));
  return NextResponse.json({ sessions: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const startedAt = new Date(body.startedAt);
  const endedAt = new Date(body.endedAt);
  const durationS = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const [row] = await db
    .insert(studySessions)
    .values({
      userId: user.id,
      startedAt,
      endedAt,
      durationS,
      label: body.label ?? null,
      note: body.note ?? null,
      manual: !!body.manual,
    })
    .returning();
  return NextResponse.json({ session: row });
}
