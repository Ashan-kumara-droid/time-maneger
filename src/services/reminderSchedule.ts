import { addDays, getWeekdayMondayZero, toDateKey } from '@/src/scheduler/dateUtils';
import type { FixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import type { TaskRecord } from '@/src/db/repositories/taskRepository';
import type { TimetableActivity } from '@/src/db/repositories/timetableRepository';
import type { PlannedSession } from '@/src/scheduler/types';

export type ReminderCandidate = {
  key: string;
  title: string;
  startsAt: Date;
};

export function buildReminderCandidates(
  sessions: PlannedSession[],
  tasks: TaskRecord[],
  timetable: TimetableActivity[],
  fixedActivities: FixedActivity[],
  now: Date,
): ReminderCandidate[] {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const candidates: ReminderCandidate[] = sessions
    .filter(session => session.status === 'planned')
    .flatMap(session => {
      const task = taskById.get(session.taskId);
      if (!task || (task.linked_study_type && task.reminder_enabled === 0)) return [];
      return [{
        key: session.id,
        title: task.title,
        startsAt: new Date(
          `${session.date}T${String(Math.floor(session.startMin / 60)).padStart(2, '0')}:${String(session.startMin % 60).padStart(2, '0')}:00`,
        ),
      }];
    });

  for (const activity of fixedActivities) {
    candidates.push({
      key: `fixed:${activity.id}`,
      title: activity.title,
      startsAt: new Date(
        `${activity.date}T${String(Math.floor(activity.start_min / 60)).padStart(2, '0')}:${String(activity.start_min % 60).padStart(2, '0')}:00`,
      ),
    });
  }

  for (let dayOffset = 0; dayOffset <= 30; dayOffset += 1) {
    const date = addDays(now, dayOffset);
    const dateKey = toDateKey(date);
    const weekday = getWeekdayMondayZero(date);
    for (const activity of timetable) {
      if (activity.day_of_week !== weekday || activity.is_active !== 1) continue;
      candidates.push({
        key: `weekly:${activity.id}:${dateKey}`,
        title: activity.title,
        startsAt: new Date(
          `${dateKey}T${String(Math.floor(activity.start_min / 60)).padStart(2, '0')}:${String(activity.start_min % 60).padStart(2, '0')}:00`,
        ),
      });
    }
  }

  return candidates.filter(candidate => !Number.isNaN(candidate.startsAt.getTime()));
}
