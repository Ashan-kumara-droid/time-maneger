import type { SQLiteDatabase } from 'expo-sqlite';

type Migration = {
  version: number;
  up: (database: SQLiteDatabase) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: async database => {
      await database.execAsync(`
        CREATE TABLE profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          username TEXT NOT NULL,
          gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
          occupation TEXT CHECK (occupation IN ('university', 'school', 'professional')),
          avatar_uri TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE timetable_activities (
          id TEXT PRIMARY KEY NOT NULL,
          day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
          start_min INTEGER NOT NULL,
          end_min INTEGER NOT NULL CHECK (end_min > start_min),
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          location TEXT,
          notes TEXT,
          color TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
        );
        CREATE INDEX timetable_activities_day_idx ON timetable_activities(day_of_week, start_min);
        CREATE TABLE time_windows (
          id TEXT PRIMARY KEY NOT NULL,
          day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
          start_min INTEGER NOT NULL,
          end_min INTEGER NOT NULL CHECK (end_min > start_min),
          kind TEXT NOT NULL CHECK (kind IN ('focus', 'travel')),
          label TEXT,
          allowed_task_kinds_json TEXT NOT NULL DEFAULT '[]',
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
        );
        CREATE INDEX time_windows_day_idx ON time_windows(day_of_week, start_min);
        CREATE TABLE fixed_activities (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL,
          start_min INTEGER NOT NULL,
          end_min INTEGER NOT NULL CHECK (end_min > start_min),
          title TEXT NOT NULL,
          notes TEXT,
          color TEXT
        );
        CREATE INDEX fixed_activities_date_idx ON fixed_activities(date, start_min);
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('focus', 'travel')),
          priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
          estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes >= 5),
          remaining_minutes INTEGER NOT NULL CHECK (remaining_minutes >= 0),
          is_recurring_daily INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring_daily IN (0, 1)),
          fixed_time_min INTEGER,
          has_deadline INTEGER NOT NULL DEFAULT 0 CHECK (has_deadline IN (0, 1)),
          deadline_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'unschedulable')),
          completed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX tasks_status_idx ON tasks(status);
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          start_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          planned_minutes INTEGER NOT NULL CHECK (planned_minutes > 0),
          actual_minutes INTEGER,
          status TEXT NOT NULL CHECK (status IN ('planned', 'done', 'missed', 'skipped')),
          is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1))
        );
        CREATE INDEX sessions_task_idx ON sessions(task_id, start_at);
        CREATE TABLE skipped_dates (
          date TEXT PRIMARY KEY NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    up: async database => {
      await database.execAsync(`
        ALTER TABLE tasks ADD COLUMN updated_at TEXT;
        ALTER TABLE sessions ADD COLUMN date TEXT;
        ALTER TABLE sessions ADD COLUMN session_index INTEGER NOT NULL DEFAULT 1;
        UPDATE sessions SET date = substr(start_at, 1, 10) WHERE date IS NULL;
        CREATE INDEX sessions_date_idx ON sessions(date);
        CREATE TABLE task_occurrences (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'missed')),
          completed_at TEXT,
          UNIQUE(task_id, date)
        );
        CREATE TABLE schedule_log (
          id TEXT PRIMARY KEY NOT NULL,
          timestamp TEXT NOT NULL,
          reason TEXT NOT NULL,
          summary_json TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 3,
    up: async database => {
      await database.execAsync(`
        CREATE TABLE free_time_ranges (
          id TEXT PRIMARY KEY NOT NULL,
          day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
          date TEXT,
          start_min INTEGER NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
          end_min INTEGER NOT NULL CHECK (end_min BETWEEN 1 AND 2880 AND end_min > start_min),
          preferences TEXT NOT NULL DEFAULT '',
          CHECK ((day_of_week IS NOT NULL AND date IS NULL) OR (day_of_week IS NULL AND date IS NOT NULL))
        );
        CREATE INDEX free_time_weekday_idx ON free_time_ranges(day_of_week, start_min);
        CREATE INDEX free_time_date_idx ON free_time_ranges(date, start_min);
      `);
    },
  },
  {
    version: 4,
    up: async database => {
      await database.execAsync(`
        ALTER TABLE tasks ADD COLUMN linked_activity_id TEXT;
        ALTER TABLE tasks ADD COLUMN linked_study_type TEXT
          CHECK (linked_study_type IN ('preparation', 'revision'));
        CREATE INDEX tasks_linked_activity_idx ON tasks(linked_activity_id);
      `);
    },
  },
  {
    version: 5,
    up: async database => {
      await database.execAsync(`
        ALTER TABLE tasks ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1
          CHECK (reminder_enabled IN (0, 1));
      `);
    },
  },
];

export async function runMigrations(database: SQLiteDatabase) {
  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    INSERT INTO schema_version (version)
      SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM schema_version);
  `);

  const versionRow = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1',
  );
  if (!versionRow) {
    throw new Error('Database schema version is missing.');
  }

  for (const migration of migrations) {
    if (migration.version <= versionRow.version) continue;
    await database.withTransactionAsync(async () => {
      await migration.up(database);
      await database.runAsync('UPDATE schema_version SET version = ?', migration.version);
    });
  }
}
