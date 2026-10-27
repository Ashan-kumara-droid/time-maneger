import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Snackbar } from '@/components/ui/Snackbar';
import { getTask, TaskRecord } from '@/src/db/repositories/taskRepository';
import { listSessions, SessionRecord } from '@/src/db/repositories/sessionRepository';
import { deleteTaskWithUndo } from '@/src/services/taskService';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useAppTheme();
  const reload = useAppStore(state => state.reload);
  const completeSession = useAppStore(state => state.completeSession);
  const completeTask = useAppStore(state => state.completeTask);
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [message, setMessage] = useState('');
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const [actualSession, setActualSession] = useState<SessionRecord | null>(null);
  const [actualMinutes, setActualMinutes] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<'confirm' | 'deleted' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [loadedTask, loadedSessions] = await Promise.all([getTask(id), listSessions(id)]);
    setTask(loadedTask);
    setSessions(loadedSessions);
  }, [id]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(load).catch(error => {
      if (active) setMessage(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [load]);

  if (!task) {
    return <Screen><Text style={{ color: theme.colors.textSecondary }}>{message || 'Loading task…'}</Text></Screen>;
  }
  const planned = sessions.filter(session => session.status === 'planned');
  const doneMinutes = Math.max(0, task.estimated_minutes - task.remaining_minutes);
  const progress = task.estimated_minutes ? doneMinutes / task.estimated_minutes * 100 : 0;

  const complete = async (session: SessionRecord, actual?: number) => {
    try {
      const undoAction = await completeSession(session.id, actual);
      setUndo(() => undoAction);
      setMessage('Session completed.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const markWholeComplete = () => Alert.alert(
    'Mark the whole task complete?',
    'This removes its future planned sessions.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete task', onPress: () => {
        completeTask(task.id).then(async undoAction => {
          setUndo(() => undoAction);
          setMessage('Task marked complete.');
          await load();
        }).catch(error => setMessage(error instanceof Error ? error.message : String(error)));
      } },
    ],
  );

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const undoAction = await deleteTaskWithUndo(task.id);
      await reload();
      setUndo(() => undoAction);
      setMessage('Task deleted.');
      setDeleteDialog('deleted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setDeleteDialog(null);
    } finally {
      setDeleting(false);
    }
  };

  const undoDelete = async () => {
    if (!undo) return;
    try {
      await undo();
      setUndo(null);
      setMessage('');
      setDeleteDialog(null);
      await reload();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{task.title}</Text>
        <Button variant="outline" onPress={() => router.push({ pathname: '/task/new', params: { id: task.id } })}>Edit</Button>
      </View>
      <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
        {task.category} · {task.priority} priority · {task.kind === 'focus' ? 'High-Focus' : 'Travel'}
      </Text>
      {task.linked_study_type ? (
        <Text style={[styles.meta, { color: theme.colors.primary }]}>
          {task.linked_study_type === 'preparation' ? 'Lecture preparation' : 'Lecture revision'} · linked to a weekly lecture
        </Text>
      ) : null}
      {task.description ? <Card><Text style={{ color: theme.colors.textPrimary }}>{task.description}</Text></Card> : null}
      <Card style={styles.progressCard}>
        <ProgressRing progress={progress} label={`${doneMinutes} of ${task.estimated_minutes} minutes complete`} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>REMAINING</Text>
          <Text style={[styles.remaining, { color: theme.colors.textPrimary }]}>{task.remaining_minutes} min</Text>
          <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>{doneMinutes} of {task.estimated_minutes} min completed</Text>
        </View>
      </Card>
      {task.deadline_at ? (
        <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>Deadline: {new Date(task.deadline_at).toLocaleString()}</Text>
      ) : null}
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Sessions</Text>
      {sessions.length ? sessions.map((session, index) => (
        <Card key={session.id} style={styles.session}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sessionTitle, { color: theme.colors.textPrimary }]}>
              Session {session.session_index || index + 1} · {session.planned_minutes} min
            </Text>
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {new Date(session.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(session.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–{new Date(session.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={[styles.meta, { color: session.status === 'done' ? theme.colors.success : theme.colors.textSecondary }]}>{session.status}</Text>
          </View>
          {session.status === 'planned' ? (
            <View style={styles.sessionActions}>
              <Button onPress={() => complete(session)}>Done</Button>
              <Button variant="outline" onPress={() => {
                setActualSession(session);
                setActualMinutes(String(session.planned_minutes));
              }}>Actual time</Button>
            </View>
          ) : null}
        </Card>
      )) : <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>No sessions scheduled yet.</Text>}
      {message ? <Text style={{ color: theme.colors.danger }}>{message}</Text> : null}
      {task.status !== 'completed' ? <Button variant="secondary" onPress={markWholeComplete}>Mark whole task complete</Button> : null}
      <Button variant="danger" onPress={() => setDeleteDialog('confirm')}>Delete task</Button>
      <Modal
        visible={deleteDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteDialog(null);
        }}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              {deleteDialog === 'deleted' ? 'Task deleted' : 'Delete this task?'}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {deleteDialog === 'deleted'
                ? 'The task and its sessions have been removed.'
                : 'The task and all of its sessions will be removed.'}
            </Text>
            {deleteDialog === 'confirm' ? (
              <>
                <Button variant="danger" loading={deleting} onPress={confirmDelete}>Delete task</Button>
                <Button variant="outline" disabled={deleting} onPress={() => setDeleteDialog(null)}>Cancel</Button>
              </>
            ) : (
              <>
                {undo ? <Button variant="outline" onPress={undoDelete}>Undo</Button> : null}
                <Button onPress={() => {
                  setDeleteDialog(null);
                  router.replace('/(tabs)/tasks');
                }}>Done</Button>
              </>
            )}
          </Card>
        </View>
      </Modal>
      <Modal visible={!!actualSession} transparent animationType="fade" onRequestClose={() => setActualSession(null)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Actual time worked</Text>
            <Input label="Minutes" value={actualMinutes} onChangeText={setActualMinutes} keyboardType="number-pad" />
            <Button onPress={() => {
              const amount = Number(actualMinutes);
              if (!Number.isInteger(amount) || amount < 0) {
                setMessage('Enter a valid number of minutes.');
                return;
              }
              if (actualSession) complete(actualSession, amount).then(() => setActualSession(null));
            }}>Save session</Button>
            <Button variant="outline" onPress={() => setActualSession(null)}>Cancel</Button>
          </Card>
        </View>
      </Modal>
      <Snackbar
        visible={!!message}
        message={message}
        actionLabel={undo ? 'Undo' : undefined}
        onAction={undo ? () => undo().then(async () => { setUndo(null); setMessage('Completion undone.'); await load(); }).catch(error => setMessage(String(error))) : undefined}
        onDismiss={() => setMessage('')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...typography.title, flex: 1 },
  meta: { ...typography.caption },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  remaining: { fontSize: 24, fontFamily: 'Poppins_600SemiBold', marginVertical: 2 },
  sectionTitle: { ...typography.subtitle },
  session: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  sessionActions: { gap: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15,23,42,0.45)' },
  modalCard: { gap: 12 },
});
