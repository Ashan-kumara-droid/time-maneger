import { Priority, SchedulerTask } from './types';

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 100,
  medium: 50,
  low: 20,
};

export function scoreTask(task: SchedulerTask, now: Date): number {
  const created = new Date(task.createdAt);
  const ageDays = Number.isNaN(created.getTime())
    ? 0
    : Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
  let urgency = 0;
  if (task.deadlineAt) {
    const deadline = new Date(task.deadlineAt);
    if (!Number.isNaN(deadline.getTime())) {
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / 86_400_000;
      urgency = daysUntilDeadline < 0 ? 300 : Math.min(4, 1 / Math.max(daysUntilDeadline, 0.25)) * 60;
    }
  }
  return PRIORITY_WEIGHT[task.priority] + urgency + Math.min(ageDays, 14);
}

export function compareTasks(a: SchedulerTask, b: SchedulerTask, now: Date): number {
  const scoreDifference = scoreTask(b, now) - scoreTask(a, now);
  if (scoreDifference !== 0) return scoreDifference;
  if (a.deadlineAt && b.deadlineAt && a.deadlineAt !== b.deadlineAt) {
    return a.deadlineAt.localeCompare(b.deadlineAt);
  }
  if (a.deadlineAt && !b.deadlineAt) return -1;
  if (b.deadlineAt && !a.deadlineAt) return 1;
  return a.remainingMinutes - b.remainingMinutes || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
