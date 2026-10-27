export type TaskKind = 'focus' | 'travel';
export type Priority = 'high' | 'medium' | 'low';

export type SchedulerTask = {
  id: string;
  title: string;
  kind: TaskKind;
  priority: Priority;
  remainingMinutes: number;
  estimatedMinutes?: number;
  isRecurringDaily?: boolean;
  fixedTimeMin?: number | null;
  createdAt: string;
  deadlineAt: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'unschedulable';
};

export type FixedBlock = {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  title?: string;
};

export type DatedBlock = {
  date: string;
  startMin: number;
  endMin: number;
  title?: string;
};

export type AvailabilityWindow = {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  kind: TaskKind;
};

export type Slot = {
  date: string;
  startMin: number;
  endMin: number;
  kind: TaskKind;
};

export type PlannedSession = {
  id: string;
  taskId: string;
  date: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  status: 'planned' | 'done' | 'missed' | 'skipped';
  isLocked: boolean;
};

export type SchedulerSettings = {
  horizonDays: number;
  minSessionMinutes: number;
  maxFocusSessionMinutes: number;
  maxTravelSessionMinutes: number;
  bufferMinutes: number;
  activeStartMin: number;
  activeEndMin: number;
};

export type ScheduleContext = {
  timetable: FixedBlock[];
  fixedActivities: DatedBlock[];
  windows: AvailabilityWindow[];
  skippedDates: string[];
  existingSessions: PlannedSession[];
  settings: SchedulerSettings;
};

export type ScheduleWarning = {
  taskId: string;
  taskTitle: string;
  reason: 'NO_TIME_BEFORE_DEADLINE' | 'NO_ELIGIBLE_SLOTS' | 'OVERLOADED';
  shortfallMinutes: number;
  suggestedActions: string[];
};

export type ScheduleResult = {
  sessions: PlannedSession[];
  warnings: ScheduleWarning[];
  unscheduledMinutes: Record<string, number>;
  changes?: ScheduleChangeSummary;
};

export type ScheduleChangeSummary = {
  added: number;
  removed: number;
  moved: Array<{ taskId: string; fromDate: string; fromStartMin: number; toDate: string; toStartMin: number }>;
};

export const DEFAULT_SCHEDULER_SETTINGS: SchedulerSettings = {
  horizonDays: 30,
  minSessionMinutes: 25,
  maxFocusSessionMinutes: 120,
  maxTravelSessionMinutes: 60,
  bufferMinutes: 5,
  activeStartMin: 360,
  activeEndMin: 1380,
};
