import { getDatabase } from '../client';

export type SessionRecord = {
  id: string;
  task_id: string;
  date: string;
  start_at: string;
  end_at: string;
  planned_minutes: number;
  actual_minutes: number | null;
  status: 'planned' | 'done' | 'missed' | 'skipped';
  is_locked: number;
  session_index: number;
};

export async function listSessions(taskId?: string): Promise<SessionRecord[]> {
  if (taskId === undefined) {
    return getDatabase().getAllAsync<SessionRecord>('SELECT * FROM sessions ORDER BY start_at');
  }
  return getDatabase().getAllAsync<SessionRecord>(
    'SELECT * FROM sessions WHERE task_id = ? ORDER BY start_at',
    taskId,
  );
}

export async function saveSession(session: SessionRecord): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO sessions
      (id, task_id, date, start_at, end_at, planned_minutes, actual_minutes, status, is_locked, session_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET task_id = excluded.task_id, date = excluded.date, start_at = excluded.start_at,
       end_at = excluded.end_at, planned_minutes = excluded.planned_minutes,
       actual_minutes = excluded.actual_minutes, status = excluded.status,
       is_locked = excluded.is_locked, session_index = excluded.session_index`,
    session.id,
    session.task_id,
    session.date,
    session.start_at,
    session.end_at,
    session.planned_minutes,
    session.actual_minutes,
    session.status,
    session.is_locked,
    session.session_index,
  );
}

export async function deleteSession(id: string): Promise<void> {
  await getDatabase().runAsync('DELETE FROM sessions WHERE id = ?', id);
}
