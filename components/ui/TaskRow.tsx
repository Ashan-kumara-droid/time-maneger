import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TaskRecord } from '@/src/db/repositories/taskRepository';
import { SessionRecord } from '@/src/db/repositories/sessionRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type TaskRowProps = {
  task: TaskRecord;
  sessions?: SessionRecord[];
  onComplete?: (session: SessionRecord) => void;
};

export function TaskRow({ task, sessions = [], onComplete }: TaskRowProps) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const accent = task.priority === 'high' ? colors.priorityHigh
    : task.priority === 'medium' ? colors.priorityMedium
      : colors.priorityLow;
  const nextSession = sessions.find(session => session.status === 'planned');
  const nextDate = nextSession ? new Date(nextSession.start_at) : null;

  return (
    <Link href={{ pathname: '/task/[id]', params: { id: task.id } }} asChild>
      <Pressable style={StyleSheet.flatten([
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ])}>
        <View style={[styles.priorityBar, { backgroundColor: accent }]} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{task.title}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {task.kind === 'focus' ? 'High-Focus' : 'Travel'} · {task.category} · {task.remaining_minutes} min left
          </Text>
          {nextDate ? (
            <Text style={[styles.meta, { color: colors.primary }]}>
              Next: {nextDate.toLocaleDateString(undefined, { weekday: 'short' })} {nextDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          ) : task.status === 'unschedulable' ? (
            <Text style={[styles.meta, { color: colors.danger }]}>Needs more available time</Text>
          ) : null}
        </View>
        {onComplete && nextSession ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Complete next session for ${task.title}`}
            hitSlop={10}
            onPress={event => {
              event.stopPropagation();
              onComplete(nextSession);
            }}
            style={[styles.doneButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  priorityBar: { width: 4, alignSelf: 'stretch', borderRadius: radius.pill },
  copy: { flex: 1, gap: 4 },
  title: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  meta: { ...typography.caption },
  doneButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
