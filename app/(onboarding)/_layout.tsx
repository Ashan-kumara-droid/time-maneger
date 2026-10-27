import { Stack } from 'expo-router';

import { useAppTheme } from '@/src/theme/ThemeProvider';

export default function OnboardingLayout() {
  const { theme } = useAppTheme();
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.background },
      animation: 'slide_from_right',
    }} />
  );
}
