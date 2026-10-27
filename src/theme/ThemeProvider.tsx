import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { getSetting, setSetting } from '@/src/db/repositories/settingsRepository';

import { palettes, SemanticColors, ThemeBase, ThemeMode } from './palettes';
import { CharacterStyleId, isCharacterStyleId } from './characterStyles';
import {
  getUniversityDegreeType,
  isUniversityDegreeType,
  UniversityDegreeType,
} from '@/src/university/degreeTypes';

type ThemeSelection = ThemeMode | 'system' | 'custom';
type CustomColors = { primary: string; accent: string; background: string };

type ThemeContextValue = {
  theme: { base: ThemeBase; mode: ThemeMode; selection: ThemeSelection; colors: SemanticColors };
  characterStyle: CharacterStyleId | null;
  degreeType: UniversityDegreeType | null;
  setBase: (base: ThemeBase) => void;
  setMode: (mode: ThemeSelection) => void;
  setCustomColors: (colors: CustomColors) => void;
  setCharacterStyle: (style: CharacterStyleId | null) => void;
  setDegreeType: (degreeType: UniversityDegreeType | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [base, setBase] = useState<ThemeBase>('blue');
  const [modePreference, setModePreference] = useState<ThemeSelection>('system');
  const [customColors, setCustomColorsState] = useState<CustomColors>({
    primary: '#7C3AED',
    accent: '#A78BFA',
    background: '#F5F3FF',
  });
  const [characterStyle, setCharacterStyleState] = useState<CharacterStyleId | null>(null);
  const [degreeType, setDegreeTypeState] = useState<UniversityDegreeType | null>(null);
  const mode: ThemeMode = modePreference === 'light' || modePreference === 'dark'
    ? modePreference
    : systemScheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    let active = true;
    Promise.all([
      getSetting('theme_base'),
      getSetting('theme_mode'),
      getSetting('custom_colors_json'),
      getSetting('theme_character'),
      getSetting('theme_degree_type'),
    ]).then(([storedBase, storedMode, storedCustomColors, storedCharacter, storedDegreeType]) => {
      if (!active) return;
      if (storedBase === 'blue' || storedBase === 'pink' || storedBase === 'neutral') setBase(storedBase);
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system' || storedMode === 'custom') setModePreference(storedMode);
      if (isCharacterStyleId(storedCharacter)) setCharacterStyleState(storedCharacter);
      if (isUniversityDegreeType(storedDegreeType)) setDegreeTypeState(storedDegreeType);
      if (storedCustomColors) {
        const parsed: unknown = JSON.parse(storedCustomColors);
        if (parsed && typeof parsed === 'object' && 'primary' in parsed && 'accent' in parsed && 'background' in parsed) {
          setCustomColorsState(parsed as CustomColors);
        }
      }
    }).catch(error => {
      console.error('Unable to load theme settings', error);
    });
    return () => { active = false; };
  }, []);

  const updateBase = (nextBase: ThemeBase) => {
    setBase(nextBase);
    setDegreeTypeState(null);
    setSetting('theme_base', nextBase).catch(error => console.error('Unable to save theme palette', error));
    setSetting('theme_degree_type', 'none').catch(error => console.error('Unable to reset degree theme', error));
  };
  const updateMode = (nextMode: ThemeSelection) => {
    setModePreference(nextMode);
    setSetting('theme_mode', nextMode).catch(error => console.error('Unable to save theme mode', error));
  };

  const updateCustomColors = (colors: CustomColors) => {
    setCustomColorsState(colors);
    setSetting('custom_colors_json', JSON.stringify(colors)).catch(error => console.error('Unable to save custom colors', error));
  };
  const updateCharacterStyle = (style: CharacterStyleId | null) => {
    setCharacterStyleState(style);
    setSetting('theme_character', style ?? 'none').catch(error => console.error('Unable to save character style', error));
  };
  const updateDegreeType = (nextDegreeType: UniversityDegreeType | null) => {
    setDegreeTypeState(nextDegreeType);
    setSetting('theme_degree_type', nextDegreeType ?? 'none').catch(error => console.error('Unable to save degree theme', error));
  };

  const value = useMemo<ThemeContextValue>(() => {
    const palette = palettes[base][mode];
    const degreeColors = degreeType ? getUniversityDegreeType(degreeType).theme[mode] : null;
    const colors = modePreference === 'custom'
      ? {
        ...palette,
        primary: customColors.primary,
        primaryDark: customColors.primary,
        primaryLight: mode === 'dark' ? '#31204A' : '#EDE9FE',
        accent: customColors.accent,
        background: customColors.background,
        gradientStart: customColors.primary,
        gradientEnd: customColors.accent,
        textPrimary: mode === 'dark' ? '#FFFFFF' : '#16121F',
        textSecondary: mode === 'dark' ? '#D1CADB' : '#514B5B',
      }
      : degreeColors
        ? { ...palette, ...degreeColors }
      : palette;

    return {
      theme: { base, mode, selection: modePreference, colors },
      characterStyle,
      degreeType,
      setBase: updateBase,
      setMode: updateMode,
      setCustomColors: updateCustomColors,
      setCharacterStyle: updateCharacterStyle,
      setDegreeType: updateDegreeType,
    };
  }, [base, mode, modePreference, customColors, characterStyle, degreeType]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider');
  }
  return context;
}
