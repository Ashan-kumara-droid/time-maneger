import { describe, expect, test } from '@jest/globals';
import { assertNoSessionOverlaps } from '../conflicts';
import { buildAvailability } from '../buildAvailability';
import { scheduleTasks } from '../scheduleTasks';
import { splitTask } from '../splitTask';
import { DEFAULT_SCHEDULER_SETTINGS, ScheduleContext, SchedulerTask } from '../types';

const now = new Date(2026, 9, 26, 7, 0, 0);

function makeContext(overrides: Partial<ScheduleContext> = {}): ScheduleContext {
  return {
    timetable: [],
    fixedActivities: [],
    windows: [],
    skippedDates: [],
    existingSessions: [],
    settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 2, activeStartMin: 360, activeEndMin: 1380, bufferMinutes: 0 },
    ...overrides,
  };
}

function makeTask(overrides: Partial<SchedulerTask> = {}): SchedulerTask {
  return {
    id: 'task-1',
    title: 'Read chapter',
    kind: 'focus',
    priority: 'medium',
    remainingMinutes: 60,
    createdAt: '2026-10-25T12:00:00',
    deadlineAt: null,
    status: 'pending',
    ...overrides,
  };
}

describe('splitTask', () => {
  test('splits a three-hour task across 120 and 60 minute slots', () => {
    expect(splitTask(180, [120, 60], 25, 120)).toEqual([120, 60]);
  });

  test('rebalances a tiny leftover so all sessions meet the minimum', () => {
    const result = splitTask(130, [120, 60], 25, 120);
    expect(result).toEqual([105, 25]);
    expect(result.reduce((sum, chunk) => sum + chunk, 0)).toBe(130);
    expect(result.every(chunk => chunk >= 25 && chunk <= 120)).toBe(true);
  });

  test('respects max session size', () => {
    expect(splitTask(240, [240], 25, 60)).toEqual([60, 60, 60, 60]);
  });
});

