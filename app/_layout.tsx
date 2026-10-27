import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { initializeDatabase } from '@/src/db/client';
import { ThemeProvider, useAppTheme } from '@/src/theme/ThemeProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AppNavigation() {
  const { theme } = useAppTheme();
  const routerTheme = theme.mode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <RouterThemeProvider value={{
      ...routerTheme,
      colors: {
        ...routerTheme.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        primary: theme.colors.primary,
        border: theme.colors.border,
      },
    }}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </RouterThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    initializeDatabase().then(
      () => {
        if (active) setDatabaseReady(true);
      },
      (error: unknown) => {
        if (active) {
          setDatabaseError(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && databaseReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, databaseReady]);

  if (databaseError) {
    return (
      <View style={styles.state}>
        <Text style={styles.errorTitle}>Could not open TimeFlow storage</Text>
        <Text style={styles.errorMessage}>{databaseError.message}</Text>
      </View>
    );
  }

  if (!fontsLoaded || !databaseReady) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Preparing TimeFlow…</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppNavigation />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 12, color: '#475569', fontFamily: 'Inter_500Medium' },
  errorTitle: { color: '#B91C1C', fontSize: 18, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  errorMessage: { marginTop: 8, color: '#475569', textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
