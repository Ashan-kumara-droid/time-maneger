import { getAvailableRanges } from './dayTimeline';

export type FreeTimePreference = {
  id: string;
  start: number;
  end: number;
  preferences: string;
};

export type FreeTimeSegment = {
  start: number;
  end: number;
  kind: 'preferred' | 'available';
  label: string;
};

export function partitionFreeTime(
  busyRanges: { start: number; end: number }[],
  preferences: FreeTimePreference[],
  dayStart: number,
  dayEnd: number,
): FreeTimeSegment[] {
  const available = getAvailableRanges(busyRanges, dayStart, dayEnd);
  const sortedPreferences = preferences
    .filter(item => item.end > item.start)
    .slice()
    .sort((a, b) => a.start - b.start);
  const segments: FreeTimeSegment[] = [];

  for (const gap of available) {
    let cursor = gap.start;
    for (const preference of sortedPreferences) {
      const start = Math.max(gap.start, preference.start);
      const end = Math.min(gap.end, preference.end);
      if (start >= end || end <= cursor) continue;
      if (start > cursor) {
        segments.push({ start: cursor, end: start, kind: 'available', label: 'Available time' });
      }
      const preferredStart = Math.max(cursor, start);
      if (preferredStart < end) {
        segments.push({
          start: preferredStart,
          end,
          kind: 'preferred',
          label: preference.preferences.trim() || 'Preferred free time',
        });
        cursor = end;
      }
    }
    if (cursor < gap.end) {
      segments.push({ start: cursor, end: gap.end, kind: 'available', label: 'Available time' });
    }
  }

  return segments;
}
