import { getDatabase } from '../client';

export type FixedActivity = {
  id: string;
  date: string;
  start_min: number;
  end_min: number;
  title: string;
  notes: string | null;
  color: string | null;
};

export async function listFixedActivities(date?: string): Promise<FixedActivity[]> {
  if (date === undefined) {
    return getDatabase().getAllAsync<FixedActivity>(
      'SELECT * FROM fixed_activities ORDER BY date, start_min',
    );
  }
  return getDatabase().getAllAsync<FixedActivity>(
    'SELECT * FROM fixed_activities WHERE date = ? ORDER BY start_min',
    date,
  );
}

export async function saveFixedActivity(activity: FixedActivity): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO fixed_activities (id, date, start_min, end_min, title, notes, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET date = excluded.date, start_min = excluded.start_min,
       end_min = excluded.end_min, title = excluded.title, notes = excluded.notes,
       color = excluded.color`,
    activity.id,
    activity.date,
    activity.start_min,
    activity.end_min,
    activity.title,
    activity.notes,
    activity.color,
  );
}

export async function deleteFixedActivity(id: string): Promise<void> {
  await getDatabase().runAsync('DELETE FROM fixed_activities WHERE id = ?', id);
}
