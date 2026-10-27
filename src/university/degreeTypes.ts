import type { ThemeMode } from '@/src/theme/palettes';

type DegreeThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  gradientStart: string;
  gradientEnd: string;
};

type DegreeTypeDefinition = {
  id: string;
  label: string;
  activityTypes: string[];
  theme: Record<ThemeMode, DegreeThemeColors>;
};

export const universityDegreeTypes = [
  {
    id: 'arts',
    label: 'Arts & Humanities',
    activityTypes: ['Studio', 'Critique', 'Rehearsal', 'Reading group'],
    theme: {
      light: { primary: '#7E22CE', primaryDark: '#6B21A8', primaryLight: '#F3E8FF', accent: '#C084FC', gradientStart: '#6B21A8', gradientEnd: '#C084FC' },
      dark: { primary: '#C084FC', primaryDark: '#9333EA', primaryLight: '#3B1D56', accent: '#D8B4FE', gradientStart: '#7E22CE', gradientEnd: '#C084FC' },
    },
  },
  {
    id: 'business',
    label: 'Business & Economics',
    activityTypes: ['Case study', 'Group project', 'Presentation', 'Networking'],
    theme: {
      light: { primary: '#047857', primaryDark: '#065F46', primaryLight: '#D1FAE5', accent: '#34D399', gradientStart: '#065F46', gradientEnd: '#34D399' },
      dark: { primary: '#34D399', primaryDark: '#059669', primaryLight: '#123D32', accent: '#6EE7B7', gradientStart: '#047857', gradientEnd: '#34D399' },
    },
  },
  {
    id: 'computer-science',
    label: 'Computer Science & IT',
    activityTypes: ['Coding lab', 'Code review', 'Project build', 'Hackathon'],
    theme: {
      light: { primary: '#0369A1', primaryDark: '#075985', primaryLight: '#E0F2FE', accent: '#38BDF8', gradientStart: '#075985', gradientEnd: '#38BDF8' },
      dark: { primary: '#38BDF8', primaryDark: '#0284C7', primaryLight: '#123B55', accent: '#7DD3FC', gradientStart: '#0369A1', gradientEnd: '#38BDF8' },
    },
  },
  {
    id: 'education',
    label: 'Education',
    activityTypes: ['Teaching practice', 'Placement', 'Lesson planning', 'Workshop'],
    theme: {
      light: { primary: '#B45309', primaryDark: '#92400E', primaryLight: '#FEF3C7', accent: '#FBBF24', gradientStart: '#92400E', gradientEnd: '#FBBF24' },
      dark: { primary: '#FBBF24', primaryDark: '#D97706', primaryLight: '#49320F', accent: '#FCD34D', gradientStart: '#B45309', gradientEnd: '#FBBF24' },
    },
  },
  {
    id: 'engineering',
    label: 'Engineering',
    activityTypes: ['Design review', 'Workshop', 'Build session', 'Field work'],
    theme: {
      light: { primary: '#C2410C', primaryDark: '#9A3412', primaryLight: '#FFEDD5', accent: '#FB923C', gradientStart: '#9A3412', gradientEnd: '#FB923C' },
      dark: { primary: '#FB923C', primaryDark: '#EA580C', primaryLight: '#4A2818', accent: '#FDBA74', gradientStart: '#C2410C', gradientEnd: '#FB923C' },
    },
  },
  {
    id: 'law',
    label: 'Law',
    activityTypes: ['Moot court', 'Legal clinic', 'Case reading', 'Client interview'],
    theme: {
      light: { primary: '#9F1239', primaryDark: '#881337', primaryLight: '#FFE4E6', accent: '#FB7185', gradientStart: '#881337', gradientEnd: '#FB7185' },
      dark: { primary: '#FB7185', primaryDark: '#E11D48', primaryLight: '#4B1D2D', accent: '#FDA4AF', gradientStart: '#9F1239', gradientEnd: '#FB7185' },
    },
  },
  {
    id: 'medicine-health',
    label: 'Medicine & Health',
    activityTypes: ['Clinical rotation', 'Skills lab', 'Ward round', 'Patient simulation'],
    theme: {
      light: { primary: '#0F766E', primaryDark: '#115E59', primaryLight: '#CCFBF1', accent: '#2DD4BF', gradientStart: '#115E59', gradientEnd: '#2DD4BF' },
      dark: { primary: '#5EEAD4', primaryDark: '#0F766E', primaryLight: '#153B3A', accent: '#99F6E4', gradientStart: '#0F766E', gradientEnd: '#5EEAD4' },
    },
  },
  {
    id: 'natural-sciences',
    label: 'Natural Sciences',
    activityTypes: ['Research lab', 'Field study', 'Experiment', 'Research meeting'],
    theme: {
      light: { primary: '#4338CA', primaryDark: '#3730A3', primaryLight: '#E0E7FF', accent: '#818CF8', gradientStart: '#3730A3', gradientEnd: '#818CF8' },
      dark: { primary: '#A5B4FC', primaryDark: '#6366F1', primaryLight: '#292B55', accent: '#C7D2FE', gradientStart: '#4338CA', gradientEnd: '#818CF8' },
    },
  },
  {
    id: 'social-sciences',
    label: 'Social Sciences',
    activityTypes: ['Field research', 'Interview session', 'Discussion group', 'Community placement'],
    theme: {
      light: { primary: '#6D28D9', primaryDark: '#5B21B6', primaryLight: '#EDE9FE', accent: '#A78BFA', gradientStart: '#5B21B6', gradientEnd: '#A78BFA' },
      dark: { primary: '#A78BFA', primaryDark: '#7C3AED', primaryLight: '#33234E', accent: '#C4B5FD', gradientStart: '#6D28D9', gradientEnd: '#A78BFA' },
    },
  },
  {
    id: 'architecture-design',
    label: 'Architecture & Design',
    activityTypes: ['Design studio', 'Pin-up review', 'Portfolio work', 'Model workshop'],
    theme: {
      light: { primary: '#BE185D', primaryDark: '#9D174D', primaryLight: '#FCE7F3', accent: '#F472B6', gradientStart: '#9D174D', gradientEnd: '#F472B6' },
      dark: { primary: '#F472B6', primaryDark: '#DB2777', primaryLight: '#4A2039', accent: '#F9A8D4', gradientStart: '#BE185D', gradientEnd: '#F472B6' },
    },
  },
  {
    id: 'agriculture-environment',
    label: 'Agriculture & Environment',
    activityTypes: ['Fieldwork', 'Farm placement', 'Environmental survey', 'Research plot'],
    theme: {
      light: { primary: '#4D7C0F', primaryDark: '#3F6212', primaryLight: '#ECFCCB', accent: '#84CC16', gradientStart: '#3F6212', gradientEnd: '#84CC16' },
      dark: { primary: '#A3E635', primaryDark: '#65A30D', primaryLight: '#303D1B', accent: '#BEF264', gradientStart: '#4D7C0F', gradientEnd: '#A3E635' },
    },
  },
  {
    id: 'math-statistics',
    label: 'Mathematics & Statistics',
    activityTypes: ['Problem set', 'Data analysis', 'Study group', 'Research seminar'],
    theme: {
      light: { primary: '#334155', primaryDark: '#1E293B', primaryLight: '#E2E8F0', accent: '#64748B', gradientStart: '#1E293B', gradientEnd: '#64748B' },
      dark: { primary: '#CBD5E1', primaryDark: '#64748B', primaryLight: '#2A3442', accent: '#94A3B8', gradientStart: '#334155', gradientEnd: '#94A3B8' },
    },
  },
] as const satisfies readonly DegreeTypeDefinition[];

export type UniversityDegreeType = (typeof universityDegreeTypes)[number]['id'];

export function isUniversityDegreeType(value: string | null): value is UniversityDegreeType {
  return universityDegreeTypes.some(degree => degree.id === value);
}

export function getUniversityDegreeType(value: UniversityDegreeType) {
  const degree = universityDegreeTypes.find(item => item.id === value);
  if (!degree) {
    throw new Error(`Unknown university degree type: ${value}`);
  }
  return degree;
}
