import {
  pgTable,
  serial,
  bigint,
  text,
  boolean,
  doublePrecision,
  integer,
  timestamp,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  stravaAthleteId: bigint('strava_athlete_id', { mode: 'number' }).notNull().unique(),
  firstname: text('firstname').notNull(),
  lastname: text('lastname').notNull(),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  hasPremium: boolean('has_premium').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow(),
  lastActivitySyncAt: timestamp('last_activity_sync_at', { withTimezone: true }),
});

export const activities = pgTable('activities', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  sportType: text('sport_type').notNull(),
  distanceM: doublePrecision('distance_m').notNull().default(0),
  movingTimeS: integer('moving_time_s').notNull().default(0),
  elapsedTimeS: integer('elapsed_time_s').notNull().default(0),
  elevationGainM: doublePrecision('elevation_gain_m').notNull().default(0),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  avgHeartrate: doublePrecision('avg_heartrate'),
  maxHeartrate: doublePrecision('max_heartrate'),
  manual: boolean('manual').notNull().default(false),
});

export const studySessions = pgTable('study_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  durationS: integer('duration_s').notNull(),
  label: text('label'),
  note: text('note'),
  manual: boolean('manual').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const todos = pgTable('todos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  done: boolean('done').notNull().default(false),
  dueDate: date('due_date'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  targetValue: doublePrecision('target_value').notNull(),
  unit: text('unit').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Buurtheld feature tables (Strava segment / Local Legend tracking). ---

export const segments = pgTable('segments', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  polyline: text('polyline').notNull(),
  startLat: doublePrecision('start_lat').notNull(),
  startLng: doublePrecision('start_lng').notNull(),
  endLat: doublePrecision('end_lat').notNull(),
  endLng: doublePrecision('end_lng').notNull(),
  distanceM: doublePrecision('distance_m').notNull(),
  avgGrade: doublePrecision('avg_grade'),
  elevationProfileUrl: text('elevation_profile_url'),
  localLegendEnabled: boolean('local_legend_enabled').notNull().default(false),
  leaderEffortCountOverall: integer('leader_effort_count_overall'),
  leaderEffortCountFemale: integer('leader_effort_count_female'),
  localLegendAthleteId: bigint('local_legend_athlete_id', { mode: 'number' }),
  detailsFetchedAt: timestamp('details_fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  'favorites',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    segmentId: bigint('segment_id', { mode: 'number' })
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.segmentId] })],
);

export const athleteEfforts = pgTable(
  'athlete_efforts',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    segmentId: bigint('segment_id', { mode: 'number' })
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    recent90dCount: integer('recent_90d_count').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.segmentId] })],
);

export const rateLimitState = pgTable('rate_limit_state', {
  id: integer('id').primaryKey().default(1),
  shortWindowUsage: integer('short_window_usage').notNull().default(0),
  shortWindowResetAt: timestamp('short_window_reset_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  longWindowUsage: integer('long_window_usage').notNull().default(0),
  longWindowResetAt: timestamp('long_window_reset_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type AthleteEffort = typeof athleteEfforts.$inferSelect;
export type NewAthleteEffort = typeof athleteEfforts.$inferInsert;
