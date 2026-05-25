import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { todos } from '@/lib/db/schema';

export async function GET() {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
    .orderBy(asc(todos.done), asc(todos.position), desc(todos.createdAt));
  return NextResponse.json({ todos: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const title = String(body.title ?? '').trim();
  const isValid = title.length > 0;
  if (!isValid) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }
  const [row] = await db
    .insert(todos)
    .values({
      userId: user.id,
      title,
      dueDate: body.dueDate ?? null,
    })
    .returning();
  return NextResponse.json({ todo: row });
}
