import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/src/db/client';
import { TaskRecord, listTasks } from '@/src/db/repositories/taskRepository';
import { listSessions, SessionRecord } from '@/src/db/repositories/sessionRepository';
import { listFixedActivities } from '@/src/db/repositories/fixedActivityRepository';
import { listSkippedDates } from '@/src/db/repositories/skippedDateRepository';
import { listTimeWindows, listTimetableActivities } from '@/src/db/repositories/timetableRepository';
import { formatLocalDateTime, localDateTimeToMinutes, toDateKey } from '@/src/scheduler/dateUtils';
import { scheduleTasks } from '@/src/scheduler/scheduleTasks';
import { syncSessionReminders } from './notificationService';
import {
  DEFAULT_SCHEDULER_SETTINGS,
  PlannedSession,
  ScheduleResult,
  SchedulerTask,
} from '@/src/scheduler/types';

export type ScheduleReason = 'new_task' | 'missed' | 'edit' | 'manual_rebuild' | 'complete' | 'timetable_change';

function mapTask(task: TaskRecord): SchedulerTask {
  return {
    id: task.id,
    title: task.title,
    kind: task.kind,
    priority: task.priority,
    remainingMinutes: task.remaining_minutes,
    estimatedMinutes: task.estimated_minutes,
    isRecurringDaily: task.is_recurring_daily === 1,
    fixedTimeMin: task.fixed_time_min,
    createdAt: task.created_at,
    deadlineAt: task.has_deadline ? task.deadline_at : null,
    status: task.status,
  };
}

function mapSession(session: SessionRecord): PlannedSession {
  const start = localDateTimeToMinutes(session.start_at);
  const end = localDateTimeToMinutes(session.end_at);
  return {
    id: session.id,
    taskId: session.task_id,
    date: session.date || start.date,
    startMin: start.minute,
    endMin: end.minute,
    durationMin: session.planned_minutes,
    status: session.status,
    isLocked: session.is_locked === 1,
  };
}

