import { fromDateKey, toDateKey } from './dateUtils';
import { getAvailableRanges, getRangeDuration } from './dayTimeline';
import type { SessionRecord } from '@/src/db/repositories/sessionRepository';
import type { TaskRecord } from '@/src/db/repositories/taskRepository';
import type { FixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import type { TimetableActivity } from '@/src/db/repositories/timetableRepository';

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export type AnalyticsRange = {
  start: string;
  end: string;
};

export type CategorySummary = {
  category: string;
  plannedMinutes: number;
  completedMinutes: number;
};

export type AnalyticsSummary = {
  range: AnalyticsRange;
  scheduledCount: number;
  completedCount: number;
  pendingCount: number;
  missedCount: number;
  scheduledMinutes: number;
  completedMinutes: number;
  fixedMinutes: number;
  freeMinutes: number;
  travelMinutes: number;
  overdueTasks: number;
  dailyActivityMinutes: DailyActivityMinutes[];
  categories: CategorySummary[];
};

export type DailyActivityMinutes = {
  date: string;
  fixedMinutes: number;
  freeMinutes: number;
  taskMinutes: number;
};

export function getAnalyticsRange(anchor: Date, period: AnalyticsPeriod): AnalyticsRange {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  let end = new Date(start);

  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  }

  return { start: toDateKey(start), end: toDateKey(end) };
}

export function shiftAnalyticsAnchor(anchor: Date, period: AnalyticsPeriod, amount: number): Date {
  if (period === 'month') {
    return new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1);
  }
  const shifted = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  shifted.setDate(shifted.getDate() + amount * (period === 'week' ? 7 : 1));
  return shifted;
}

export function summarizeAnalytics(
  sessions: SessionRecord[],
  tasks: TaskRecord[],
  range: AnalyticsRange,
  now = new Date(),
  weeklyActivities: TimetableActivity[] = [],
  fixedActivities: FixedActivity[] = [],
): AnalyticsSummary {
  const inRange = sessions.filter(session =>
    session.date >= range.start && session.date <= range.end && session.status !== 'skipped',
  );
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const categories = new Map<string, CategorySummary>();
  let scheduledMinutes = 0;
  let completedMinutes = 0;
  let travelMinutes = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let missedCount = 0;

  for (const session of inRange) {
    if (session.status === 'missed') {
      missedCount += 1;
      continue;
    }
    scheduledMinutes += session.planned_minutes;
    const isDone = session.status === 'done';
    if (isDone) {
      completedCount += 1;
      completedMinutes += session.actual_minutes ?? session.planned_minutes;
    } else {
      pendingCount += 1;
    }

    const category = taskById.get(session.task_id)?.category ?? 'other';
    const task = taskById.get(session.task_id);
    if (task?.kind === 'travel') {
      travelMinutes += isDone ? session.actual_minutes ?? session.planned_minutes : session.planned_minutes;
    }
    const summary = categories.get(category) ?? {
      category,
      plannedMinutes: 0,
      completedMinutes: 0,
    };
    summary.plannedMinutes += session.planned_minutes;
    if (isDone) summary.completedMinutes += session.actual_minutes ?? session.planned_minutes;
    categories.set(category, summary);
  }

  const overdueTasks = tasks.filter(task => {
    if (task.status === 'completed' || task.has_deadline !== 1 || !task.deadline_at) return false;
    const deadline = new Date(task.deadline_at);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() >= now.getTime()) return false;
    const deadlineDate = toDateKey(deadline);
    return deadlineDate >= range.start && deadlineDate <= range.end;
  }).length;

  let fixedMinutes = 0;
  let freeMinutes = 0;
  const dailyActivityMinutes: DailyActivityMinutes[] = [];
  const lastDate = fromDateKey(range.end);
  for (let date = fromDateKey(range.start); date <= lastDate; date.setDate(date.getDate() + 1)) {
    const dateKey = toDateKey(date);
    const dayOfWeek = (date.getDay() + 6) % 7;
    const previousDayOfWeek = (dayOfWeek + 6) % 7;
    const recurring = weeklyActivities
      .filter(activity => activity.day_of_week === dayOfWeek && activity.is_active)
      .map(activity => ({ start: activity.start_min, end: Math.min(1440, activity.end_min) }));
    const recurringOvernight = weeklyActivities
      .filter(activity => activity.day_of_week === previousDayOfWeek && activity.is_active && activity.end_min > 1440)
      .map(activity => ({ start: 0, end: Math.min(1440, activity.end_min - 1440) }));
    const dated = fixedActivities
      .filter(activity => activity.date === dateKey)
      .map(activity => ({ start: activity.start_min, end: Math.min(1440, activity.end_min) }));
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const datedOvernight = fixedActivities
      .filter(activity => activity.date === toDateKey(previousDate) && activity.end_min > 1440)
      .map(activity => ({ start: 0, end: Math.min(1440, activity.end_min - 1440) }));
    const fixedRanges = [...recurring, ...recurringOvernight, ...dated, ...datedOvernight];
    const dayFixedMinutes = 1020 - getRangeDuration(getAvailableRanges(fixedRanges, 360, 1380));

    const sessionRanges = sessions
      .filter(session => {
        if (session.status === 'skipped' || session.status === 'missed') return false;
        const startDate = session.date || toDateKey(new Date(session.start_at));
        const endDate = toDateKey(new Date(session.end_at));
        return startDate === dateKey || (startDate < dateKey && endDate >= dateKey);
      })
      .map(session => {
        const startAt = new Date(session.start_at);
        const endAt = new Date(session.end_at);
        const startDate = toDateKey(startAt);
        return {
          start: startDate === dateKey ? startAt.getHours() * 60 + startAt.getMinutes() : 0,
          end: toDateKey(endAt) === dateKey ? endAt.getHours() * 60 + endAt.getMinutes() : 1440,
        };
      });
    const dayTaskMinutes = getRangeDuration(getAvailableRanges(fixedRanges, 360, 1380))
      - getRangeDuration(getAvailableRanges([...fixedRanges, ...sessionRanges], 360, 1380));
    const dayFreeMinutes = getRangeDuration(getAvailableRanges([...fixedRanges, ...sessionRanges], 360, 1380));
    fixedMinutes += dayFixedMinutes;
    freeMinutes += dayFreeMinutes;
    dailyActivityMinutes.push({
      date: dateKey,
      fixedMinutes: dayFixedMinutes,
      freeMinutes: dayFreeMinutes,
      taskMinutes: dayTaskMinutes,
    });
  }

  return {
    range,
    scheduledCount: completedCount + pendingCount + missedCount,
    completedCount,
    pendingCount,
    missedCount,
    scheduledMinutes,
    completedMinutes,
    fixedMinutes,
    freeMinutes,
    travelMinutes,
    overdueTasks,
    dailyActivityMinutes,
    categories: [...categories.values()].sort((a, b) => b.plannedMinutes - a.plannedMinutes),
  };
}

export function getDatesInRange(range: AnalyticsRange): string[] {
  const dates: string[] = [];
  const end = fromDateKey(range.end);
  for (let date = fromDateKey(range.start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(toDateKey(date));
  }
  return dates;
}
