import { useCallback, useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { CharacterAvatar } from '@/components/ui/CharacterAvatar';
import { getProfile } from '@/src/db/repositories/profileRepository';
import { getSetting } from '@/src/db/repositories/settingsRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';

export default function EntryRoute() {
  const [destination, setDestination] = useState<'/(tabs)' | '/(onboarding)/welcome' | '/lock' | null>(null);
  const [error, setError] = useState('');
  const { theme, characterStyle } = useAppTheme();

  const loadDestination = useCallback(async () => {
    try {
      const [profile, lockEnabled] = await Promise.all([getProfile(), getSetting('app_lock_enabled')]);
      setDestination(profile ? (lockEnabled === 'true' ? '/lock' : '/(tabs)') : '/(onboarding)/welcome');
      setError('');
    } catch (caught) {
      console.error('Unable to check onboarding status', caught);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadDestination);
  }, [loadDestination]);

  if (destination) return <Redirect href={destination} />;
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.error, { color: theme.colors.danger }]}>
          TimeFlow could not load your profile: {error}
        </Text>
        <Button onPress={() => loadDestination()}>Try again</Button>
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CharacterAvatar styleId={characterStyle} size={72} accentColor={theme.colors.primary} backgroundColor={theme.colors.primaryLight} />
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Loading TimeFlow</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontFamily: 'Inter_500Medium' },
  error: { fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
