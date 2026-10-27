import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getDatabase } from '@/src/db/client';
import { deleteTimetableActivity, listTimetableActivities, saveTimetableActivity } from '@/src/db/repositories/timetableRepository';
import { listTasks, TaskRecord } from '@/src/db/repositories/taskRepository';
import { rebuildSchedule } from '@/src/services/schedulerService';
import { getWeekdayMondayZero } from '@/src/scheduler/dateUtils';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import * as Crypto from 'expo-crypto';
import { typography } from '@/src/theme/tokens';
import { confirmAction } from '@/src/utils/confirmAction';
import { getSetting } from '@/src/db/repositories/settingsRepository';
import { getUniversityDegreeType, isUniversityDegreeType } from '@/src/university/degreeTypes';

const occupationTypes: Record<string, string[]> = {
  university: ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Exam', 'Other university activity'],
  school: ['Class', 'Break', 'Tuition', 'Sports / Club', 'Other'],
  professional: ['Work hours', 'Meeting', 'Shift', 'Commute', 'Other commitment'],
};

const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const parseTime = (value: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export default function EditActivityScreen() {
  const { id, day } = useLocalSearchParams<{ id?: string; day?: string }>();
  const { theme } = useAppTheme();
  const reload = useAppStore(state => state.reload);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Lecture');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [days, setDays] = useState<number[]>([
    day !== undefined ? Number(day) : getWeekdayMondayZero(new Date()),
  ]);
  const [types, setTypes] = useState(occupationTypes.university);
  const [studyTasks, setStudyTasks] = useState<TaskRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      import('@/src/db/repositories/profileRepository').then(module => module.getProfile()),
      id ? listTimetableActivities().then(all => all.find(item => item.id === id) ?? null) : Promise.resolve(null),
      id ? listTasks().then(all => all.filter(task => task.linked_activity_id === id)) : Promise.resolve([]),
      getSetting('theme_degree_type'),
    ]).then(([profile, activity, linkedTasks, storedDegreeType]) => {
      if (!active) return;
      setStudyTasks(linkedTasks);
      const degreeTypes = isUniversityDegreeType(storedDegreeType)
        ? getUniversityDegreeType(storedDegreeType).activityTypes
        : [];
      const baseTypes = occupationTypes[profile?.occupation ?? 'university'] ?? occupationTypes.university;
      const options = profile?.occupation === 'university'
        ? [...baseTypes, ...degreeTypes]
        : baseTypes;
      const availableTypes = activity && !options.includes(activity.type)
        ? [...options, activity.type]
        : options;
      setTypes(availableTypes);
      setType(activity?.type ?? availableTypes[0]);
      if (activity) {
        setTitle(activity.title);
        setStart(`${String(Math.floor(activity.start_min / 60)).padStart(2, '0')}:${String(activity.start_min % 60).padStart(2, '0')}`);
        setEnd(`${String(Math.floor(activity.end_min / 60)).padStart(2, '0')}:${String(activity.end_min % 60).padStart(2, '0')}`);
        setLocation(activity.location ?? '');
        setNotes(activity.notes ?? '');
        setDays([activity.day_of_week]);
      }
    }).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
    return () => { active = false; };
  }, [id]);

  const toggleDay = (index: number) => {
    if (id) return;
    setDays(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index].sort());
  };

  const save = async () => {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    if (!title.trim()) { setError('Activity name is required.'); return; }
    if (startMin === null || endMin === null || endMin <= startMin) {
      setError('Enter valid HH:mm times, with the end after the start.');
      return;
    }
    if (!days.length) { setError('Choose at least one day.'); return; }
    setLoading(true);
    try {
      const existing = await listTimetableActivities();
      const activityIds = days.map((targetDay, index) =>
        id && index === 0 ? id : Crypto.randomUUID(),
      );
      for (const targetDay of days) {
        const conflict = existing.find(item =>
          item.day_of_week === targetDay
          && item.id !== id
          && item.start_min < endMin
          && item.end_min > startMin,
        );
        if (conflict) throw new Error(`${allDays[targetDay]} conflicts with “${conflict.title}” (${String(Math.floor(conflict.start_min / 60)).padStart(2, '0')}:${String(conflict.start_min % 60).padStart(2, '0')}–${String(Math.floor(conflict.end_min / 60)).padStart(2, '0')}:${String(conflict.end_min % 60).padStart(2, '0')}).`);
      }
      await getDatabase().withTransactionAsync(async () => {
        for (const [index, targetDay] of days.entries()) {
          await saveTimetableActivity({
            id: activityIds[index],
            day_of_week: targetDay,
            start_min: startMin,
            end_min: endMin,
            title: title.trim(),
            type,
            location: location.trim() || null,
            notes: notes.trim() || null,
            color: theme.colors.primary,
            is_active: 1,
          });
        }
      });
      await rebuildSchedule('timetable_change');
      await reload();
      if (!id && type.toLowerCase().includes('lecture')) {
        router.replace({ pathname: '/timetable/edit-activity', params: { id: activityIds[0] } });
      } else {
        router.back();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!id || !await confirmAction('Delete activity?', title)) return;
    try {
      await deleteTimetableActivity(id);
      await rebuildSchedule('timetable_change');
      await reload();
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{id ? 'Edit activity' : 'Add weekly activity'}</Text>
      <Input label="Activity name" value={title} onChangeText={setTitle} placeholder="e.g. Physics lecture" />
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Activity type</Text>
      <View style={styles.chips}>{types.map(value => <Chip key={value} label={value} selected={type === value} onPress={() => setType(value)} />)}</View>
      <View style={styles.timeRow}>
        <Input label="Start (HH:mm)" value={start} onChangeText={setStart} placeholder="09:00" />
        <Input label="End (HH:mm)" value={end} onChangeText={setEnd} placeholder="10:00" />
      </View>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Repeats on</Text>
      <View style={styles.chips}>{allDays.map((value, index) => (
        <Chip key={value} label={value} selected={days.includes(index)} onPress={() => toggleDay(index)} />
      ))}</View>
      <Input label="Location" value={location} onChangeText={setLocation} placeholder="Optional" />
      <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      {id && type.toLowerCase().includes('lecture') ? (
        <>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Study tasks</Text>
          <Text style={{ color: theme.colors.textSecondary }}>
            Add preparation before this lecture or revision after it. Choose the session date, time, duration, notes, and reminder; timetable conflicts are checked before saving.
          </Text>
          {studyTasks.map(task => (
            <Button
              key={task.id}
              variant="outline"
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}>
              {task.title} · {task.status}
            </Button>
          ))}
          <View style={styles.chips}>
            <Button variant="outline" onPress={() => router.push({
              pathname: '/task/new',
              params: { linkedActivityId: id, studyType: 'preparation' },
            })}>Plan preparation</Button>
            <Button variant="outline" onPress={() => router.push({
              pathname: '/task/new',
              params: { linkedActivityId: id, studyType: 'revision' },
            })}>Plan revision</Button>
          </View>
        </>
      ) : null}
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Button loading={loading} onPress={save}>
        {!id && type.toLowerCase().includes('lecture') ? 'Save and plan study sessions' : 'Save activity'}
      </Button>
      {id ? <Button variant="danger" onPress={remove}>Delete activity</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeRow: { flexDirection: 'row', gap: 12 },
});
