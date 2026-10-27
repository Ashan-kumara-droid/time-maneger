import { describe, expect, it } from '@jest/globals';

import { partitionFreeTime } from '../freeTime';

describe('configured free-time preferences', () => {
  it('keeps preferred periods distinct and clips them around commitments', () => {
    expect(partitionFreeTime(
      [{ start: 600, end: 660 }],
      [{ id: 'pref', start: 540, end: 720, preferences: 'Study' }],
      480,
      780,
    )).toEqual([
      { start: 480, end: 540, kind: 'available', label: 'Available time' },
      { start: 540, end: 600, kind: 'preferred', label: 'Study' },
      { start: 660, end: 720, kind: 'preferred', label: 'Study' },
      { start: 720, end: 780, kind: 'available', label: 'Available time' },
    ]);
  });

  it('does not turn invalid or fully blocked preferences into free time', () => {
    expect(partitionFreeTime(
      [{ start: 480, end: 780 }],
      [
        { id: 'blocked', start: 540, end: 600, preferences: 'Read' },
        { id: 'invalid', start: 700, end: 650, preferences: 'Invalid' },
      ],
      480,
      780,
    )).toEqual([]);
  });
});
