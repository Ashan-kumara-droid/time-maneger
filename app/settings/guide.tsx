import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';

const guide = [
  { title: 'Getting started', body: 'Set your profile and occupation first. Add weekly fixed commitments in Timetable, then mark commute periods as Travel windows. Add tasks with an estimated duration and a priority.' },
  { title: 'Task kinds and priorities', body: 'High-Focus tasks are scheduled only in focus-capable free time. Travel tasks are placed only inside explicit travel windows. Higher priority and nearer deadlines receive earlier placement.' },
  { title: 'Weekly timetable and time windows', body: 'Weekly activities repeat every week and are never overwritten. Unassigned free gaps can be used for focus tasks. Travel windows carve out time for travel-friendly work.' },
  { title: 'How scheduling works', body: 'TimeFlow looks across your planning horizon, subtracts fixed commitments and buffers, and splits long tasks into sessions. It respects deadlines and warns you when all remaining work cannot fit.' },
  { title: 'Completing and missing sessions', body: 'Completing a session reduces the task’s remaining time. If the session passes without completion, it is marked missed and the work is returned to the task for replanning.' },
  { title: 'Themes and customization', body: 'Choose blue, pink, or neutral palettes, or pick a custom color combination from Appearance. Choose light, dark, system, or custom display mode.' },
  { title: 'Privacy and app lock', body: 'Your profile, tasks, and timetable are stored locally on this device. No account or network connection is needed. An optional PIN or supported biometric lock can protect app access.' },
  { title: 'Why is a task not scheduled?', body: 'Check whether any eligible time is free before its deadline. Focus tasks do not fit into Travel windows, and Travel tasks require a marked Travel window. Extend availability, shorten the task, or adjust the deadline.' },
  { title: 'Why did a task move?', body: 'A timetable change, missed session, or new higher-priority task may cause a rebuild. Review the latest plan and warning details before relying on a moved session.' },
] as const;

export default function GuideScreen() {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const sections = useMemo(() => guide.filter(item => `${item.title} ${item.body}`.toLowerCase().includes(search.toLowerCase())), [search]);

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Guide & help</Text>
      <Input value={search} onChangeText={setSearch} placeholder="Search help topics" accessibilityLabel="Search help topics" />
      {sections.map(section => {
        const isExpanded = expanded.includes(section.title);
        return (
          <Card key={section.title} style={styles.card}>
            <Text
              accessibilityRole="button"
              onPress={() => setExpanded(current => isExpanded ? current.filter(item => item !== section.title) : [...current, section.title])}
              style={[styles.sectionTitle, { color: theme.colors.primary }]}>
              {isExpanded ? '− ' : '+ '}{section.title}
            </Text>
            {isExpanded ? <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{section.body}</Text> : null}
          </Card>
        );
      })}
      {!sections.length ? <Text style={{ color: theme.colors.textSecondary }}>No matching guide topics.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  card: { gap: 10 },
  sectionTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  body: { ...typography.body },
});
