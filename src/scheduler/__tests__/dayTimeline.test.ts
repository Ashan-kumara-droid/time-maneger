import { describe, expect, it } from '@jest/globals';

import { getAvailableRanges, getRangeDuration } from '../dayTimeline';

describe('daily availability', () => {
  it('merges overlapping commitments without double-counting them', () => {
    const ranges = getAvailableRanges(
      [{ start: 540, end: 660 }, { start: 600, end: 720 }],
      480,
      780,
    );

    expect(ranges).toEqual([{ start: 480, end: 540 }, { start: 720, end: 780 }]);
    expect(getRangeDuration(ranges)).toBe(120);
  });

  it('clips commitments to the active day and preserves all open gaps', () => {
    const ranges = getAvailableRanges(
      [{ start: 300, end: 540 }, { start: 600, end: 660 }, { start: 1380, end: 1500 }],
      360,
      1380,
    );

    expect(ranges).toEqual([{ start: 540, end: 600 }, { start: 660, end: 1380 }]);
    expect(getRangeDuration(ranges)).toBe(780);
  });

  it('returns no ranges for invalid day bounds', () => {
    expect(getAvailableRanges([{ start: 30, end: 60 }], 60, 60)).toEqual([]);
    expect(getAvailableRanges([{ start: 30, end: 60 }], Number.NaN, 120)).toEqual([]);
  });
});
