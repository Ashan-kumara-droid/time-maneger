import { describe, expect, it } from '@jest/globals';

import { getSuggestedStudyDeadline } from '../studyDeadlines';

describe('lecture study task deadlines', () => {
  it('sets preparation due at the next lecture start', () => {
    const deadline = getSuggestedStudyDeadline(
      { day_of_week: 2, start_min: 9 * 60 + 30 },
      'preparation',
      new Date(2026, 9, 19, 10, 0),
    );

    expect(deadline).toEqual(new Date(2026, 9, 21, 9, 30));
  });

  it('sets revision due the day after the next lecture', () => {
    const deadline = getSuggestedStudyDeadline(
      { day_of_week: 2, start_min: 9 * 60 + 30 },
      'revision',
      new Date(2026, 9, 19, 10, 0),
    );

    expect(deadline).toEqual(new Date(2026, 9, 22, 23, 59));
  });

  it('moves to next week when today’s lecture has already started', () => {
    const deadline = getSuggestedStudyDeadline(
      { day_of_week: 0, start_min: 9 * 60 },
      'preparation',
      new Date(2026, 9, 19, 10, 0),
    );

    expect(deadline).toEqual(new Date(2026, 9, 26, 9, 0));
  });
});
