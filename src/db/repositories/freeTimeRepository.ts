import { getDatabase } from '../client';

export type FreeTimeRange = {
  id: string;
  day_of_week: number | null;
  date: string | null;
  start_min: number;
  end_min: number;
  preferences: string;
};

export async function listFreeTimeRanges(): Promise<FreeTimeRange[]> {
  return getDatabase().getAllAsync<FreeTimeRange>(
    'SELECT * FROM free_time_ranges ORDER BY date, day_of_week, start_min',
  );
}

export async function saveFreeTimeRange(range: FreeTimeRange): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO free_time_ranges (id, day_of_week, date, start_min, end_min, preferences)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET day_of_week = excluded.day_of_week,
       date = excluded.date, start_min = excluded.start_min,
       end_min = excluded.end_min, preferences = excluded.preferences`,
    range.id,
    range.day_of_week,
    range.date,
    range.start_min,
    range.end_min,
    range.preferences,
  );
}

export async function deleteFreeTimeRange(id: string): Promise<void> {
  await getDatabase().runAsync('DELETE FROM free_time_ranges WHERE id = ?', id);
}
