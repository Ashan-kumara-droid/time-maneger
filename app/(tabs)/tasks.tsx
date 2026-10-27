import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Snackbar } from '@/components/ui/Snackbar';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/tokens';

const filters = ['All', 'Pending', 'Completed', 'High-Focus', 'Travel'] as const;

export default function TasksScreen() {
  const { theme } = useAppTheme();
  const tasks = useAppStore(state => state.tasks);
  const sessions = useAppStore(state => state.sessions);
  const reload = useAppStore(state => state.reload);
  const completeSession = useAppStore(state => state.completeSession);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'deadline'>('priority');
  const [snackbar, setSnackbar] = useState('');
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const priorityWeight = { high: 0, medium: 1, low: 2 };
    return tasks
      .filter(task => {
        const matchesSearch = !lower || `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(lower);
        const matchesFilter = filter === 'All'
          || (filter === 'Pending' && task.status !== 'completed')
          || (filter === 'Completed' && task.status === 'completed')
          || (filter === 'High-Focus' && task.kind === 'focus')
          || (filter === 'Travel' && task.kind === 'travel');
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return priorityWeight[a.priority] - priorityWeight[b.priority];
        if (sortBy === 'deadline') return (a.deadline_at ?? '9999').localeCompare(b.deadline_at ?? '9999');
        return b.created_at.localeCompare(a.created_at);
      });
  }, [tasks, filter, search, sortBy]);

  return (
    <Screen contentContainerStyle={styles.page}>
      <View style={styles.heading}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Your tasks</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{tasks.length} in your list</Text>
        </View>
        <Link href="/task/new" asChild>
          <Button onPress={() => undefined} accessibilityLabel="Add a task">+ Add task</Button>
        </Link>
      </View>
      <Input value={search} onChangeText={setSearch} placeholder="Search tasks or notes" accessibilityLabel="Search tasks" />
      <View style={styles.chips}>
        {filters.map(option => (
          <Chip key={option} label={option} selected={filter === option} onPress={() => setFilter(option)} />
        ))}
      </View>
      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: theme.colors.textSecondary }]}>Sort by</Text>
        {(['priority', 'deadline', 'created'] as const).map(option => (
          <Chip
            key={option}
            label={option === 'created' ? 'Newest' : option}
            selected={sortBy === option}
            onPress={() => setSortBy(option)}
          />
        ))}
      </View>
      {filtered.length ? filtered.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          sessions={sessions.filter(session => session.task_id === task.id)}
          onComplete={async session => {
            try {
              const undoAction = await completeSession(session.id);
              setUndo(() => undoAction);
              setSnackbar('Session completed');
            } catch (error) {
              setSnackbar(error instanceof Error ? error.message : String(error));
            }
          }}
        />
      )) : (
        <EmptyState
          title={search ? 'No matching tasks' : 'Nothing here yet'}
          description={search ? 'Try another search term.' : 'Add a task and TimeFlow will find a suitable time.'}
          icon="✓"
        />
      )}
      <Snackbar
        visible={!!snackbar}
        message={snackbar}
        actionLabel={undo ? 'Undo' : undefined}
        onAction={undo ? () => undo().then(async () => {
          setUndo(null);
          setSnackbar('Completion undone');
          await reload();
        }).catch(error => setSnackbar(String(error))) : undefined}
        onDismiss={() => { setSnackbar(''); setUndo(null); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title },
  subtitle: { ...typography.caption, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  sortLabel: { ...typography.caption },
});
