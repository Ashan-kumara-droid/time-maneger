import { describe, expect, it } from '@jest/globals';

import { buildReminderCandidates } from '../reminderSchedule';
import type { FixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import type { TaskRecord } from '@/src/db/repositories/taskRepository';
import type { TimetableActivity } from '@/src/db/repositories/timetableRepository';

const task: TaskRecord = {
  id: 'task-1',
  title: 'Read notes',
  description: '',
  category: 'study',
  kind: 'focus',
  priority: 'medium',
  estimated_minutes: 30,
  remaining_minutes: 30,
  is_recurring_daily: 0,
  fixed_time_min: null,
  has_deadline: 0,
  deadline_at: null,
  status: 'pending',
  completed_at: null,
  created_at: '2026-01-01T00:00:00',
};

const weeklyActivity: TimetableActivity = {
  id: 'lecture-1',
  day_of_week: 3,
  start_min: 600,
  end_min: 660,
  title: 'Chemistry lecture',
  type: 'Lecture',
  location: null,
  notes: null,
  color: null,
  is_active: 1,
};

const fixedActivity: FixedActivity = {
  id: 'appointment-1',
  date: '2026-10-22',
  start_min: 720,
  end_min: 780,
  title: 'Appointment',
  notes: null,
  color: null,
};

describe('scheduled reminder candidates', () => {
  it('includes task sessions, dated activities and recurring activities without duplicating days', () => {
    const planned = [{
      id: 'session-1',
      taskId: task.id,
      date: '2026-10-22',
      status: 'planned',
      startMin: 540,
      endMin: 570,
      durationMin: 30,
      isLocked: false,
    } as const];

    const candidates = buildReminderCandidates(
      planned,
      [task],
      [weeklyActivity],
      [fixedActivity],
      new Date(2026, 9, 22, 8, 0),
    );

    expect(candidates.filter(candidate => candidate.key === 'session-1')).toHaveLength(1);
    expect(candidates.filter(candidate => candidate.key === 'fixed:appointment-1')).toHaveLength(1);
    expect(candidates.filter(candidate => candidate.key.startsWith('weekly:lecture-1:'))).toHaveLength(5);
  });

  it('does not generate recurring reminders for inactive schedule rows', () => {
    const candidates = buildReminderCandidates(
      [],
      [],
      [{ ...weeklyActivity, is_active: 0 }],
      [],
      new Date(2026, 9, 22, 8, 0),
    );

    expect(candidates).toEqual([]);
  });

  it('respects an individual lecture study session reminder preference', () => {
    const studyTask = {
      ...task,
      linked_activity_id: 'lecture-1',
      linked_study_type: 'preparation' as const,
      reminder_enabled: 0,
    };
    const candidates = buildReminderCandidates(
      [{
        id: 'study-session',
        taskId: studyTask.id,
        date: '2026-10-22',
        status: 'planned',
        startMin: 540,
        endMin: 570,
        durationMin: 30,
        isLocked: true,
      }],
      [studyTask],
      [],
      [],
      new Date(2026, 9, 22, 8, 0),
    );
    expect(candidates).toEqual([]);
  });
});
