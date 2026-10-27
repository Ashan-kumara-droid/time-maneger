import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/src/db/client';
import { getTask, listTasks, saveTask, TaskRecord } from '@/src/db/repositories/taskRepository';
import { listSessions, saveSession, SessionRecord } from '@/src/db/repositories/sessionRepository';
import { rebuildSchedule, ScheduleReason } from './schedulerService';
import { ScheduleResult } from '@/src/scheduler/types';
import { formatLocalDateTime, toDateKey } from '@/src/scheduler/dateUtils';

export type TaskInput = Pick<TaskRecord,
  'title' | 'description' | 'category' | 'kind' | 'priority' | 'estimated_minutes' |
  'is_recurring_daily' | 'fixed_time_min' | 'has_deadline' | 'deadline_at'
> & Pick<TaskRecord, 'linked_activity_id' | 'linked_study_type' | 'reminder_enabled'>;

export async function createTask(input: TaskInput): Promise<{ task: TaskRecord; result: ScheduleResult }> {
  const now = new Date().toISOString();
  const task: TaskRecord = {
    ...input,
    id: Crypto.randomUUID(),
    remaining_minutes: input.estimated_minutes,
    status: 'pending',
    completed_at: null,
    created_at: now,
    linked_activity_id: input.linked_activity_id ?? null,
    linked_study_type: input.linked_study_type ?? null,
    reminder_enabled: input.reminder_enabled ?? 1,
  };
  await saveTask(task);
  const result = await rebuildSchedule('new_task');
  return { task, result };
}

export async function saveScheduledStudyTask(
  id: string | null,
  input: TaskInput,
  date: string,
  startMin: number,
): Promise<{ task: TaskRecord; result: ScheduleResult }> {
  if (!input.linked_activity_id || !input.linked_study_type) {
    throw new Error('A scheduled study session must be linked to a lecture.');
  }
  const sessionDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(sessionDate.getTime()) || toDateKey(sessionDate) !== date) {
    throw new Error('Study session date is invalid.');
  }
  const existing = id ? await getTask(id) : null;
  if (id && !existing) throw new Error('Task could not be found.');
  if (existing?.status === 'completed') throw new Error('Completed study sessions cannot be rescheduled.');
  const now = new Date();
  const completedMinutes = existing
    ? Math.max(0, existing.estimated_minutes - existing.remaining_minutes)
    : 0;
  const task: TaskRecord = existing
    ? {
      ...existing,
      ...input,
      remaining_minutes: Math.max(0, input.estimated_minutes - completedMinutes),
      status: 'pending',
      completed_at: null,
      reminder_enabled: input.reminder_enabled ?? existing.reminder_enabled ?? 1,
    }
    : {
      ...input,
      id: Crypto.randomUUID(),
      remaining_minutes: input.estimated_minutes,
      status: 'pending',
      completed_at: null,
      created_at: now.toISOString(),
      linked_activity_id: input.linked_activity_id ?? null,
      linked_study_type: input.linked_study_type ?? null,
      reminder_enabled: input.reminder_enabled ?? 0,
    };
  const previousSessions = existing ? await listSessions(task.id) : [];
  if (previousSessions.some(session => session.status === 'done')) {
    throw new Error('This study task already has completed work. Create another session from the lecture instead.');
  }
  const pinnedSession = previousSessions.find(session => session.status === 'planned' && session.is_locked === 1);
  const sessionId = pinnedSession?.id ?? Crypto.randomUUID();
  const endMin = startMin + input.estimated_minutes;
  if (!Number.isInteger(startMin) || startMin < 0 || !Number.isInteger(input.estimated_minutes)
    || input.estimated_minutes < 5 || endMin > 1440) {
    throw new Error('Study session must fit within a single day.');
  }

  const database = getDatabase();
  await database.withTransactionAsync(async () => {
    await saveTask(task);
    await database.runAsync("DELETE FROM sessions WHERE task_id = ? AND status = 'planned'", task.id);
    await saveSession({
      id: sessionId,
      task_id: task.id,
      date,
      start_at: formatLocalDateTime(date, startMin),
      end_at: formatLocalDateTime(date, endMin),
      planned_minutes: input.estimated_minutes,
      actual_minutes: null,
      status: 'planned',
      is_locked: 1,
      session_index: 1,
    });
  });
  const result = await rebuildSchedule(existing ? 'edit' : 'new_task');
  return { task, result };
}

export async function updateTask(id: string, input: TaskInput): Promise<{ task: TaskRecord; result: ScheduleResult }> {
  const existing = await getTask(id);
  if (!existing) throw new Error('Task could not be found.');
  const completedMinutes = Math.max(0, existing.estimated_minutes - existing.remaining_minutes);
  const task: TaskRecord = {
    ...existing,
    ...input,
    remaining_minutes: Math.max(0, input.estimated_minutes - completedMinutes),
    status: existing.status === 'completed' || input.estimated_minutes <= completedMinutes ? 'completed' : 'pending',
    completed_at: existing.status === 'completed' || input.estimated_minutes <= completedMinutes
      ? existing.completed_at ?? new Date().toISOString()
      : null,
  };
  await saveTask(task);
  const result = await rebuildSchedule('edit');
  return { task, result };
}

