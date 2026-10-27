import { getWeekdayMondayZero, fromDateKey, toDateKey } from './dateUtils';
import type { StudyTaskType } from './studyDeadlines';

export type StudyBusyBlock = {
  date?: string;
  dayOfWeek?: number;
  startMin: number;
  endMin: number;
  title: string;
};

export type StudyScheduleCheck = {
  error: string | null;
  alternatives: number[];
};

type StudyScheduleInput = {
  studyType: StudyTaskType;
  studyDate: string;
  startMin: number;
  durationMin: number;
  lectureDay: number;
  lectureStartMin: number;
  lectureEndMin: number;
  busy: StudyBusyBlock[];
  now?: Date;
};

function evaluate(input: StudyScheduleInput, now: Date): string | null {
  const date = fromDateKey(input.studyDate);
  const endMin = input.startMin + input.durationMin;
  if (!Number.isInteger(input.startMin) || !Number.isInteger(input.durationMin)
    || input.durationMin < 5 || input.startMin < 0 || endMin > 1440) {
    return 'Choose a valid start time and a duration of at least 5 minutes that ends before midnight.';
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date < today || (toDateKey(date) === toDateKey(now) && input.startMin <= now.getHours() * 60 + now.getMinutes())) {
    return 'Choose a study session start time in the future.';
  }

  if (getWeekdayMondayZero(date) === input.lectureDay) {
    if (input.studyType === 'preparation' && endMin > input.lectureStartMin) {
      return 'Preparation must finish before the lecture starts.';
    }
    if (input.studyType === 'revision' && input.startMin < input.lectureEndMin) {
      return 'Revision must start after the lecture ends.';
    }
  }

  const weekday = getWeekdayMondayZero(date);
  const conflict = input.busy.find(block =>
    (block.date === input.studyDate || (block.dayOfWeek !== undefined && block.dayOfWeek === weekday))
    && input.startMin < block.endMin
    && endMin > block.startMin,
  );
  return conflict ? `This time conflicts with “${conflict.title}”.` : null;
}

export function checkStudySchedule(input: StudyScheduleInput): StudyScheduleCheck {
  const now = input.now ?? new Date();
  const error = evaluate(input, now);
  if (!error || error.startsWith('Choose a valid') || error.startsWith('Choose a study')) {
    return { error, alternatives: [] };
  }

  const date = fromDateKey(input.studyDate);
  const earliest = toDateKey(date) === toDateKey(now)
    ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15
    : 360;
  const candidates: number[] = [];
  for (let minute = Math.max(360, earliest); minute + input.durationMin <= 1380; minute += 15) {
    if (!evaluate({ ...input, startMin: minute }, now)) candidates.push(minute);
  }
  candidates.sort((a, b) => Math.abs(a - input.startMin) - Math.abs(b - input.startMin));
  return { error, alternatives: candidates.slice(0, 3).sort((a, b) => a - b) };
}

export function formatStudyAlternatives(minutes: number[]): string {
  return minutes.map(minute =>
    `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
  ).join(', ');
}
