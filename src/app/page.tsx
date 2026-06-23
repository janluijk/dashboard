import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { activities, albums, goals, todos } from '@/lib/db/schema';
import { startOfWeek, endOfWeek } from '@/lib/week';
import { Dashboard } from '@/components/Dashboard';
import { LoginScreen } from '@/components/LoginScreen';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  const isAuthed = !!user;
  if (!isAuthed) {
    return <LoginScreen />;
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [recentActivities, allTodos, userGoals, allAlbums] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, user.id), gte(activities.startDate, ninetyDaysAgo)))
      .orderBy(desc(activities.startDate)),
    db
      .select()
      .from(todos)
      .where(eq(todos.userId, user.id))
      .orderBy(desc(todos.createdAt)),
    db.select().from(goals).where(eq(goals.userId, user.id)),
    db
      .select()
      .from(albums)
      .where(eq(albums.userId, user.id))
      .orderBy(asc(albums.listenedOn), asc(albums.position), desc(albums.createdAt)),
  ]);

  return (
    <Dashboard
      user={{
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        avatarUrl: user.avatarUrl,
        lastActivitySyncAt: user.lastActivitySyncAt?.toISOString() ?? null,
      }}
      weekStart={weekStart.toISOString()}
      weekEnd={weekEnd.toISOString()}
      activities={recentActivities.map((a) => ({
        ...a,
        startDate: a.startDate.toISOString(),
      }))}
      todos={allTodos.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
      }))}
      goals={userGoals}
      albums={allAlbums.map((a) => ({
        id: a.id,
        artist: a.artist,
        title: a.title,
        position: a.position,
        listenedOn: a.listenedOn,
        rating: a.rating,
        note: a.note,
        imageUrl: a.imageUrl,
        spotifyUrl: a.spotifyUrl,
        releaseYear: a.releaseYear,
      }))}
    />
  );
}
