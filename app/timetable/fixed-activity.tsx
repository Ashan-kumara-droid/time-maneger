import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import * as Crypto from 'expo-crypto';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { deleteFixedActivity, listFixedActivities, saveFixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import { listTimetableActivities } from '@/src/db/repositories/timetableRepository';
import { getWeekdayMondayZero, toDateKey } from '@/src/scheduler/dateUtils';
import { rebuildSchedule } from '@/src/services/schedulerService';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';
import { confirmAction } from '@/src/utils/confirmAction';

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export default function FixedActivityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { theme } = useAppTheme();
  const reload = useAppStore(state => state.reload);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    listFixedActivities().then(items => {
      if (!active) return;
      const activity = items.find(item => item.id === id);
      if (!activity) throw new Error('Fixed activity could not be found.');
      setDate(activity.date);
      setTitle(activity.title);
      setStart(`${String(Math.floor(activity.start_min / 60)).padStart(2, '0')}:${String(activity.start_min % 60).padStart(2, '0')}`);
      setEnd(`${String(Math.floor(activity.end_min / 60)).padStart(2, '0')}:${String(activity.end_min % 60).padStart(2, '0')}`);
      setNotes(activity.notes ?? '');
    }).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
    return () => { active = false; };
  }, [id]);

  const save = async () => {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    const parsedDate = new Date(`${date}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(parsedDate.getTime())
      || toDateKey(parsedDate) !== date) {
      setError('Enter the date in YYYY-MM-DD format.');
      return;
    }
    if (!title.trim() || startMin === null || endMin === null || endMin <= startMin) {
      setError('Enter a title and valid times with end after start.');
      return;
    }
    try {
      const weekday = getWeekdayMondayZero(new Date(`${date}T00:00:00`));
      const [existingFixed, weekly] = await Promise.all([listFixedActivities(date), listTimetableActivities(weekday)]);
      const conflict = [
        ...existingFixed.filter(item => item.id !== id),
        ...weekly,
      ].find(item => item.start_min < endMin && item.end_min > startMin);
      if (conflict) throw new Error(`This overlaps with “${conflict.title}”.`);
      await saveFixedActivity({
        id: id ?? Crypto.randomUUID(),
        date,
        start_min: startMin,
        end_min: endMin,
        title: title.trim(),
        notes: notes.trim() || null,
        color: theme.colors.travelColor,
      });
      await rebuildSchedule('timetable_change');
      await reload();
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const remove = async () => {
    if (!id || !await confirmAction('Delete fixed activity?', title)) return;
    try {
      await deleteFixedActivity(id);
      await rebuildSchedule('timetable_change');
      await reload();
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{id ? 'Edit one-off fixed activity' : 'Add one-off fixed activity'}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>This event blocks time on one date only.</Text>
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Dentist appointment" />
      <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-22" />
      <Input label="Start time (HH:mm)" value={start} onChangeText={setStart} placeholder="09:00" />
      <Input label="End time (HH:mm)" value={end} onChangeText={setEnd} placeholder="10:00" />
      <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Button onPress={save}>Save activity</Button>
      {id ? <Button variant="danger" onPress={remove}>Delete activity</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  subtitle: { ...typography.caption },
});
