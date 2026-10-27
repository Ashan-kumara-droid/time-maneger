import { getDatabase } from '../client';

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: 'focus' | 'travel';
  priority: 'high' | 'medium' | 'low';
  estimated_minutes: number;
  remaining_minutes: number;
  is_recurring_daily: number;
  fixed_time_min: number | null;
  has_deadline: number;
  deadline_at: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'unschedulable';
  completed_at: string | null;
  created_at: string;
  updated_at?: string | null;
  linked_activity_id?: string | null;
  linked_study_type?: 'preparation' | 'revision' | null;
  reminder_enabled?: number;
};

export async function listTasks(): Promise<TaskRecord[]> {
  return getDatabase().getAllAsync<TaskRecord>(
    'SELECT * FROM tasks ORDER BY created_at DESC',
  );
}

export async function getTask(id: string): Promise<TaskRecord | null> {
  return getDatabase().getFirstAsync<TaskRecord>('SELECT * FROM tasks WHERE id = ?', id);
}

export async function saveTask(task: TaskRecord): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO tasks
      (id, title, description, category, kind, priority, estimated_minutes, remaining_minutes,
       is_recurring_daily, fixed_time_min, has_deadline, deadline_at, status, completed_at, created_at,
       linked_activity_id, linked_study_type, reminder_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, description = excluded.description, category = excluded.category,
       kind = excluded.kind, priority = excluded.priority, estimated_minutes = excluded.estimated_minutes,
       remaining_minutes = excluded.remaining_minutes, is_recurring_daily = excluded.is_recurring_daily,
       fixed_time_min = excluded.fixed_time_min, has_deadline = excluded.has_deadline,
       deadline_at = excluded.deadline_at, status = excluded.status,
       completed_at = excluded.completed_at, linked_activity_id = excluded.linked_activity_id,
       linked_study_type = excluded.linked_study_type, reminder_enabled = excluded.reminder_enabled`,
    task.id,
    task.title,
    task.description,
    task.category,
    task.kind,
    task.priority,
    task.estimated_minutes,
    task.remaining_minutes,
    task.is_recurring_daily,
    task.fixed_time_min,
    task.has_deadline,
    task.deadline_at,
    task.status,
    task.completed_at,
    task.created_at,
    task.linked_activity_id ?? null,
    task.linked_study_type ?? null,
    task.reminder_enabled ?? 1,
  );
}

export async function deleteTask(id: string): Promise<void> {
  await getDatabase().runAsync('DELETE FROM tasks WHERE id = ?', id);
}
