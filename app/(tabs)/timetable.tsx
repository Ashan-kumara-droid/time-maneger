import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { listFixedActivities, FixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import { FreeTimeRange, listFreeTimeRanges } from '@/src/db/repositories/freeTimeRepository';
import { getProfile } from '@/src/db/repositories/profileRepository';
import { listSkippedDates, setDateSkipped } from '@/src/db/repositories/skippedDateRepository';
import {
  deleteTimetableActivitiesForDay,
  listTimeWindows,
  listTimetableActivities,
  TimeWindow,
  TimetableActivity,
} from '@/src/db/repositories/timetableRepository';
import { rebuildSchedule } from '@/src/services/schedulerService';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';
import { getWeekdayMondayZero } from '@/src/scheduler/dateUtils';
import { confirmAction } from '@/src/utils/confirmAction';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type ViewMode = 'Weekly' | 'Windows' | 'Free time' | 'Fixed activities';

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export default function TimetableScreen() {
  const { theme } = useAppTheme();
  const reloadTasks = useAppStore(state => state.reload);
  const [mode, setMode] = useState<ViewMode>('Weekly');
  const [weekOverview, setWeekOverview] = useState(false);
  const [day, setDay] = useState(() => getWeekdayMondayZero(new Date()));
  const [activities, setActivities] = useState<TimetableActivity[]>([]);
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [fixed, setFixed] = useState<FixedActivity[]>([]);
  const [freeTime, setFreeTime] = useState<FreeTimeRange[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [occupation, setOccupation] = useState('university');
  const [error, setError] = useState('');
  const colors = theme.colors;

  const loadData = useCallback(() => Promise.all([
    listTimetableActivities(), listTimeWindows(), listFixedActivities(), listSkippedDates(), getProfile(), listFreeTimeRanges(),
  ]), []);
  const refresh = useCallback(async () => {
    try {
      const [loadedActivities, loadedWindows, loadedFixed, loadedSkipped, profile, loadedFreeTime] = await loadData();
      setActivities(loadedActivities);
      setWindows(loadedWindows);
      setFixed(loadedFixed);
      setSkipped(loadedSkipped);
      setOccupation(profile?.occupation ?? 'university');
      setFreeTime(loadedFreeTime);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loadData]);
  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const weeklyDay = activities.filter(item => item.day_of_week === day).sort((a, b) => a.start_min - b.start_min);
  const dayWindows = windows.filter(item => item.day_of_week === day).sort((a, b) => a.start_min - b.start_min);
  const dayFreeTime = freeTime.filter(item => item.day_of_week === day).sort((a, b) => a.start_min - b.start_min);
  const datedFreeTime = freeTime.filter(item => item.date !== null).sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? '') || a.start_min - b.start_min,
  );
  const upcomingFixed = fixed.slice().sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const activeHours = { start: 360, end: 1380 };
  const intervals = weeklyDay
    .filter(item => item.end_min > activeHours.start && item.start_min < activeHours.end)
    .map(item => ({ start: Math.max(activeHours.start, item.start_min), end: Math.min(activeHours.end, item.end_min) }))
    .sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let gapCursor = activeHours.start;
  for (const interval of intervals) {
    if (interval.start > gapCursor) gaps.push({ start: gapCursor, end: interval.start });
    gapCursor = Math.max(gapCursor, interval.end);
  }
  if (gapCursor < activeHours.end) gaps.push({ start: gapCursor, end: activeHours.end });

  const deleteActivity = async (activity: TimetableActivity) => {
    if (!await confirmAction('Remove this activity?', activity.title, 'Remove')) return;
    try {
      const { deleteTimetableActivity } = await import('@/src/db/repositories/timetableRepository');
      await deleteTimetableActivity(activity.id);
      await rebuildSchedule('timetable_change');
      await refresh();
      await reloadTasks();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const clearDay = async () => {
    if (!weeklyDay.length || !await confirmAction(
      `Clear ${days[day]} activities?`,
      'This removes every weekly activity on this day. Linked study tasks will be kept.',
      'Clear day',
    )) return;
    try {
      await deleteTimetableActivitiesForDay(day);
      await rebuildSchedule('timetable_change');
      await refresh();
      await reloadTasks();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const toggleHoliday = () => {
    const isSkipped = skipped.includes(todayKey);
    setDateSkipped(todayKey, !isSkipped)
      .then(async () => { await rebuildSchedule('timetable_change'); await refresh(); await reloadTasks(); })
      .catch(caught => setError(String(caught)));
  };

  const copyToWeekdays = async (activity: TimetableActivity) => {
    try {
      const { saveTimetableActivity, listTimetableActivities: list } = await import('@/src/db/repositories/timetableRepository');
      const existing = await list();
      for (const targetDay of [0, 1, 2, 3, 4]) {
        if (targetDay === activity.day_of_week) continue;
        const conflict = existing.some(item =>
          item.day_of_week === targetDay && item.start_min < activity.end_min && item.end_min > activity.start_min,
        );
        if (conflict) continue;
        await saveTimetableActivity({
          ...activity,
          id: `${activity.id}-copy-${targetDay}`,
          day_of_week: targetDay,
        });
      }
      await rebuildSchedule('timetable_change');
      await refresh();
      await reloadTasks();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const heading = mode === 'Weekly' ? `${days[day]} activities`
    : mode === 'Windows' ? `${days[day]} time windows`
      : mode === 'Free time' ? `${days[day]} free time` : 'One-off fixed activities';

  return (
    <Screen contentContainerStyle={styles.page}>
      <View style={styles.heading}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Timetable</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Fixed commitments and available time</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {(['Weekly', 'Windows', 'Free time', 'Fixed activities'] as const).map(value => (
          <Chip key={value} label={value} selected={mode === value} onPress={() => setMode(value)} />
        ))}
      </View>
      {mode !== 'Fixed activities' ? (
        <View style={styles.chips}>
          {days.map((value, index) => (
            <Chip key={value} label={dayShort[index]} selected={day === index} onPress={() => setDay(index)} />
          ))}
        </View>
      ) : null}
      {mode === 'Weekly' ? (
        <View style={styles.chips}>
          <Chip label="Day view" selected={!weekOverview} onPress={() => setWeekOverview(false)} />
          <Chip label="Week overview" selected={weekOverview} onPress={() => setWeekOverview(true)} />
        </View>
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{heading}</Text>

      {mode === 'Weekly' && weekOverview ? days.map((weekday, weekdayIndex) => (
        <Card key={weekday} style={styles.activityRow}>
          <View style={[styles.colorMark, { backgroundColor: colors.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{weekday}</Text>
            {activities.filter(item => item.day_of_week === weekdayIndex).sort((a, b) => a.start_min - b.start_min).length
              ? activities.filter(item => item.day_of_week === weekdayIndex).sort((a, b) => a.start_min - b.start_min).map(item => (
                <Text key={item.id} style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {formatMinutes(item.start_min)}–{formatMinutes(item.end_min)} · {item.title}
                </Text>
              ))
              : <Text style={[styles.subtitle, { color: colors.textSecondary }]}>No fixed commitments</Text>}
          </View>
          <Button variant="outline" onPress={() => { setDay(weekdayIndex); setWeekOverview(false); }}>Open day</Button>
        </Card>
      )) : null}

      {mode === 'Weekly' && !weekOverview ? (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Activity options for {occupation === 'school' ? 'school' : occupation === 'professional' ? 'work' : 'university'} schedules.
          </Text>
          {weeklyDay.length ? weeklyDay.map(activity => (
            <Card key={activity.id} style={styles.activityRow}>
              <View style={[styles.colorMark, { backgroundColor: activity.color ?? colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{activity.title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {formatMinutes(activity.start_min)}–{formatMinutes(activity.end_min)} · {activity.type}
                </Text>
                {activity.location ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{activity.location}</Text> : null}
                {activity.notes ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{activity.notes}</Text> : null}
              </View>
              <View style={styles.actionColumn}>
                <Link href={{ pathname: '/timetable/edit-activity', params: { id: activity.id } }} asChild>
                  <Button variant="outline" onPress={() => undefined}>Edit</Button>
                </Link>
                <Button variant="danger" onPress={() => deleteActivity(activity)}>Remove</Button>
                <Button variant="secondary" onPress={() => copyToWeekdays(activity)}>Copy weekdays</Button>
              </View>
            </Card>
          )) : <Card><Text style={[styles.subtitle, { color: colors.textSecondary }]}>No fixed activities. Add classes, work, or other commitments.</Text></Card>}
          <Link href={{ pathname: '/timetable/edit-activity', params: { day: String(day) } }} asChild>
            <Button onPress={() => undefined}>+ Add weekly activity</Button>
          </Link>
          {weeklyDay.length ? (
            <Button variant="danger" onPress={clearDay}>Clear {days[day]} activities</Button>
          ) : null}
          <Button variant="outline" onPress={toggleHoliday}>
            {skipped.includes(todayKey) ? 'Restore today’s weekly timetable' : 'Skip weekly timetable today'}
          </Button>
        </>
      ) : null}

      {mode === 'Windows' ? (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Unassigned free gaps can be used for focus tasks. Mark travel periods to reserve them for travel-friendly tasks.
          </Text>
          {dayWindows.map(window => (
            <Card key={window.id} style={styles.activityRow}>
              <View style={[styles.colorMark, { backgroundColor: window.kind === 'travel' ? colors.travelColor : colors.focusColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{window.label || `${window.kind} window`}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {formatMinutes(window.start_min)}–{formatMinutes(window.end_min)} · {window.kind}
                </Text>
              </View>
              <Link href={{ pathname: '/timetable/edit-window', params: { id: window.id } }} asChild>
                <Button variant="outline" onPress={() => undefined}>Edit</Button>
              </Link>
            </Card>
          ))}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Free gaps</Text>
          {gaps.map((gap, index) => (
            <Card key={`${gap.start}-${gap.end}`} style={styles.gapCard}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>
                  Unassigned free time · {gap.end - gap.start} min
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {formatMinutes(gap.start)}–{formatMinutes(gap.end)} · focus-capable by default
                </Text>
              </View>
              <View style={styles.gapActions}>
                <Button variant="outline" onPress={() => router.push({
                  pathname: '/timetable/edit-window',
                  params: { day: String(day), start: formatMinutes(gap.start), end: formatMinutes(gap.end), kind: 'focus' },
                })}>Focus</Button>
                <Button variant="outline" onPress={() => router.push({
                  pathname: '/timetable/edit-window',
                  params: { day: String(day), start: formatMinutes(gap.start), end: formatMinutes(gap.end), kind: 'travel' },
                })}>Travel</Button>
              </View>
            </Card>
          ))}
          <Link href={{ pathname: '/timetable/edit-window', params: { day: String(day) } }} asChild>
            <Button onPress={() => undefined}>+ Add time window</Button>
          </Link>
        </>
      ) : null}

      {mode === 'Free time' ? (
        <>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your preferences are distinct from fixed commitments. Overlapping periods are clipped to the actual available portion in Calendar.
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Every {days[day]}</Text>
          {dayFreeTime.length ? dayFreeTime.map(range => (
            <Card key={range.id} style={styles.activityRow}>
              <View style={[styles.colorMark, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>
                  {formatMinutes(range.start_min)}–{formatMinutes(range.end_min)}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {range.preferences || 'Preferred free time'}
                </Text>
              </View>
              <Link href={{ pathname: '/timetable/free-time', params: { id: range.id } }} asChild>
                <Button variant="outline" onPress={() => undefined}>Edit</Button>
              </Link>
            </Card>
          )) : <Card><Text style={[styles.subtitle, { color: colors.textSecondary }]}>No weekly free-time preferences for {days[day]}.</Text></Card>}
          <Link href={{ pathname: '/timetable/free-time', params: { day: String(day) } }} asChild>
            <Button onPress={() => undefined}>+ Add weekly free time</Button>
          </Link>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Date-specific free time</Text>
          {datedFreeTime.length ? datedFreeTime.map(range => (
            <Card key={range.id} style={styles.activityRow}>
              <View style={[styles.colorMark, { backgroundColor: colors.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>
                  {range.date} · {formatMinutes(range.start_min)}–{formatMinutes(range.end_min)}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {range.preferences || 'Preferred free time'}
                </Text>
              </View>
              <Link href={{ pathname: '/timetable/free-time', params: { id: range.id } }} asChild>
                <Button variant="outline" onPress={() => undefined}>Edit</Button>
              </Link>
            </Card>
          )) : <Card><Text style={[styles.subtitle, { color: colors.textSecondary }]}>No date-specific free time saved.</Text></Card>}
          <Link href="/timetable/free-time" asChild>
            <Button variant="outline" onPress={() => undefined}>+ Add a date-specific range</Button>
          </Link>
        </>
      ) : null}

      {mode === 'Fixed activities' ? (
        <>
          {upcomingFixed.map(activity => (
            <Card key={activity.id} style={styles.activityRow}>
              <View style={[styles.colorMark, { backgroundColor: colors.travelColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{activity.title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {activity.date} · {formatMinutes(activity.start_min)}–{formatMinutes(activity.end_min)}
                </Text>
                {activity.notes ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{activity.notes}</Text> : null}
              </View>
              <Button variant="outline" onPress={() => router.push({ pathname: '/timetable/fixed-activity', params: { id: activity.id } })}>Edit</Button>
            </Card>
          ))}
          <Link href="/timetable/fixed-activity" asChild>
            <Button onPress={() => undefined}>+ Add one-off activity</Button>
          </Link>
        </>
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 18 },
  sectionTitle: { ...typography.subtitle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  colorMark: { width: 6, borderRadius: 6, alignSelf: 'stretch' },
  activityTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  actionColumn: { alignItems: 'stretch', gap: 6 },
  gapCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gapActions: { gap: 6 },
});
