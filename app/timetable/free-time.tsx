import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getDatabase } from '@/src/db/client';
import { deleteFreeTimeRange, FreeTimeRange, listFreeTimeRanges, saveFreeTimeRange } from '@/src/db/repositories/freeTimeRepository';
import { listFixedActivities } from '@/src/db/repositories/fixedActivityRepository';
import { listTimetableActivities } from '@/src/db/repositories/timetableRepository';
import { getWeekdayMondayZero, toDateKey } from '@/src/scheduler/dateUtils';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';
import { confirmAction } from '@/src/utils/confirmAction';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

export default function FreeTimeScreen() {
  const { id: idParam, day: dayParam, date: dateParam } = useLocalSearchParams<{
    id?: string | string[];
    day?: string | string[];
    date?: string | string[];
  }>();
  const id = typeof idParam === 'string' ? idParam : undefined;
  const requestedDay = typeof dayParam === 'string' && /^[0-6]$/.test(dayParam) ? Number(dayParam) : null;
  const requestedDate = typeof dateParam === 'string' && isValidDate(dateParam) ? dateParam : null;
  const { theme } = useAppTheme();
  const [scope, setScope] = useState<'weekly' | 'date'>(requestedDate ? 'date' : 'weekly');
  const [day, setDay] = useState(() => requestedDay ?? getWeekdayMondayZero(new Date()));
  const [date, setDate] = useState(requestedDate ?? toDateKey(new Date()));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [preferences, setPreferences] = useState('');
  const [ranges, setRanges] = useState<FreeTimeRange[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listFreeTimeRanges().then(items => {
      if (!active) return;
      setRanges(items);
      const current = items.find(item => item.id === id);
      if (!current) return;
      setScope(current.date ? 'date' : 'weekly');
      setDate(current.date ?? toDateKey(new Date()));
      if (current.day_of_week !== null) setDay(current.day_of_week);
      setStart(formatTime(current.start_min));
      setEnd(formatTime(current.end_min));
      setPreferences(current.preferences);
    }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { active = false; };
  }, [id]);

  const save = async () => {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    if (startMin === null || endMin === null || endMin <= startMin) {
      setError('Enter valid times as HH:mm, with the end after the start.');
      return;
    }
    if (scope === 'date' && !isValidDate(date)) {
      setError('Enter a valid date as YYYY-MM-DD.');
      return;
    }
    if (preferences.trim().length > 120) {
      setError('Keep the activity preference under 120 characters.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const [fixed, weekly] = await Promise.all([listFixedActivities(), listTimetableActivities()]);
      const dateKey = scope === 'date' ? date : null;
      const weekday = scope === 'weekly' ? day : getWeekdayMondayZero(new Date(`${date}T00:00:00`));
      const previousWeekday = (weekday + 6) % 7;
      const previousDate = dateKey
        ? new Date(`${dateKey}T00:00:00`)
        : null;
      previousDate?.setDate(previousDate.getDate() - 1);
      const previousDateKey = previousDate ? toDateKey(previousDate) : null;
      const commitments = [
        ...weekly.filter(item => item.day_of_week === weekday && item.is_active).map(item => ({
          start: item.start_min,
          end: Math.min(1440, item.end_min),
          title: item.title,
        })),
        ...weekly.filter(item => item.day_of_week === previousWeekday && item.is_active && item.end_min > 1440).map(item => ({
          start: 0,
          end: item.end_min - 1440,
          title: item.title,
        })),
        ...(dateKey ? fixed.filter(item => item.date === dateKey).map(item => ({
          start: item.start_min,
          end: Math.min(1440, item.end_min),
          title: item.title,
        })) : []),
        ...(previousDateKey ? fixed.filter(item => item.date === previousDateKey && item.end_min > 1440).map(item => ({
          start: 0,
          end: item.end_min - 1440,
          title: item.title,
        })) : []),
      ];
      const commitment = commitments.find(item => item.start < endMin && item.end > startMin);
      if (commitment) throw new Error(`This free-time range overlaps with “${commitment.title}”.`);

      const conflict = ranges.find(item => {
        if (item.id === id) return false;
        const sameScope = scope === 'weekly'
          ? item.date === null && item.day_of_week === day
          : item.date === dateKey;
        return sameScope && item.start_min < endMin && item.end_min > startMin;
      });
      if (conflict) throw new Error('This overlaps with another saved free-time range.');

      const range: FreeTimeRange = {
        id: id ?? Crypto.randomUUID(),
        day_of_week: scope === 'weekly' ? day : null,
        date: dateKey,
        start_min: startMin,
        end_min: endMin,
        preferences: preferences.trim(),
      };
      await getDatabase().withTransactionAsync(() => saveFreeTimeRange(range));
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    if (!await confirmAction('Delete free-time range?', `${start}–${end}`)) return;
    try {
      await deleteFreeTimeRange(id);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const color = theme.colors;
  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: color.textPrimary }]}>{id ? 'Edit free time' : 'Add free time'}</Text>
      <Text style={[styles.subtitle, { color: color.textSecondary }]}>
        Free time is stored separately from commitments. If it overlaps an activity or task, the unified timetable only shows its actually available portions.
      </Text>
      {!id ? (
        <>
          <Text style={[styles.label, { color: color.textPrimary }]}>Apply to</Text>
          <View style={styles.chips}>
            <Chip label="Every week" selected={scope === 'weekly'} onPress={() => setScope('weekly')} />
            <Chip label="One date" selected={scope === 'date'} onPress={() => setScope('date')} />
          </View>
          {scope === 'weekly' ? (
            <>
              <Text style={[styles.label, { color: color.textPrimary }]}>Day</Text>
              <View style={styles.chips}>
                {weekdays.map((label, index) => (
                  <Chip key={label} label={label} selected={day === index} onPress={() => setDay(index)} />
                ))}
              </View>
            </>
          ) : (
            <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-22" />
          )}
        </>
      ) : (
        <Text style={[styles.subtitle, { color: color.primary }]}>
          {scope === 'weekly' ? `Repeats every ${weekdays[day]}` : `Date: ${date}`}
        </Text>
      )}
      <View style={styles.timeRow}>
        <Input label="Start (HH:mm)" value={start} onChangeText={setStart} placeholder="09:00" />
        <Input label="End (HH:mm)" value={end} onChangeText={setEnd} placeholder="10:00" />
      </View>
      <Input
        label="Optional preference"
        value={preferences}
        onChangeText={setPreferences}
        placeholder="Study, exercise, personal time…"
        maxLength={120}
      />
      {error ? <Text style={{ color: color.danger }}>{error}</Text> : null}
      <Button loading={saving} onPress={save}>Save free time</Button>
      {id ? <Button variant="danger" onPress={remove}>Delete free time</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 19 },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeRow: { flexDirection: 'row', gap: 12 },
});
