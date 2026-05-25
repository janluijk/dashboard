import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { favorites } from '@/lib/db/schema';
import { ExploreMap } from './ExploreMap';

export default async function ExplorePage() {
  const session = await getSession();
  const isSignedIn = !!session;
  if (!isSignedIn) {
    redirect('/');
  }
  const rows = await db
    .select({ segmentId: favorites.segmentId })
    .from(favorites)
    .where(eq(favorites.userId, session.userId));
  return <ExploreMap initialFavoriteIds={rows.map((r) => r.segmentId)} />;
}
