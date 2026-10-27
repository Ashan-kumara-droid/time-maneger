export type CharacterStyleId =
  | 'boy-professional'
  | 'boy-friendly'
  | 'boy-futuristic'
  | 'boy-gaming'
  | 'boy-motivational'
  | 'girl-elegant'
  | 'girl-pastel'
  | 'girl-stylish'
  | 'girl-fantasy'
  | 'girl-motivational';

export type CharacterStyle = {
  id: CharacterStyleId;
  group: 'boy' | 'girl';
  label: string;
  emoji: string;
  duration: number;
  lift: number;
  rotation: number;
  scale: number;
};

export const characterStyles: CharacterStyle[] = [
  { id: 'boy-professional', group: 'boy', label: 'Minimal & professional', emoji: '🧑‍💼', duration: 2400, lift: 3, rotation: 2, scale: 0.015 },
  { id: 'boy-friendly', group: 'boy', label: 'Cute & friendly', emoji: '🤗', duration: 1600, lift: 7, rotation: 0, scale: 0.04 },
  { id: 'boy-futuristic', group: 'boy', label: 'Modern & futuristic', emoji: '🤖', duration: 2200, lift: 0, rotation: 8, scale: 0.025 },
  { id: 'boy-gaming', group: 'boy', label: 'Gaming-inspired', emoji: '🧑‍🎮', duration: 1300, lift: 5, rotation: 5, scale: 0.06 },
  { id: 'boy-motivational', group: 'boy', label: 'Calm & motivational', emoji: '🧘‍♂️', duration: 3000, lift: 2, rotation: 0, scale: 0.025 },
  { id: 'girl-elegant', group: 'girl', label: 'Cute & elegant', emoji: '👩‍🎓', duration: 2600, lift: 4, rotation: 3, scale: 0.02 },
  { id: 'girl-pastel', group: 'girl', label: 'Soft pastel & friendly', emoji: '👩‍🎨', duration: 1800, lift: 6, rotation: 0, scale: 0.035 },
  { id: 'girl-stylish', group: 'girl', label: 'Modern & stylish', emoji: '👩‍🎤', duration: 2000, lift: 2, rotation: 6, scale: 0.025 },
  { id: 'girl-fantasy', group: 'girl', label: 'Fantasy-inspired', emoji: '🧚‍♀️', duration: 2300, lift: 8, rotation: 4, scale: 0.03 },
  { id: 'girl-motivational', group: 'girl', label: 'Calm & motivational', emoji: '🧘‍♀️', duration: 3200, lift: 2, rotation: 0, scale: 0.02 },
];

export function isCharacterStyleId(value: string | null): value is CharacterStyleId {
  return characterStyles.some(style => style.id === value);
}

export function getCharacterStyle(id: CharacterStyleId) {
  return characterStyles.find(style => style.id === id)!;
}
