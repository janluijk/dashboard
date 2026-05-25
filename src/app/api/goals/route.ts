import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';

export async function GET() {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = await db.select().from(goals).where(eq(goals.userId, user.id));
  return NextResponse.json({ goals: rows });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const kind = String(body.kind);
  const targetValue = Number(body.targetValue);
  const unit = String(body.unit);

  const existing = await db.select().from(goals).where(eq(goals.userId, user.id));
  const match = existing.find((g) => g.kind === kind);
  if (match) {
    const [row] = await db
      .update(goals)
      .set({ targetValue, unit, updatedAt: new Date() })
      .where(eq(goals.id, match.id))
      .returning();
    return NextResponse.json({ goal: row });
  }
  const [row] = await db
    .insert(goals)
    .values({ userId: user.id, kind, targetValue, unit })
    .returning();
  return NextResponse.json({ goal: row });
}
