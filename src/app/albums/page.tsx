import { asc, desc, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { albums } from '@/lib/db/schema';
import { AlbumLibrary } from '@/components/AlbumLibrary';
import { LoginScreen } from '@/components/LoginScreen';

export const dynamic = 'force-dynamic';

export default async function AlbumsPage() {
  const user = await getCurrentUser();
  const isAuthed = !!user;
  if (!isAuthed) {
    return <LoginScreen />;
  }

  const rows = await db
    .select()
    .from(albums)
    .where(eq(albums.userId, user.id))
    .orderBy(asc(albums.listenedOn), asc(albums.position), desc(albums.createdAt));

  return (
    <AlbumLibrary
      initialAlbums={rows.map((a) => ({
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
