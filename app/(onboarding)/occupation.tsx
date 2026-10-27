import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getSetting, setSetting } from '@/src/db/repositories/settingsRepository';
import { saveProfile } from '@/src/db/repositories/profileRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';

const occupations = [
  { value: 'university', title: 'University student', description: 'Lectures, labs, and study time' },
  { value: 'school', title: 'School student', description: 'Classes, breaks, and activities' },
  { value: 'professional', title: 'Working professional', description: 'Work hours, meetings, and shifts' },
] as const;

export default function OccupationScreen() {
  const { theme } = useAppTheme();
  const [selected, setSelected] = useState<typeof occupations[number]['value'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const continueSetup = async () => {
    if (!selected) {
      setError('Choose the option that best describes you.');
      return;
    }
    setBusy(true);
    try {
      const [username, gender] = await Promise.all([
        getSetting('onboarding_username'),
        getSetting('onboarding_gender'),
      ]);
      if (!username || !gender || !['male', 'female', 'other'].includes(gender)) {
        throw new Error('Your welcome details are missing. Please go back and enter them again.');
      }
      await saveProfile({
        username,
        gender: gender as 'male' | 'female' | 'other',
        occupation: selected,
        avatar_uri: null,
        created_at: new Date().toISOString(),
      });
      await setSetting('onboarding_complete', 'true');
      router.replace('/(onboarding)/timetable-setup');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>STEP 2 OF 3</Text>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>What does your week look like?</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        We’ll use this to offer relevant timetable activity types.
      </Text>
      {occupations.map(item => (
        <Pressable key={item.value} onPress={() => { setSelected(item.value); setError(''); }}>
          <Card style={[styles.option, selected === item.value && { borderColor: theme.colors.primary, borderWidth: 2 }]}>
            <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>{item.description}</Text>
          </Card>
        </Pressable>
      ))}
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Button loading={busy} onPress={continueSetup}>Continue</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  title: { fontSize: 27, lineHeight: 34, fontFamily: 'Poppins_700Bold' },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  option: { padding: 18, gap: 6 },
  optionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  optionDescription: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
