import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';

const sections = [
  { href: '/settings/profile', title: 'Profile', description: 'Name, occupation, and avatar' },
  { href: '/settings/theme', title: 'Appearance', description: 'Color palettes, university program themes, and display mode' },
  { href: '/settings/security', title: 'Privacy & security', description: 'App lock, reminders, and data backup' },
  { href: '/settings/guide', title: 'Guide & help', description: 'How TimeFlow schedules your work' },
] as const;

export default function SettingsScreen() {
  const { theme } = useAppTheme();
  return (
    <Screen contentContainerStyle={styles.page}>
      <View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Make TimeFlow work for you</Text>
      </View>
      {sections.map(section => (
        <Link key={section.href} href={section.href}>
          <Card style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>{section.title}</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{section.description}</Text>
            </View>
            <Text style={{ color: theme.colors.primary, fontSize: 22 }}>›</Text>
          </Card>
        </Link>
      ))}
      <Card style={styles.privacy}>
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Private by design</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Your tasks and timetable are stored on this device. TimeFlow works offline and does not require an account.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 19, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  privacy: { gap: 4 },
});
