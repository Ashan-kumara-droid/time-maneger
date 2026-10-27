import { addDays, getWeekdayMondayZero, toDateKey } from './dateUtils';
import { AvailabilityWindow, FixedBlock, ScheduleContext, Slot } from './types';

function subtractBlock(slots: Slot[], start: number, end: number, buffer: number) {
  const blockStart = Math.max(0, start - buffer);
  const blockEnd = Math.min(1440, end + buffer);
  const next: Slot[] = [];
  for (const slot of slots) {
    if (blockEnd <= slot.startMin || blockStart >= slot.endMin) {
      next.push(slot);
      continue;
    }
    if (blockStart > slot.startMin) next.push({ ...slot, endMin: blockStart });
    if (blockEnd < slot.endMin) next.push({ ...slot, startMin: blockEnd });
  }
  return next;
}

function intersectWindow(slot: Slot, window: AvailabilityWindow): Slot[] {
  const startMin = Math.max(slot.startMin, window.startMin);
  const endMin = Math.min(slot.endMin, window.endMin);
  return startMin < endMin ? [{ ...slot, startMin, endMin, kind: window.kind }] : [];
}

function mergeRanges(slots: Slot[]): Slot[] {
  const sorted = slots.slice().sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const merged: Slot[] = [];
  for (const slot of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.kind === slot.kind && slot.startMin <= previous.endMin) {
      previous.endMin = Math.max(previous.endMin, slot.endMin);
    } else {
      merged.push({ ...slot });
    }
  }
  return merged;
}

export function buildAvailability(context: ScheduleContext, now: Date, horizonDays = context.settings.horizonDays): Slot[] {
  const slots: Slot[] = [];
  const fixedByDate = new Map<string, Array<{ startMin: number; endMin: number }>>();
  const skipped = new Set(context.skippedDates);

  for (const block of context.fixedActivities) {
    const list = fixedByDate.get(block.date) ?? [];
    list.push(block);
    fixedByDate.set(block.date, list);
  }
  for (const session of context.existingSessions) {
    if (session.status !== 'done' && (session.status !== 'planned' || !session.isLocked)) continue;
    const list = fixedByDate.get(session.date) ?? [];
    list.push({ startMin: session.startMin, endMin: session.endMin });
    fixedByDate.set(session.date, list);
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    const dateKey = toDateKey(date);
    if (skipped.has(dateKey)) continue;
    const weekday = getWeekdayMondayZero(date);
    const previousWeekday = (weekday + 6) % 7;
    const previousDateKey = toDateKey(addDays(date, -1));
    const startLimit = dayOffset === 0
      ? Math.max(context.settings.activeStartMin, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5)
      : context.settings.activeStartMin;
    if (startLimit >= context.settings.activeEndMin) continue;

    let daySlots: Slot[] = [{
      date: dateKey,
      startMin: startLimit,
      endMin: context.settings.activeEndMin,
      kind: 'focus',
    }];
    const blocks = [
      ...context.timetable
        .filter(item => item.dayOfWeek === weekday && item.startMin < 1440)
        .map(item => ({ ...item, endMin: Math.min(item.endMin, 1440) })),
      ...context.timetable
        .filter(item => item.dayOfWeek === previousWeekday && item.endMin > 1440)
        .map(item => ({ startMin: 0, endMin: Math.min(1440, item.endMin - 1440) })),
      ...(fixedByDate.get(dateKey) ?? []).map(item => ({ ...item, endMin: Math.min(item.endMin, 1440) })),
      ...(fixedByDate.get(previousDateKey) ?? [])
        .filter(item => item.endMin > 1440)
        .map(item => ({ startMin: 0, endMin: Math.min(1440, item.endMin - 1440) })),
    ].sort((a, b) => a.startMin - b.startMin);
    for (const block of blocks) {
      daySlots = subtractBlock(daySlots, block.startMin, block.endMin, context.settings.bufferMinutes);
    }

    const dayTravelWindows = [
      ...context.windows.filter(window => window.dayOfWeek === weekday && window.kind === 'travel' && window.startMin < 1440)
        .map(window => ({ ...window, endMin: Math.min(window.endMin, 1440) })),
      ...context.windows.filter(window => window.dayOfWeek === previousWeekday && window.kind === 'travel' && window.endMin > 1440)
        .map(window => ({ ...window, startMin: 0, endMin: Math.min(1440, window.endMin - 1440) })),
    ];
    const classified = daySlots.flatMap(slot => {
      const travelParts = dayTravelWindows.flatMap(window => intersectWindow(slot, window));
      const coveredByTravel = mergeRanges(travelParts);
      const parts: Slot[] = [];
      let cursor = slot.startMin;
      for (const part of coveredByTravel) {
        if (part.startMin > cursor) parts.push({ ...slot, startMin: cursor, endMin: part.startMin, kind: 'focus' });
        parts.push(part);
        cursor = Math.max(cursor, part.endMin);
      }
      if (cursor < slot.endMin) parts.push({ ...slot, startMin: cursor, endMin: slot.endMin, kind: 'focus' });
      return parts;
    });
    slots.push(...classified.filter(slot => slot.endMin - slot.startMin >= context.settings.minSessionMinutes));
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.kind.localeCompare(b.kind));
}

export function subtractIntervalFromSlots(slots: Slot[], date: string, startMin: number, endMin: number): Slot[] {
  return slots.flatMap(slot => slot.date === date
    ? subtractBlock([slot], startMin, endMin, 0)
    : [slot]);
}
