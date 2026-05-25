import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { todos } from '@/lib/db/schema';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  const hasTitle = typeof body.title === 'string';
  if (hasTitle) patch.title = body.title;
  const hasDone = typeof body.done === 'boolean';
  if (hasDone) {
    patch.done = body.done;
    patch.completedAt = body.done ? new Date() : null;
  }
  const hasDueDate = 'dueDate' in body;
  if (hasDueDate) patch.dueDate = body.dueDate;
  const [row] = await db
    .update(todos)
    .set(patch)
    .where(and(eq(todos.id, Number(id)), eq(todos.userId, user.id)))
    .returning();
  return NextResponse.json({ todo: row });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  await db.delete(todos).where(and(eq(todos.id, Number(id)), eq(todos.userId, user.id)));
  return NextResponse.json({ ok: true });
}
