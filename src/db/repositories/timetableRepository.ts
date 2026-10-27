import { getDatabase } from '../client';

export type TimetableActivity = {
  id: string;
  day_of_week: number;
  start_min: number;
  end_min: number;
  title: string;
  type: string;
  location: string | null;
  notes: string | null;
  color: string | null;
  is_active: number;
};

export type TimeWindow = {
  id: string;
  day_of_week: number;
  start_min: number;
  end_min: number;
  kind: 'focus' | 'travel';
  label: string | null;
  allowed_task_kinds_json: string;
  is_active: number;
};

export async function listTimetableActivities(day?: number): Promise<TimetableActivity[]> {
  if (day === undefined) {
    return getDatabase().getAllAsync<TimetableActivity>(
      'SELECT * FROM timetable_activities ORDER BY day_of_week, start_min',
    );
  }
  return getDatabase().getAllAsync<TimetableActivity>(
    'SELECT * FROM timetable_activities WHERE day_of_week = ? ORDER BY start_min',
    day,
  );
}

export async function saveTimetableActivity(activity: TimetableActivity): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO timetable_activities
      (id, day_of_week, start_min, end_min, title, type, location, notes, color, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      day_of_week = excluded.day_of_week, start_min = excluded.start_min,
      end_min = excluded.end_min, title = excluded.title, type = excluded.type,
      location = excluded.location, notes = excluded.notes, color = excluded.color,
      is_active = excluded.is_active`,
    activity.id,
    activity.day_of_week,
    activity.start_min,
    activity.end_min,
    activity.title,
    activity.type,
    activity.location,
    activity.notes,
    activity.color,
    activity.is_active,
  );
}

export async function deleteTimetableActivity(id: string): Promise<void> {
  const database = getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE tasks SET linked_activity_id = NULL, linked_study_type = NULL WHERE linked_activity_id = ?',
      id,
    );
    await database.runAsync('DELETE FROM timetable_activities WHERE id = ?', id);
  });
}

export async function deleteTimetableActivitiesForDay(day: number): Promise<void> {
  const database = getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE tasks
       SET linked_activity_id = NULL, linked_study_type = NULL
       WHERE linked_activity_id IN (
         SELECT id FROM timetable_activities WHERE day_of_week = ?
       )`,
      day,
    );
    await database.runAsync('DELETE FROM timetable_activities WHERE day_of_week = ?', day);
  });
}

export async function listTimeWindows(day?: number): Promise<TimeWindow[]> {
  if (day === undefined) {
    return getDatabase().getAllAsync<TimeWindow>(
      'SELECT * FROM time_windows ORDER BY day_of_week, start_min',
    );
  }
  return getDatabase().getAllAsync<TimeWindow>(
    'SELECT * FROM time_windows WHERE day_of_week = ? ORDER BY start_min',
    day,
  );
}

export async function saveTimeWindow(window: TimeWindow): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO time_windows
      (id, day_of_week, start_min, end_min, kind, label, allowed_task_kinds_json, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      day_of_week = excluded.day_of_week, start_min = excluded.start_min,
      end_min = excluded.end_min, kind = excluded.kind, label = excluded.label,
      allowed_task_kinds_json = excluded.allowed_task_kinds_json, is_active = excluded.is_active`,
    window.id,
    window.day_of_week,
    window.start_min,
    window.end_min,
    window.kind,
    window.label,
    window.allowed_task_kinds_json,
    window.is_active,
  );
}

export async function deleteTimeWindow(id: string): Promise<void> {
  await getDatabase().runAsync('DELETE FROM time_windows WHERE id = ?', id);
}
