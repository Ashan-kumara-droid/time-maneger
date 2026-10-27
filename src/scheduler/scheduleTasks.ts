import { buildAvailability, subtractIntervalFromSlots } from './buildAvailability';
import { compareTasks } from './scoring';
import { addDays, formatLocalDateTime, getWeekdayMondayZero, minutesSinceMidnight, toDateKey } from './dateUtils';
import { assertNoSessionOverlaps } from './conflicts';
import {
  PlannedSession,
  ScheduleContext,
  ScheduleResult,
  SchedulerTask,
  Slot,
} from './types';

function createId(taskId: string, date: string, startMin: number, ordinal: number): string {
  return `${taskId}-${date}-${startMin}-${ordinal}`;
}

function deadlineAllows(task: SchedulerTask, slot: Slot): boolean {
  if (!task.deadlineAt) return true;
  const deadline = new Date(task.deadlineAt);
  const [year, month, day] = slot.date.split('-').map(Number);
  const slotDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(slotDate);
  end.setMinutes(slot.endMin);
  return end <= deadline;
}

export function scheduleTasks(
  tasks: SchedulerTask[],
  context: ScheduleContext,
  now: Date,
): ScheduleResult {
  const sessions: PlannedSession[] = context.existingSessions
    .filter(session => session.status !== 'planned' || session.isLocked)
    .map(session => ({ ...session }));
  let available = buildAvailability(context, now);

  const warnings: ScheduleResult['warnings'] = [];
  const unscheduledMinutes: Record<string, number> = {};
  const sortedTasks = tasks
    .filter(task => task.remainingMinutes > 0 && task.status !== 'completed' && !task.isRecurringDaily)
    .slice()
    .sort((a, b) => compareTasks(a, b, now));

  let ordinal = 0;
  const recurringTasks = tasks.filter(task =>
    task.isRecurringDaily && task.status !== 'completed' && task.fixedTimeMin !== null && task.fixedTimeMin !== undefined,
  );
  for (const task of recurringTasks) {
    let placed = false;
    for (let dayOffset = 0; dayOffset <= context.settings.horizonDays; dayOffset += 1) {
      const date = toDateKey(addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), dayOffset));
      if (context.existingSessions.some(session => session.taskId === task.id && session.date === date)) continue;
      const startMin = task.fixedTimeMin!;
      const duration = task.estimatedMinutes ?? task.remainingMinutes;
      const endMin = startMin + duration;
      if (dayOffset === 0 && endMin <= minutesSinceMidnight(now)) continue;
      const slot = available.find(candidate =>
        candidate.date === date
        && candidate.kind === task.kind
        && candidate.startMin <= startMin
        && candidate.endMin >= endMin,
      );
      if (!slot || endMin > context.settings.activeEndMin) continue;
      const session: PlannedSession = {
        id: `${task.id}-daily-${date}`,
        taskId: task.id,
        date,
        startMin,
        endMin,
        durationMin: duration,
        status: 'planned',
        isLocked: true,
      };
      sessions.push(session);
      available = subtractIntervalFromSlots(available, date, startMin, endMin + context.settings.bufferMinutes);
      placed = true;
    }
    if (!placed) {
      const shortfall = task.estimatedMinutes ?? task.remainingMinutes;
      warnings.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'NO_ELIGIBLE_SLOTS',
        shortfallMinutes: shortfall,
        suggestedActions: ['Choose another fixed time', 'Add an eligible time window', 'Change the activity schedule'],
      });
      unscheduledMinutes[task.id] = shortfall;
    }
  }

  for (const task of sortedTasks) {
    const pinnedMinutes = context.existingSessions
      .filter(session => session.taskId === task.id && session.status === 'planned' && session.isLocked)
      .reduce((total, session) => total + session.durationMin, 0);
    let remaining = Math.max(0, task.remainingMinutes - pinnedMinutes);
    while (remaining > 0) {
      const slot = available.find(candidate => {
        if (candidate.kind !== task.kind || !deadlineAllows(task, candidate)) return false;
        const capacity = candidate.endMin - candidate.startMin;
        return capacity >= context.settings.minSessionMinutes || capacity >= remaining;
      });
      if (!slot) break;
      const maxMinutes = task.kind === 'focus'
        ? context.settings.maxFocusSessionMinutes
        : context.settings.maxTravelSessionMinutes;
      const capacity = slot.endMin - slot.startMin;
      let chunk = Math.min(remaining, capacity, maxMinutes);
      const leftover = remaining - chunk;
      if (leftover > 0 && leftover < context.settings.minSessionMinutes) {
        const adjustment = Math.min(
          context.settings.minSessionMinutes - leftover,
          Math.floor((chunk - context.settings.minSessionMinutes) / 2),
        );
        if (adjustment > 0) chunk -= adjustment;
      }
      if (chunk < context.settings.minSessionMinutes && chunk < remaining) break;

      const session: PlannedSession = {
        id: createId(task.id, slot.date, slot.startMin, ordinal++),
        taskId: task.id,
        date: slot.date,
        startMin: slot.startMin,
        endMin: slot.startMin + chunk,
        durationMin: chunk,
        status: 'planned',
        isLocked: false,
      };
      sessions.push(session);
      available = subtractIntervalFromSlots(
        available,
        slot.date,
        slot.startMin,
        slot.startMin + chunk + context.settings.bufferMinutes,
      );
      remaining -= chunk;
    }

    if (remaining > 0) {
      unscheduledMinutes[task.id] = remaining;
      const hasEligibleSlot = available.some(slot => slot.kind === task.kind);
      warnings.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: task.deadlineAt ? 'NO_TIME_BEFORE_DEADLINE' : hasEligibleSlot ? 'OVERLOADED' : 'NO_ELIGIBLE_SLOTS',
        shortfallMinutes: remaining,
        suggestedActions: ['Add an eligible time window', 'Reduce the estimated duration', 'Move the deadline'],
      });
    }
  }

  assertNoSessionOverlaps(sessions);
  return {
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin),
    warnings,
    unscheduledMinutes,
  };
}

export function getMondayZero(date: Date): number {
  return getWeekdayMondayZero(date);
}

export function getMinuteForNow(date: Date): number {
  return minutesSinceMidnight(date);
}

export function getDateKey(date: Date): string {
  return toDateKey(date);
}

export function shiftDate(date: Date, days: number): Date {
  return addDays(date, days);
}

export function formatSessionBoundary(date: string, minute: number): string {
  return formatLocalDateTime(date, minute);
}