export async function deleteTaskWithUndo(id: string): Promise<() => Promise<void>> {
  const task = await getTask(id);
  if (!task) throw new Error('Task could not be found.');
  const sessions = await listSessions(id);
  const db = getDatabase();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
  await rebuildSchedule('edit');
  return async () => {
    await saveTask(task);
    await db.withTransactionAsync(async () => {
      for (const session of sessions) {
        await db.runAsync(
          `INSERT OR REPLACE INTO sessions
           (id, task_id, date, start_at, end_at, planned_minutes, actual_minutes, status, is_locked, session_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    });
    await rebuildSchedule('manual_rebuild');
  };
}

export async function completeSession(sessionId: string, actualMinutes?: number): Promise<() => Promise<void>> {
  const db = getDatabase();
  const session = await db.getFirstAsync<SessionRecord>('SELECT * FROM sessions WHERE id = ?', sessionId);
  if (!session || session.status !== 'planned') throw new Error('This session is no longer available to complete.');
  const task = await getTask(session.task_id);
  if (!task || task.status === 'completed') throw new Error('The task is already complete or unavailable.');
  const workedMinutes = Math.max(0, Math.min(
    task.remaining_minutes,
    Math.floor(actualMinutes ?? session.planned_minutes),
  ));
  const remaining = Math.max(0, task.remaining_minutes - workedMinutes);
  const now = new Date().toISOString();
  const previousSessions = await listSessions(task.id);
  const recurring = task.is_recurring_daily === 1;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE sessions SET status = 'done', actual_minutes = ? WHERE id = ?",
      workedMinutes,
      session.id,
    );
    if (recurring) {
      await db.runAsync(
        `INSERT INTO task_occurrences (id, task_id, date, status, completed_at)
         VALUES (?, ?, ?, 'done', ?)
         ON CONFLICT(task_id, date) DO UPDATE SET status = 'done', completed_at = excluded.completed_at`,
        `occurrence-${task.id}-${session.date}`,
        task.id,
        session.date,
        now,
      );
    } else {
      await db.runAsync(
        `UPDATE tasks SET remaining_minutes = ?, status = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`,
        remaining,
        remaining === 0 ? 'completed' : 'pending',
        remaining === 0 ? now : null,
        now,
        task.id,
      );
    }
    if (!recurring && remaining === 0) {
      await db.runAsync("DELETE FROM sessions WHERE task_id = ? AND status = 'planned' AND is_locked = 0", task.id);
    }
  });
  if (recurring || remaining > 0) await rebuildSchedule('complete');
  return async () => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM sessions WHERE task_id = ?', task.id);
      await db.runAsync('DELETE FROM task_occurrences WHERE task_id = ? AND date = ?', task.id, session.date);
      for (const previous of previousSessions) {
        await db.runAsync(
          `INSERT INTO sessions
           (id, task_id, date, start_at, end_at, planned_minutes, actual_minutes, status, is_locked, session_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          previous.id, previous.task_id, previous.date, previous.start_at, previous.end_at,
          previous.planned_minutes, previous.actual_minutes, previous.status, previous.is_locked, previous.session_index,
        );
      }
      await db.runAsync(
        'UPDATE tasks SET remaining_minutes = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
        task.remaining_minutes, task.status, task.completed_at, task.updated_at ?? task.created_at, task.id,
      );
    });
    await rebuildSchedule('manual_rebuild');
  };
}

export async function completeTask(taskId: string): Promise<() => Promise<void>> {
  const db = getDatabase();
  const task = await getTask(taskId);
  if (!task) throw new Error('Task could not be found.');
  const previousSessions = await listSessions(taskId);
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE tasks SET remaining_minutes = 0, status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
      now,
      now,
      taskId,
    );
    await db.runAsync("DELETE FROM sessions WHERE task_id = ? AND status = 'planned'", taskId);
  });
  await rebuildSchedule('complete');
  return async () => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM sessions WHERE task_id = ?', taskId);
      for (const previous of previousSessions) {
        await db.runAsync(
          `INSERT INTO sessions
           (id, task_id, date, start_at, end_at, planned_minutes, actual_minutes, status, is_locked, session_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          previous.id, previous.task_id, previous.date, previous.start_at, previous.end_at,
          previous.planned_minutes, previous.actual_minutes, previous.status, previous.is_locked, previous.session_index,
        );
      }
      await db.runAsync(
        'UPDATE tasks SET remaining_minutes = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
        task.remaining_minutes, task.status, task.completed_at, task.updated_at ?? task.created_at, taskId,
      );
    });
    await rebuildSchedule('manual_rebuild');
  };
}

export async function listTasksWithSessions(): Promise<Array<{ task: TaskRecord; sessions: SessionRecord[] }>> {
  const tasks = await listTasks();
  const sessions = await listSessions();
  return tasks.map(task => ({
    task,
    sessions: sessions.filter(session => session.task_id === task.id),
  }));
}

export async function rescheduleTask(_id: string, reason: ScheduleReason = 'manual_rebuild') {
  return rebuildSchedule(reason);
}
