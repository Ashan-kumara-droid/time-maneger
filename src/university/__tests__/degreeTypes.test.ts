import { describe, expect, it } from '@jest/globals';

import {
  getUniversityDegreeType,
  isUniversityDegreeType,
  universityDegreeTypes,
} from '../degreeTypes';

describe('university degree themes and activity presets', () => {
  it('provides a distinct palette and activity presets for every degree group', () => {
    const lightPrimaries = universityDegreeTypes.map(degree => degree.theme.light.primary);
    const darkPrimaries = universityDegreeTypes.map(degree => degree.theme.dark.primary);

    expect(new Set(lightPrimaries).size).toBe(universityDegreeTypes.length);
    expect(new Set(darkPrimaries).size).toBe(universityDegreeTypes.length);
    expect(universityDegreeTypes.every(degree => degree.activityTypes.length > 0)).toBe(true);
  });

  it('validates persisted degree selections before using them', () => {
    expect(isUniversityDegreeType('engineering')).toBe(true);
    expect(isUniversityDegreeType('unknown')).toBe(false);
    expect(getUniversityDegreeType('engineering').label).toBe('Engineering');
  });
});