describe('availability and scheduling', () => {
  test('subtracts recurring and one-off fixed commitments with buffer', () => {
    const context = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 360, activeEndMin: 1380, bufferMinutes: 5 },
      timetable: [{ dayOfWeek: 0, startMin: 600, endMin: 720 }],
      fixedActivities: [{ date: '2026-10-26', startMin: 780, endMin: 840 }],
    });
    const slots = buildAvailability(context, now);
    expect(slots.some(slot => slot.date === '2026-10-26' && slot.startMin < 595 && slot.endMin > 725)).toBe(false);
    expect(slots.some(slot => slot.date === '2026-10-26' && slot.startMin < 775 && slot.endMin > 845)).toBe(false);
  });

  test('travel-kind tasks use travel windows, and focus tasks avoid them', () => {
    const context = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 600, activeEndMin: 840, bufferMinutes: 0 },
      windows: [{ dayOfWeek: 0, startMin: 720, endMin: 780, kind: 'travel' }],
    });
    const travelResult = scheduleTasks([makeTask({ id: 'travel', kind: 'travel', remainingMinutes: 30 })], context, now);
    const focusResult = scheduleTasks([makeTask({ id: 'focus', kind: 'focus', remainingMinutes: 30 })], context, now);
    expect(travelResult.sessions[0]).toMatchObject({ startMin: 720, endMin: 750 });
    expect(focusResult.sessions[0].startMin).not.toBeGreaterThanOrEqual(720);
    expect(focusResult.sessions[0].endMin).toBeLessThanOrEqual(720);
  });

  test('places higher priorities and earlier deadlines first', () => {
    const context = makeContext({ settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 600, activeEndMin: 660, bufferMinutes: 0 } });
    const low = makeTask({ id: 'low', priority: 'low', remainingMinutes: 60 });
    const high = makeTask({ id: 'high', priority: 'high', remainingMinutes: 60 });
    const result = scheduleTasks([low, high], context, now);
    expect(result.sessions.find(session => session.taskId === 'high')?.startMin).toBe(600);
    expect(result.unscheduledMinutes.low).toBe(60);

    const earlier = makeTask({ id: 'earlier', priority: 'medium', deadlineAt: '2026-10-26T12:00:00', remainingMinutes: 60 });
    const later = makeTask({ id: 'later', priority: 'medium', deadlineAt: '2026-10-27T12:00:00', remainingMinutes: 60 });
    const deadlineResult = scheduleTasks([later, earlier], context, now);
    expect(deadlineResult.sessions.find(session => session.taskId === 'earlier')?.startMin).toBe(600);
  });

  test('does not schedule a session after its deadline and reports the shortfall', () => {
    const context = makeContext({ settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 600, activeEndMin: 660, bufferMinutes: 0 } });
    const result = scheduleTasks([
      makeTask({ deadlineAt: '2026-10-26T10:30:00', remainingMinutes: 60 }),
    ], context, now);
    expect(result.sessions).toHaveLength(0);
    expect(result.warnings[0].shortfallMinutes).toBe(60);
  });

  test('splits tasks over eligible slots and is deterministic', () => {
    const context = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 1, activeStartMin: 600, activeEndMin: 780, bufferMinutes: 0 },
      timetable: [
        { dayOfWeek: 0, startMin: 600, endMin: 660 },
        { dayOfWeek: 1, startMin: 660, endMin: 780 },
      ],
    });
    const task = makeTask({ remainingMinutes: 180 });
    const first = scheduleTasks([task], context, now);
    const second = scheduleTasks([task], context, now);
    expect(first.sessions.map(item => item.durationMin)).toEqual([120, 60]);
    expect(second).toEqual(first);
  });

  test('skips holidays and filters slots shorter than the minimum', () => {
    const holiday = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 600, activeEndMin: 620, minSessionMinutes: 25 },
      skippedDates: ['2026-10-26'],
    });
    expect(buildAvailability(holiday, now)).toHaveLength(0);
    const tooShort = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 600, activeEndMin: 620, minSessionMinutes: 25 },
    });
    expect(buildAvailability(tooShort, now)).toHaveLength(0);
  });

  test('keeps locked sessions and validates no overlaps', () => {
    const fixedSession = {
      id: 'locked',
      taskId: 'locked-task',
      date: '2026-10-26',
      startMin: 600,
      endMin: 660,
      durationMin: 60,
      status: 'planned' as const,
      isLocked: true,
    };
    const context = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 0, activeStartMin: 600, activeEndMin: 720, bufferMinutes: 0 },
      existingSessions: [fixedSession],
    });
    const result = scheduleTasks([makeTask()], context, now);
    expect(result.sessions.find(session => session.id === 'locked')).toEqual(fixedSession);
    assertNoSessionOverlaps(result.sessions);
  });

  test('does not auto-schedule additional work beyond a manually locked session', () => {
    const fixedSession = {
      id: 'study-session',
      taskId: 'task-1',
      date: '2026-10-26',
      startMin: 600,
      endMin: 660,
      durationMin: 60,
      status: 'planned' as const,
      isLocked: true,
    };
    const result = scheduleTasks(
      [makeTask({ remainingMinutes: 60 })],
      makeContext({ existingSessions: [fixedSession] }),
      now,
    );
    expect(result.sessions).toEqual([fixedSession]);
    expect(result.warnings).toEqual([]);
  });

  test('keeps recurring tasks fixed at their daily time', () => {
    const context = makeContext({
      settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 1, activeStartMin: 360, activeEndMin: 1380, bufferMinutes: 0 },
    });
    const recurring = makeTask({ id: 'daily', isRecurringDaily: true, fixedTimeMin: 480, estimatedMinutes: 30 });
    const result = scheduleTasks([recurring], context, now);
    expect(result.sessions.map(session => session.startMin)).toEqual([480, 480]);
    expect(result.sessions.every(session => session.isLocked)).toBe(true);
  });
});

test('handles a seeded set of task sizes without overlapping placements', () => {
  const context = makeContext({
    settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 7, activeStartMin: 600, activeEndMin: 900, bufferMinutes: 5 },
    timetable: [{ dayOfWeek: 0, startMin: 720, endMin: 780 }, { dayOfWeek: 2, startMin: 720, endMin: 780 }],
  });
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const tasks = Array.from({ length: 60 }, (_, index) => makeTask({
    id: `generated-${index}`,
    kind: random() > 0.5 ? 'focus' : 'travel',
    priority: random() > 0.66 ? 'high' : random() > 0.33 ? 'medium' : 'low',
    remainingMinutes: 25 + Math.floor(random() * 180),
  }));
  const result = scheduleTasks(tasks, context, now);
  expect(() => assertNoSessionOverlaps(result.sessions)).not.toThrow();
});

test('plans 200 tasks across a 30-day horizon within 300 ms', () => {
  const context = makeContext({
    settings: { ...DEFAULT_SCHEDULER_SETTINGS, horizonDays: 30, activeStartMin: 360, activeEndMin: 1380 },
  });
  const tasks = Array.from({ length: 200 }, (_, index) => makeTask({
    id: `load-${index}`,
    remainingMinutes: 45 + index % 150,
    priority: (['high', 'medium', 'low'] as const)[index % 3],
  }));
  const start = Date.now();
  const result = scheduleTasks(tasks, context, now);
  expect(Date.now() - start).toBeLessThan(300);
  expect(() => assertNoSessionOverlaps(result.sessions)).not.toThrow();
});
