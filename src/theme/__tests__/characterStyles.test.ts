import { describe, expect, it } from '@jest/globals';

import { characterStyles, getCharacterStyle, isCharacterStyleId } from '../characterStyles';

describe('character styles', () => {
  it('provides five distinct styles in each optional character collection', () => {
    expect(characterStyles.filter(style => style.group === 'boy')).toHaveLength(5);
    expect(characterStyles.filter(style => style.group === 'girl')).toHaveLength(5);
    expect(new Set(characterStyles.map(style => style.id)).size).toBe(10);
  });

  it('validates persisted style identifiers and resolves known styles', () => {
    expect(isCharacterStyleId('girl-fantasy')).toBe(true);
    expect(isCharacterStyleId('not-a-style')).toBe(false);
    expect(isCharacterStyleId(null)).toBe(false);
    expect(getCharacterStyle('boy-gaming').label).toBe('Gaming-inspired');
  });
});
