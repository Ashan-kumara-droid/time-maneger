import { describe, expect, it } from '@jest/globals';

import { getAnalyticsRange, getDatesInRange, shiftAnalyticsAnchor, summarizeAnalytics } from '../analytics';
import type { SessionRecord } from '@/src/db/repositories/sessionRepository';
import type { TaskRecord } from '@/src/db/repositories/taskRepository';

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'study-task',
  title: 'Study',
  description: '',
  category: 'study',
  kind: 'focus',
  priority: 'medium',
  estimated_minutes: 60,
  remaining_minutes: 30,
  is_recurring_daily: 0,
  fixed_time_min: null,
  has_deadline: 0,
  deadline_at: null,
  status: 'in_progress',
  completed_at: null,
  created_at: '2026-01-01T00:00:00',
  ...overrides,
});

const session = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 'session-1',
  task_id: 'study-task',
  date: '2026-10-21',
  start_at: '2026-10-21T09:00',
  end_at: '2026-10-21T10:00',
  planned_minutes: 60,
  actual_minutes: null,
  status: 'planned',
  is_locked: 0,
  session_index: 1,
  ...overrides,
});

describe('analytics ranges and summaries', () => {
  it('creates Monday-based weeks and calendar-month ranges', () => {
    const anchor = new Date(2026, 9, 22);

    expect(getAnalyticsRange(anchor, 'week')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(getAnalyticsRange(anchor, 'month')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(shiftAnalyticsAnchor(anchor, 'month', -1)).toEqual(new Date(2026, 8, 1));
  });

  it('counts only explicit completion and uses actual duration when recorded', () => {
    const summary = summarizeAnalytics([
      session({ id: 'done', status: 'done', actual_minutes: 45 }),
      session({ id: 'pending', status: 'planned' }),
      session({ id: 'missed', status: 'missed' }),
      session({ id: 'skipped', status: 'skipped' }),
    ], [task()], { start: '2026-10-19', end: '2026-10-25' });

    expect(summary.scheduledCount).toBe(3);
    expect(summary.completedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.missedCount).toBe(1);
    expect(summary.scheduledMinutes).toBe(120);
    expect(summary.completedMinutes).toBe(45);
    expect(summary.categories).toEqual([{ category: 'study', plannedMinutes: 120, completedMinutes: 45 }]);
  });

  it('returns every date in the selected range for interactive daily detail', () => {
    expect(getDatesInRange({ start: '2026-10-19', end: '2026-10-21' }))
      .toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('does not double-count overlapping fixed activities when calculating time use', () => {
    const weekly = [
      { id: 'class-a', day_of_week: 0, start_min: 540, end_min: 660, title: 'Class A', type: 'Class', location: null, notes: null, color: null, is_active: 1 },
      { id: 'class-b', day_of_week: 0, start_min: 600, end_min: 720, title: 'Class B', type: 'Class', location: null, notes: null, color: null, is_active: 1 },
    ];

    const summary = summarizeAnalytics(
      [],
      [],
      { start: '2026-10-19', end: '2026-10-19' },
      new Date(2026, 9, 19),
      weekly,
    );

    expect(summary.fixedMinutes).toBe(180);
    expect(summary.freeMinutes).toBe(840);
  });

  it('keeps an overnight session in its start-date analytics and accounts for its continuation', () => {
    const summary = summarizeAnalytics([
      session({
        date: '2026-10-20',
        start_at: '2026-10-20T23:30',
        end_at: '2026-10-21T07:00',
        planned_minutes: 450,
      }),
    ], [task()], { start: '2026-10-20', end: '2026-10-21' });

    expect(summary.scheduledCount).toBe(1);
    expect(summary.scheduledMinutes).toBe(450);
    expect(summary.dailyActivityMinutes.find(day => day.date === '2026-10-21')?.taskMinutes).toBe(60);
  });
});
