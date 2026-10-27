export type BusyRange = {
  start: number;
  end: number;
};

export type AvailableRange = {
  start: number;
  end: number;
};

export function getAvailableRanges(
  busyRanges: BusyRange[],
  dayStart: number,
  dayEnd: number,
): AvailableRange[] {
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) {
    return [];
  }

  const sorted = busyRanges
    .filter(range => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .map(range => ({
      start: Math.max(dayStart, range.start),
      end: Math.min(dayEnd, range.end),
    }))
    .filter(range => range.start < range.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const available: AvailableRange[] = [];
  let cursor = dayStart;

  for (const range of sorted) {
    if (range.start > cursor) {
      available.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
    if (cursor >= dayEnd) break;
  }

  if (cursor < dayEnd) {
    available.push({ start: cursor, end: dayEnd });
  }

  return available;
}

export function getRangeDuration(ranges: AvailableRange[]): number {
  return ranges.reduce((total, range) => total + range.end - range.start, 0);
}