export async function rebuildSchedule(
  reason: ScheduleReason = 'manual_rebuild',
  now = new Date(),
): Promise<ScheduleResult> {
  const database = getDatabase();
  const [tasks, sessions, timetable, fixedActivities, windows, skippedDates, settingsRows] = await Promise.all([
    listTasks(),
    listSessions(),
    listTimetableActivities(),
    listFixedActivities(),
    listTimeWindows(),
    listSkippedDates(),
    database.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings'),
  ]);
  const settingMap = Object.fromEntries(settingsRows.map(item => [item.key, item.value]));
  const recurringTaskIds = tasks.filter(task => task.is_recurring_daily === 1).map(task => task.id);
  const numberSetting = (key: string, fallback: number) => {
    const value = Number(settingMap[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  const context = {
    timetable: timetable.filter(item => item.is_active).map(item => ({
      dayOfWeek: item.day_of_week,
      startMin: item.start_min,
      endMin: item.end_min,
      title: item.title,
    })),
    fixedActivities: fixedActivities.map(item => ({
      date: item.date,
      startMin: item.start_min,
      endMin: item.end_min,
      title: item.title,
    })),
    windows: windows.filter(item => item.is_active).map(item => ({
      dayOfWeek: item.day_of_week,
      startMin: item.start_min,
      endMin: item.end_min,
      kind: item.kind,
    })),
    skippedDates,
    existingSessions: sessions
      .filter(session => !(session.status === 'planned' && recurringTaskIds.includes(session.task_id)))
      .map(mapSession),
    settings: {
      ...DEFAULT_SCHEDULER_SETTINGS,
      horizonDays: numberSetting('scheduling_horizon_days', DEFAULT_SCHEDULER_SETTINGS.horizonDays),
      minSessionMinutes: numberSetting('min_session_minutes', DEFAULT_SCHEDULER_SETTINGS.minSessionMinutes),
      bufferMinutes: numberSetting('buffer_minutes', DEFAULT_SCHEDULER_SETTINGS.bufferMinutes),
    },
  };

  const result = scheduleTasks(tasks.map(mapTask), context, now);
  const previousPlanned = sessions.filter(item => item.status === 'planned' && item.is_locked === 0).map(mapSession);
  const nextPlanned = result.sessions.filter(item => item.status === 'planned' && !item.isLocked);
  const previousByTask = new Map<string, PlannedSession[]>();
  const nextByTask = new Map<string, PlannedSession[]>();
  for (const item of previousPlanned) {
    const group = previousByTask.get(item.taskId) ?? [];
    group.push(item);
    previousByTask.set(item.taskId, group);
  }
  for (const item of nextPlanned) {
    const group = nextByTask.get(item.taskId) ?? [];
    group.push(item);
    nextByTask.set(item.taskId, group);
  }
  const moved: NonNullable<ScheduleResult['changes']>['moved'] = [];
  let added = 0;
  let removed = 0;
  for (const taskId of new Set([...previousByTask.keys(), ...nextByTask.keys()])) {
    const previous = (previousByTask.get(taskId) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
    const next = (nextByTask.get(taskId) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
    const paired = Math.min(previous.length, next.length);
    for (let index = 0; index < paired; index += 1) {
      if (previous[index].date !== next[index].date || previous[index].startMin !== next[index].startMin) {
        moved.push({
          taskId,
          fromDate: previous[index].date,
          fromStartMin: previous[index].startMin,
          toDate: next[index].date,
          toStartMin: next[index].startMin,
        });
      }
    }
    removed += Math.max(0, previous.length - next.length);
    added += Math.max(0, next.length - previous.length);
  }
  result.changes = { added, removed, moved };
  const planned = result.sessions.filter(item => item.status === 'planned');
  const byTask = new Map<string, PlannedSession[]>();
  for (const session of planned) {
    const group = byTask.get(session.taskId) ?? [];
    group.push(session);
    byTask.set(session.taskId, group);
  }

  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM sessions WHERE status = 'planned' AND is_locked = 0");
    for (const taskId of recurringTaskIds) {
      await database.runAsync("DELETE FROM sessions WHERE task_id = ? AND status = 'planned'", taskId);
    }
    for (const [taskId, taskSessions] of byTask) {
      taskSessions.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
      for (let index = 0; index < taskSessions.length; index += 1) {
        const item = taskSessions[index];
        const startAt = formatLocalDateTime(item.date, item.startMin);
        const endAt = formatLocalDateTime(item.date, item.endMin);
        await database.runAsync(
          `INSERT INTO sessions (id, task_id, date, start_at, end_at, planned_minutes, actual_minutes, status, is_locked, session_index)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'planned', ?, ?)
           ON CONFLICT(id) DO UPDATE SET date = excluded.date, start_at = excluded.start_at,
             end_at = excluded.end_at, planned_minutes = excluded.planned_minutes,
             is_locked = excluded.is_locked, session_index = excluded.session_index`,
          item.id,
          taskId,
          item.date,
          startAt,
          endAt,
          item.durationMin,
          item.isLocked ? 1 : 0,
          index + 1,
        );
      }
    }
    const warningTaskIds = new Set(result.warnings.map(warning => warning.taskId));
    for (const task of tasks) {
      if (task.status === 'completed' || task.is_recurring_daily === 1) continue;
      await database.runAsync(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
        warningTaskIds.has(task.id) ? 'unschedulable' : 'pending',
        now.toISOString(),
        task.id,
      );
    }
    await database.runAsync(
      'INSERT INTO schedule_log (id, timestamp, reason, summary_json) VALUES (?, ?, ?, ?)',
      Crypto.randomUUID(),
      now.toISOString(),
      reason,
      JSON.stringify({ changes: result.changes, warnings: result.warnings }),
    );
  });
  try {
    await syncSessionReminders(result.sessions, tasks, now);
  } catch (error) {
    await database.runAsync(
      `INSERT INTO settings (key, value) VALUES ('notification_last_error', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      error instanceof Error ? error.message : String(error),
    );
    console.error('Could not refresh scheduled reminders', error);
  }
  return result;
}

export async function markPastSessionsMissed(now = new Date()): Promise<number> {
  const db = getDatabase();
  const rows = await db.getAllAsync<SessionRecord>(
    "SELECT * FROM sessions WHERE status = 'planned' ORDER BY end_at",
  );
  const missed = rows.filter(session => new Date(session.end_at).getTime() < now.getTime());
  if (!missed.length) return 0;

  await db.withTransactionAsync(async () => {
    for (const session of missed) {
      await db.runAsync("UPDATE sessions SET status = 'missed' WHERE id = ?", session.id);
      const task = await db.getFirstAsync<TaskRecord>('SELECT * FROM tasks WHERE id = ?', session.task_id);
      if (task && task.status !== 'completed' && task.is_recurring_daily !== 1) {
        await db.runAsync(
          "UPDATE tasks SET status = 'pending', updated_at = ? WHERE id = ?",
          now.toISOString(),
          task.id,
        );
      }
      if (task?.is_recurring_daily === 1) {
        await db.runAsync(
          "INSERT INTO task_occurrences (id, task_id, date, status, completed_at) VALUES (?, ?, ?, 'missed', NULL) ON CONFLICT(task_id, date) DO UPDATE SET status = 'missed'",
          `occurrence-${task.id}-${session.date}`,
          task.id,
          session.date,
        );
      }
    }
  });
  await rebuildSchedule('missed', now);
  return missed.length;
}

export async function getTaskSessions(taskId: string): Promise<SessionRecord[]> {
  return listSessions(taskId);
}

export function todayKey(now = new Date()) {
  return toDateKey(now);
}
