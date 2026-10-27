import type { TimetableActivity } from '@/src/db/repositories/timetableRepository';

export type StudyTaskType = 'preparation' | 'revision';

export function getSuggestedStudyDeadline(
  activity: Pick<TimetableActivity, 'day_of_week' | 'start_min'>,
  studyType: StudyTaskType,
  now: Date,
): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayDay = (today.getDay() + 6) % 7;
  let daysUntilLecture = (activity.day_of_week - mondayDay + 7) % 7;
  if (daysUntilLecture === 0 && activity.start_min <= now.getHours() * 60 + now.getMinutes()) {
    daysUntilLecture = 7;
  }
  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + daysUntilLecture);

  if (studyType === 'revision') {
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(23, 59, 0, 0);
  } else {
    deadline.setHours(Math.floor(activity.start_min / 60), activity.start_min % 60, 0, 0);
  }
  return deadline;
}
