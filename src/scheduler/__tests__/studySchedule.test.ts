import { describe, expect, it } from '@jest/globals';

import { checkStudySchedule } from '../studySchedule';

const now = new Date(2025, 2, 3, 8, 0);
const weeklyLecture = {
  lectureDay: 3,
  lectureStartMin: 600,
  lectureEndMin: 660,
  busy: [{ dayOfWeek: 3, startMin: 600, endMin: 660, title: 'Physics lecture' }],
};

describe('lecture study scheduling', () => {
  it('accepts preparation that ends before the next lecture', () => {
    expect(checkStudySchedule({
      ...weeklyLecture,
      studyType: 'preparation',
      studyDate: '2025-03-06',
      startMin: 570,
      durationMin: 20,
      now,
    }).error).toBeNull();
  });

  it('rejects preparation that overlaps the lecture and suggests free times', () => {
    const result = checkStudySchedule({
      ...weeklyLecture,
      studyType: 'preparation',
      studyDate: '2025-03-06',
      startMin: 590,
      durationMin: 20,
      now,
    });
    expect(result.error).toContain('Preparation must finish before');
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('rejects overlapping fixed activities and offers alternatives', () => {
    const result = checkStudySchedule({
      ...weeklyLecture,
      studyType: 'revision',
      studyDate: '2025-03-06',
      startMin: 680,
      durationMin: 20,
      busy: [...weeklyLecture.busy, { date: '2025-03-06', startMin: 660, endMin: 720, title: 'Lab' }],
      now,
    });
    expect(result.error).toContain('Lab');
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('requires revision to begin after the lecture on the same date', () => {
    expect(checkStudySchedule({
      ...weeklyLecture,
      studyType: 'revision',
      studyDate: '2025-03-06',
      startMin: 650,
      durationMin: 15,
      now,
    }).error).toContain('Revision must start after');
  });
});
