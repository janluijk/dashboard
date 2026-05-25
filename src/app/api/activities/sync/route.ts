import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { activities, users } from '@/lib/db/schema';
import { getStravaClient, fetchRecentActivities } from '@/lib/strava/client';

export async function POST() {
  const user = await requireUser().catch(() => null);
  const isAuthed = !!user;
  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
  const client = await getStravaClient(user.id);
  const fetched = await fetchRecentActivities(client, ninetyDaysAgo);

  const rows = fetched.map((a) => ({
    id: a.id,
    userId: user.id,
    name: a.name,
    type: a.type,
    sportType: a.sport_type,
    distanceM: a.distance ?? 0,
    movingTimeS: a.moving_time ?? 0,
    elapsedTimeS: a.elapsed_time ?? 0,
    elevationGainM: a.total_elevation_gain ?? 0,
    startDate: new Date(a.start_date),
    avgHeartrate: a.average_heartrate ?? null,
    maxHeartrate: a.max_heartrate ?? null,
    manual: a.manual ?? false,
  }));

  const hasRows = rows.length > 0;
  if (hasRows) {
    await db
      .insert(activities)
      .values(rows)
      .onConflictDoUpdate({
        target: activities.id,
        set: {
          name: sql`excluded.name`,
          distanceM: sql`excluded.distance_m`,
          movingTimeS: sql`excluded.moving_time_s`,
          elapsedTimeS: sql`excluded.elapsed_time_s`,
          elevationGainM: sql`excluded.elevation_gain_m`,
        },
      });
  }

  await db.update(users).set({ lastActivitySyncAt: new Date() }).where(eq(users.id, user.id));

  return NextResponse.json({ synced: rows.length });
}
