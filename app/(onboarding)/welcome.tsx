import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CharacterStylePicker } from '@/components/ui/CharacterStylePicker';
import { Input } from '@/components/ui/Input';
import { setSetting } from '@/src/db/repositories/settingsRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { ThemeBase } from '@/src/theme/palettes';

const colorStyles: { value: ThemeBase; label: string }[] = [
  { value: 'blue', label: 'Blue' },
  { value: 'pink', label: 'Pink' },
  { value: 'neutral', label: 'Neutral' },
];

export default function WelcomeScreen() {
  const { theme, setBase, characterStyle, setCharacterStyle } = useAppTheme();
  const [username, setUsername] = useState('');
  const [colorStyle, setColorStyle] = useState<ThemeBase | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const continueSetup = async () => {
    const trimmedName = username.trim();
    if (trimmedName.length < 2 || trimmedName.length > 24) {
      setError('Enter a name between 2 and 24 characters.');
      return;
    }
    setSaving(true);
    try {
      await setSetting('onboarding_username', trimmedName);
      await setSetting('onboarding_gender', 'other');
      router.push('/(onboarding)/occupation');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={[styles.brandMark, { backgroundColor: theme.colors.primaryLight }]}>
        <Text style={{ fontSize: 30 }}>◷</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Make time for what matters</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        TimeFlow helps you plan realistic work around your real-life schedule.
      </Text>
      <Input
        label="What should we call you?"
        value={username}
        onChangeText={value => { setUsername(value); setError(''); }}
        placeholder="Your name"
        autoCapitalize="words"
        maxLength={24}
        error={error && error.includes('name') ? error : undefined}
      />
      <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>Choose a color style (optional)</Text>
      <View style={styles.options}>
        {colorStyles.map(option => {
          const selected = colorStyle === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => { setColorStyle(option.value); setBase(option.value); setError(''); }}
              style={{ flex: 1 }}>
              <Card style={[
                styles.genderCard,
                selected && { borderColor: theme.colors.primary, borderWidth: 2 },
              ]}>
                <Text style={[styles.genderLabel, { color: theme.colors.textPrimary }]}>{option.label}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
      <CharacterStylePicker value={characterStyle} onChange={setCharacterStyle} />
      {error && !error.includes('name') ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
      <Button loading={saving} onPress={continueSetup} style={styles.button}>Continue</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 18 },
  brandMark: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, lineHeight: 35, fontFamily: 'Poppins_700Bold' },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular', marginBottom: 6 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  options: { flexDirection: 'row', gap: 8 },
  genderCard: { alignItems: 'center', justifyContent: 'center', minHeight: 112, padding: 10 },
  genderEmoji: { fontSize: 24, marginBottom: 8 },
  genderLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  button: { marginTop: 6 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
