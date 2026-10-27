import { getDatabase } from '../client';

export async function listSkippedDates(): Promise<string[]> {
  const rows = await getDatabase().getAllAsync<{ date: string }>(
    'SELECT date FROM skipped_dates ORDER BY date',
  );
  return rows.map(row => row.date);
}

export async function setDateSkipped(date: string, skipped: boolean): Promise<void> {
  if (skipped) {
    await getDatabase().runAsync(
      'INSERT INTO skipped_dates (date) VALUES (?) ON CONFLICT(date) DO NOTHING',
      date,
    );
    return;
  }
  await getDatabase().runAsync('DELETE FROM skipped_dates WHERE date = ?', date);
}
