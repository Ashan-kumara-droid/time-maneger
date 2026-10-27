import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { deleteTimeWindow, listTimeWindows, saveTimeWindow } from '@/src/db/repositories/timetableRepository';
import { getDatabase } from '@/src/db/client';
import { rebuildSchedule } from '@/src/services/schedulerService';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';
import { getWeekdayMondayZero } from '@/src/scheduler/dateUtils';
import { confirmAction } from '@/src/utils/confirmAction';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const parse = (value: string) => {
  const result = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return result ? Number(result[1]) * 60 + Number(result[2]) : null;
};

export default function EditWindowScreen() {
  const { id, day, start: initialStart, end: initialEnd, kind: initialKind } = useLocalSearchParams<{
    id?: string; day?: string; start?: string; end?: string; kind?: string;
  }>();
  const { theme } = useAppTheme();
  const reload = useAppStore(state => state.reload);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'focus' | 'travel'>(initialKind === 'focus' ? 'focus' : 'travel');
  const [start, setStart] = useState(initialStart ?? '12:00');
  const [end, setEnd] = useState(initialEnd ?? '13:00');
  const [days, setDays] = useState<number[]>([
    day !== undefined ? Number(day) : getWeekdayMondayZero(new Date()),
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    listTimeWindows().then(all => {
      const window = all.find(item => item.id === id);
      if (!window) throw new Error('Time window could not be found.');
      setLabel(window.label ?? '');
      setKind(window.kind);
      setStart(`${String(Math.floor(window.start_min / 60)).padStart(2, '0')}:${String(window.start_min % 60).padStart(2, '0')}`);
      setEnd(`${String(Math.floor(window.end_min / 60)).padStart(2, '0')}:${String(window.end_min % 60).padStart(2, '0')}`);
      setDays([window.day_of_week]);
    }).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [id]);

  const save = async () => {
    const startMin = parse(start);
    const endMin = parse(end);
    if (startMin === null || endMin === null || endMin <= startMin) { setError('Enter valid times with end after start.'); return; }
    if (!days.length) { setError('Choose at least one day.'); return; }
    try {
      const existing = await listTimeWindows();
      for (const weekday of days) {
        const conflict = existing.find(window =>
          window.day_of_week === weekday
          && window.id !== id
          && window.start_min < endMin
          && window.end_min > startMin,
        );
        if (conflict) {
          throw new Error(`${weekdays[weekday]} overlaps with “${conflict.label ?? `${conflict.kind} window`}”.`);
        }
      }
      await getDatabase().withTransactionAsync(async () => {
        for (const weekday of days) {
          await saveTimeWindow({
            id: id && weekday === days[0] ? id : Crypto.randomUUID(),
            day_of_week: weekday,
            start_min: startMin,
            end_min: endMin,
            kind,
            label: label.trim() || null,
            allowed_task_kinds_json: JSON.stringify(kind === 'travel' ? ['travel'] : ['focus']),
            is_active: 1,
          });
        }
      });
      await rebuildSchedule('timetable_change');
      await reload();
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const remove = async () => {
    if (!id || !await confirmAction('Delete this time window?', label || `${start}–${end}`)) return;
    try {
      await deleteTimeWindow(id);
      await rebuildSchedule('timetable_change');
      await reload();
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{id ? 'Edit time window' : 'Add time window'}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Travel windows are reserved for Travel-kind tasks. Remaining unassigned free time can be used for focus work.
      </Text>
      <Input label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Bus to university" />
      <View style={styles.chips}>
        {(['focus', 'travel'] as const).map(value => <Chip key={value} label={value} selected={kind === value} onPress={() => setKind(value)} />)}
      </View>
      <View style={styles.timeRow}>
        <Input label="Start (HH:mm)" value={start} onChangeText={setStart} />
        <Input label="End (HH:mm)" value={end} onChangeText={setEnd} />
      </View>
      <Text style={[styles.subtitle, { color: theme.colors.textPrimary }]}>Days</Text>
      <View style={styles.chips}>{weekdays.map((value, index) => (
        <Chip key={value} label={value} selected={days.includes(index)} onPress={() => {
          if (id) return;
          setDays(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index].sort());
        }} />
      ))}</View>
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Button onPress={save}>Save time window</Button>
      {id ? <Button variant="danger" onPress={remove}>Delete time window</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeRow: { flexDirection: 'row', gap: 12 },
});
