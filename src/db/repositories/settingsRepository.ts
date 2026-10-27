import { getDatabase } from '../client';

export async function getSetting(key: string): Promise<string | null> {
  const row = await getDatabase().getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDatabase().runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await getDatabase().getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings ORDER BY key',
  );
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}
