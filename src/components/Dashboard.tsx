'use client';

import { useMemo, useState, useTransition } from 'react';
import { WeekProgress, type WeekMetric } from './WeekProgress';
import { TodoList } from './TodoList';
import { Heatmap } from './Heatmap';
import { WeeklyMileageChart } from './WeeklyMileageChart';
import { AlbumOfTheDay } from './AlbumOfTheDay';

type Activity = {
  id: number;
  name: string;
  type: string;
  sportType: string;
  distanceM: number;
  movingTimeS: number;
  startDate: string;
};

type Todo = {
  id: number;
  title: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Goal = {
  id: number;
  kind: string;
  targetValue: number;
  unit: string;
};

type Album = {
  id: number;
  artist: string;
  title: string;
  position: number;
  listenedOn: string | null;
  rating: number | null;
  note: string | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
  releaseYear: number | null;
};

type Props = {
  user: {
    id: number;
    firstname: string;
    lastname: string;
    avatarUrl: string | null;
    lastActivitySyncAt: string | null;
  };
  weekStart: string;
  weekEnd: string;
  activities: Activity[];
  todos: Todo[];
  goals: Goal[];
  albums: Album[];
};

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
// Strength training: Strava reports these under both `type` and `sport_type`.
const STRENGTH_TYPES = new Set([
  'WeightTraining',
  'Workout',
  'Crossfit',
  'HighIntensityIntervalTraining',
]);
// Anything on a bike. The legacy `type` collapses most of these to "Ride",
// while `sport_type` keeps the finer-grained variants.
const RIDE_TYPES = new Set([
  'Ride',
  'VirtualRide',
  'MountainBikeRide',
  'GravelRide',
  'EBikeRide',
  'EMountainBikeRide',
  'Handcycle',
]);

function matchesType(a: Activity, set: Set<string>): boolean {
  return set.has(a.type) || set.has(a.sportType);
}

function isInWeek(d: string, start: string, end: string): boolean {
  const t = new Date(d).getTime();
  return t >= new Date(start).getTime() && t < new Date(end).getTime();
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function Dashboard(props: Props) {
  const { user, weekStart, weekEnd, activities, todos, goals, albums } = props;
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const weekActivities = useMemo(
    () => activities.filter((a) => isInWeek(a.startDate, weekStart, weekEnd)),
    [activities, weekStart, weekEnd],
  );
  const weekRuns = useMemo(() => weekActivities.filter((a) => RUN_TYPES.has(a.type)), [weekActivities]);
  const weekStrength = useMemo(
    () => weekActivities.filter((a) => matchesType(a, STRENGTH_TYPES)),
    [weekActivities],
  );
  const weekRides = useMemo(
    () => weekActivities.filter((a) => matchesType(a, RIDE_TYPES)),
    [weekActivities],
  );

  const weeklyKm = weekRuns.reduce((sum, a) => sum + a.distanceM, 0) / 1000;
  const strengthSeconds = weekStrength.reduce((sum, a) => sum + a.movingTimeS, 0);
  const cyclingSeconds = weekRides.reduce((sum, a) => sum + a.movingTimeS, 0);

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const metrics: WeekMetric[] = [
    {
      kind: 'weekly_km',
      label: 'Running',
      centerValue: weeklyKm.toFixed(1),
      centerUnit: 'km',
      current: weeklyKm,
      unit: 'km',
      sub: plural(weekRuns.length, 'run'),
      defaultTarget: 30,
    },
    {
      kind: 'weekly_strength_hours',
      label: 'Strength',
      centerValue: formatHM(strengthSeconds),
      current: strengthSeconds / 3600,
      unit: 'h',
      sub: plural(weekStrength.length, 'session'),
      defaultTarget: 1.5,
    },
    {
      kind: 'weekly_cycling_hours',
      label: 'Cycling',
      centerValue: formatHM(cyclingSeconds),
      current: cyclingSeconds / 3600,
      unit: 'h',
      sub: plural(weekRides.length, 'ride'),
      defaultTarget: 2,
    },
  ];

  async function sync() {
    setSyncMsg(null);
    startSync(async () => {
      const res = await fetch('/api/activities/sync', { method: 'POST' });
      const ok = res.ok;
      if (ok) {
        const data = await res.json();
        setSyncMsg(`Synced ${data.synced} activities`);
        window.location.reload();
      } else {
        setSyncMsg('Sync failed');
      }
    });
  }

  return (
    <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : null}
          <div>
            <h1 className="text-xl font-semibold">Hi, {user.firstname}</h1>
            <p className="text-xs text-[var(--muted)]">
              {user.lastActivitySyncAt
                ? `Last sync ${new Date(user.lastActivitySyncAt).toLocaleString()}`
                : 'No sync yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sync}
            disabled={syncing}
            className="rounded-lg bg-[var(--accent)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {syncing ? 'Syncing…' : 'Sync Strava'}
          </button>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg border border-[var(--card-border)] text-[var(--muted)] px-4 py-2 text-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {syncMsg ? <p className="text-xs text-[var(--muted)] mb-4">{syncMsg}</p> : null}

      <WeekProgress goals={goals} metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <WeeklyMileageChart
            activities={activities}
            weeks={12}
            weeklyGoalKm={goals.find((g) => g.kind === 'weekly_km')?.targetValue}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <TodoList initialTodos={todos} />
            <Heatmap activities={activities} />
          </div>
        </div>
        <div className="lg:col-span-4">
          <AlbumOfTheDay initialAlbums={albums} />
        </div>
      </div>
    </main>
  );
}
