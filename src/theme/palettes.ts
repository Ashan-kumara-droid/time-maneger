export type ThemeBase = 'blue' | 'pink' | 'neutral';
export type ThemeMode = 'light' | 'dark';

export type SemanticColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  focusColor: string;
  travelColor: string;
  gradientStart: string;
  gradientEnd: string;
};

const common = {
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  priorityHigh: '#DC2626',
  priorityMedium: '#D97706',
  priorityLow: '#16A34A',
  focusColor: '#4F46E5',
  travelColor: '#0891B2',
};

export const palettes: Record<ThemeBase, Record<ThemeMode, SemanticColors>> = {
  blue: {
    light: {
      ...common,
      primary: '#2563EB',
      primaryDark: '#1D4ED8',
      primaryLight: '#DBEAFE',
      accent: '#38BDF8',
      background: '#F5F8FF',
      surface: '#FFFFFF',
      surfaceAlt: '#EFF4FF',
      textPrimary: '#172033',
      textSecondary: '#5B6578',
      border: '#DDE5F2',
      gradientStart: '#1D4ED8',
      gradientEnd: '#38BDF8',
    },
    dark: {
      ...common,
      primary: '#60A5FA',
      primaryDark: '#2563EB',
      primaryLight: '#1E3A5F',
      accent: '#7DD3FC',
      background: '#0B1220',
      surface: '#121D2E',
      surfaceAlt: '#1B2A40',
      textPrimary: '#F1F5F9',
      textSecondary: '#A8B4C5',
      border: '#29384D',
      gradientStart: '#1D4ED8',
      gradientEnd: '#0EA5E9',
    },
  },
  pink: {
    light: {
      ...common,
      primary: '#DB2777',
      primaryDark: '#BE185D',
      primaryLight: '#FCE7F3',
      accent: '#F472B6',
      background: '#FFF7FB',
      surface: '#FFFFFF',
      surfaceAlt: '#FDF0F7',
      textPrimary: '#2D1724',
      textSecondary: '#70566A',
      border: '#F1DCE8',
      gradientStart: '#DB2777',
      gradientEnd: '#F472B6',
    },
    dark: {
      ...common,
      primary: '#F472B6',
      primaryDark: '#DB2777',
      primaryLight: '#51223D',
      accent: '#FDA4D4',
      background: '#1A1018',
      surface: '#261722',
      surfaceAlt: '#35202F',
      textPrimary: '#FFF1F8',
      textSecondary: '#D2B7C7',
      border: '#4B2D42',
      gradientStart: '#BE185D',
      gradientEnd: '#DB2777',
    },
  },
  neutral: {
    light: {
      ...common,
      primary: '#0F766E',
      primaryDark: '#115E59',
      primaryLight: '#CCFBF1',
      accent: '#8B5CF6',
      background: '#F7F8FA',
      surface: '#FFFFFF',
      surfaceAlt: '#EEF1F5',
      textPrimary: '#1C2430',
      textSecondary: '#586474',
      border: '#DCE2E9',
      gradientStart: '#0F766E',
      gradientEnd: '#8B5CF6',
    },
    dark: {
      ...common,
      primary: '#5EEAD4',
      primaryDark: '#0F766E',
      primaryLight: '#153B3A',
      accent: '#C4B5FD',
      background: '#10151B',
      surface: '#19212A',
      surfaceAlt: '#242E39',
      textPrimary: '#F1F5F9',
      textSecondary: '#AAB5C2',
      border: '#303B48',
      gradientStart: '#0F766E',
      gradientEnd: '#7C3AED',
    },
  },
};
