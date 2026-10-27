export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontFamily: 'Poppins_700Bold' },
  title: { fontSize: 22, lineHeight: 28, fontFamily: 'Poppins_600SemiBold' },
  subtitle: { fontSize: 17, lineHeight: 24, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium' },
} as const;
