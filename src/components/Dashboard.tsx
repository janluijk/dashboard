'use client';

import { useMemo, useState, useTransition } from 'react';
import { StatCard } from './StatCard';
import { StudyTimer } from './StudyTimer';
import { TodoList } from './TodoList';
import { GoalsPanel } from './GoalsPanel';
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

type StudySession = {
  id: number;
  startedAt: string;
  endedAt: string;
  durationS: number;
  label: string | null;
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
  studySessions: StudySession[];
  todos: Todo[];
  goals: Goal[];
  albums: Album[];
};

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

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
  const { user, weekStart, weekEnd, activities, studySessions, todos, goals, albums } = props;
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const weekRuns = useMemo(
    () => activities.filter((a) => RUN_TYPES.has(a.type) && isInWeek(a.startDate, weekStart, weekEnd)),
    [activities, weekStart, weekEnd],
  );
  const weekWorkouts = useMemo(
    () => activities.filter((a) => isInWeek(a.startDate, weekStart, weekEnd)),
    [activities, weekStart, weekEnd],
  );
  const weekStudy = useMemo(
    () => studySessions.filter((s) => isInWeek(s.startedAt, weekStart, weekEnd)),
    [studySessions, weekStart, weekEnd],
  );

  const weeklyKm = weekRuns.reduce((sum, a) => sum + a.distanceM, 0) / 1000;
  const workoutSeconds = weekWorkouts.reduce((sum, a) => sum + a.movingTimeS, 0);
  const studySeconds = weekStudy.reduce((sum, s) => sum + s.durationS, 0);

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

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Weekly mileage"
          value={weeklyKm.toFixed(1)}
          unit="km"
          sub={`${weekRuns.length} run${weekRuns.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Workout time"
          value={formatHM(workoutSeconds)}
          sub={`${weekWorkouts.length} workout${weekWorkouts.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Study time"
          value={formatHM(studySeconds)}
          sub={`${weekStudy.length} session${weekStudy.length === 1 ? '' : 's'}`}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <GoalsPanel
            goals={goals}
            weeklyKm={weeklyKm}
            workoutHours={workoutSeconds / 3600}
            studyHours={studySeconds / 3600}
          />
        </div>
        <StudyTimer />
      </section>

      <section className="mb-6">
        <WeeklyMileageChart
          activities={activities}
          weeks={12}
          weeklyGoalKm={goals.find((g) => g.kind === 'weekly_km')?.targetValue}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <TodoList initialTodos={todos} />
        <Heatmap activities={activities} studySessions={studySessions} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <AlbumOfTheDay initialAlbums={albums} />
      </section>
    </main>
  );
}
