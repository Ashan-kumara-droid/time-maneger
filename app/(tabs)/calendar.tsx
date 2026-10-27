import { Calendar, DateData } from 'react-native-calendars';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Snackbar } from '@/components/ui/Snackbar';
import { useAppStore } from '@/src/stores/useAppStore';
import { listFixedActivities, FixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import { FreeTimeRange, listFreeTimeRanges } from '@/src/db/repositories/freeTimeRepository';
import { TaskRecord } from '@/src/db/repositories/taskRepository';
import { SessionRecord } from '@/src/db/repositories/sessionRepository';
import { listTimetableActivities, TimetableActivity } from '@/src/db/repositories/timetableRepository';
import { getWeekdayMondayZero, toDateKey } from '@/src/scheduler/dateUtils';
import { getRangeDuration } from '@/src/scheduler/dayTimeline';
import { partitionFreeTime } from '@/src/scheduler/freeTime';
import { DEFAULT_SCHEDULER_SETTINGS } from '@/src/scheduler/types';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { SemanticColors } from '@/src/theme/palettes';
import { typography } from '@/src/theme/tokens';

type TimelineItem = {
  id: string;
  start: number;
  end: number;
  title: string;
  subtitle: string;
  color: string;
  isSession: boolean;
  sessionId?: string;
  availabilityKind?: 'preferred' | 'available';
};

function getDayTimeline(
  date: string,
  timetable: TimetableActivity[],
  fixedActivities: FixedActivity[],
  freeTimeRanges: FreeTimeRange[],
  sessions: SessionRecord[],
  taskMap: Map<string, TaskRecord>,
  colors: SemanticColors,
): TimelineItem[] {
  const dateObject = new Date(`${date}T00:00:00`);
  const dayOfWeek = getWeekdayMondayZero(dateObject);
  const previousDay = (dayOfWeek + 6) % 7;
  const timeline: TimelineItem[] = [
    ...timetable.filter(item => item.day_of_week === dayOfWeek && item.is_active).map(item => ({
      id: `weekly-${item.id}`,
      start: item.start_min,
      end: Math.min(1440, item.end_min),
      title: item.title,
      subtitle: item.type,
      color: item.color ?? colors.textSecondary,
      isSession: false,
    })),
    ...fixedActivities.filter(item => item.date === date).map(item => ({
      id: `fixed-${item.id}`,
      start: item.start_min,
      end: Math.min(1440, item.end_min),
      title: item.title,
      subtitle: 'Fixed activity',
      color: item.color ?? colors.travelColor,
      isSession: false,
    })),
    ...sessions.flatMap(item => {
      if (item.status === 'skipped') return [];
      const startAt = new Date(item.start_at);
      const endAt = new Date(item.end_at);
      const startDate = toDateKey(startAt);
      const endDate = toDateKey(endAt);
      const segment = startDate === date
        ? {
          start: startAt.getHours() * 60 + startAt.getMinutes(),
          end: endDate === date ? endAt.getHours() * 60 + endAt.getMinutes() : 1440,
        }
        : endDate === date ? { start: 0, end: endAt.getHours() * 60 + endAt.getMinutes() } : null;
      if (!segment || segment.end <= segment.start) return [];
      return [{
        id: item.id,
        start: segment.start,
        end: segment.end,
        title: taskMap.get(item.task_id)?.title ?? 'Task session',
        subtitle: `${item.status} · ${item.planned_minutes} min`,
        color: taskMap.get(item.task_id)?.priority === 'high' ? colors.priorityHigh : colors.primary,
        isSession: item.status === 'planned',
        sessionId: item.id,
      }];
    }),
  ];

  const previousDate = new Date(dateObject);
  previousDate.setDate(previousDate.getDate() - 1);
  const overnight = [
    ...timetable
      .filter(item => item.day_of_week === previousDay && item.is_active && item.end_min > 1440)
      .map(item => ({
        id: `weekly-overnight-${item.id}`,
        end: item.end_min - 1440,
        title: item.title,
        subtitle: `${item.type} · continues from yesterday`,
        color: item.color ?? colors.textSecondary,
      })),
    ...fixedActivities
      .filter(item => item.date === toDateKey(previousDate) && item.end_min > 1440)
      .map(item => ({
        id: `fixed-overnight-${item.id}`,
        end: item.end_min - 1440,
        title: item.title,
        subtitle: 'Fixed activity · continues from yesterday',
        color: item.color ?? colors.travelColor,
      })),
  ];
  timeline.push(...overnight.map(item => ({
    ...item,
    start: 0,
    end: Math.min(1440, item.end),
    isSession: false,
  })));

  const dayPreferences = freeTimeRanges
    .filter(item => item.date === date || (item.date === null && item.day_of_week === dayOfWeek))
    .map(item => ({
      id: item.id,
      start: item.start_min,
      end: item.end_min,
      preferences: item.preferences,
    }));
  const availability = partitionFreeTime(
    timeline.map(item => ({ start: item.start, end: item.end })),
    dayPreferences,
    DEFAULT_SCHEDULER_SETTINGS.activeStartMin,
    DEFAULT_SCHEDULER_SETTINGS.activeEndMin,
  );
  timeline.push(...availability.map((range, index) => ({
    id: `${range.kind}-${date}-${index}`,
    start: range.start,
    end: range.end,
    title: range.kind === 'preferred' ? 'Preferred free time' : 'Available time',
    subtitle: `${range.label}${range.kind === 'preferred' ? ` · ${range.end - range.start} min` : ` · ${range.end - range.start} min open`}`,
    color: range.kind === 'preferred' ? colors.accent : colors.success,
    isSession: false,
    availabilityKind: range.kind,
  })));

  return timeline.sort((a, b) => a.start - b.start || a.end - b.end);
}

export default function CalendarScreen() {
  const { theme } = useAppTheme();
  const tasks = useAppStore(state => state.tasks);
  const sessions = useAppStore(state => state.sessions);
  const reload = useAppStore(state => state.reload);
  const completeSession = useAppStore(state => state.completeSession);
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const [selectedDate, setSelectedDate] = useState(() =>
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toDateKey(new Date()),
  );
  const [fixedActivities, setFixedActivities] = useState<FixedActivity[]>([]);
  const [freeTimeRanges, setFreeTimeRanges] = useState<FreeTimeRange[]>([]);
  const [timetable, setTimetable] = useState<TimetableActivity[]>([]);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const [viewMode, setViewMode] = useState('Day');

  useEffect(() => {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) setSelectedDate(dateParam);
    });
    return () => { active = false; };
  }, [dateParam]);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([listFixedActivities(), listTimetableActivities(), listFreeTimeRanges()]).then(([fixed, weekly, freeRanges]) => {
      if (!active) return;
      setFixedActivities(fixed);
      setTimetable(weekly);
      setFreeTimeRanges(freeRanges);
    }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught));
    });
    reload();
    return () => { active = false; };
  }, [reload]));

  const colors = theme.colors;
  const taskMap = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const daySessions = sessions.filter(item =>
    (item.date === selectedDate || toDateKey(new Date(item.end_at)) === selectedDate)
    && item.status !== 'skipped',
  );
  const timeline = getDayTimeline(selectedDate, timetable, fixedActivities, freeTimeRanges, sessions, taskMap, colors);
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const weekStart = new Date(selectedDateObject);
  weekStart.setDate(weekStart.getDate() - getWeekdayMondayZero(weekStart));
  const weekTimeline = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date: dateKey,
      label: date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      items: getDayTimeline(dateKey, timetable, fixedActivities, freeTimeRanges, sessions, taskMap, colors),
    };
  });

  const markedDates: Record<string, object> = {};
  const today = toDateKey(new Date());
  for (const session of sessions) {
    const task = taskMap.get(session.task_id);
    if (!task || session.status === 'skipped') continue;
    const color = task.priority === 'high' ? colors.priorityHigh : task.priority === 'medium' ? colors.priorityMedium : colors.priorityLow;
    const entry = (markedDates[session.date] as { dots?: { key: string; color: string }[] } | undefined) ?? { dots: [] };
    const dots = entry.dots ?? [];
    if (!dots.some(dot => dot.key === task.priority)) dots.push({ key: task.priority, color });
    markedDates[session.date] = { ...entry, dots, marked: true };
  }
  for (const activity of fixedActivities) {
    const entry = (markedDates[activity.date] as { dots?: { key: string; color: string }[] } | undefined) ?? { dots: [] };
    markedDates[activity.date] = {
      ...entry,
      dots: [...(entry.dots ?? []).filter(dot => dot.key !== 'fixed'), { key: 'fixed', color: colors.travelColor }],
      marked: true,
    };
  }
  markedDates[selectedDate] = { ...(markedDates[selectedDate] ?? {}), selected: true, selectedColor: colors.primary };
  markedDates[today] = { ...(markedDates[today] ?? {}), marked: true, ...(selectedDate === today ? { selected: true, selectedColor: colors.primary } : {}) };

  const plannedMinutes = daySessions.filter(session => session.status === 'planned').reduce((sum, session) => sum + session.planned_minutes, 0);
  const availableMinutes = getRangeDuration(
    timeline.filter(item => item.availabilityKind).map(item => ({ start: item.start, end: item.end })),
  );

  const handleDayPress = (day: DateData) => setSelectedDate(day.dateString);
  const refreshAndComplete = async (id: string) => {
    try {
      const undoAction = await completeSession(id);
      setUndo(() => undoAction);
      setError('Session completed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <View style={styles.heading}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Calendar</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <Button variant="outline" onPress={() => setSelectedDate(today)}>Today</Button>
      </View>
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          calendarBackground: colors.surface,
          monthTextColor: colors.textPrimary,
          dayTextColor: colors.textPrimary,
          textDisabledColor: colors.textSecondary,
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: '#FFFFFF',
          textMonthFontFamily: 'Poppins_600SemiBold',
          textDayFontFamily: 'Inter_400Regular',
          textDayHeaderFontFamily: 'Inter_500Medium',
        }}
      />
      <Segmented
        options={['Day', 'Week']}
        value={viewMode}
        onChange={setViewMode}
        accessibilityLabel="Schedule view"
      />
      <Card style={styles.summary}>
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
          {viewMode === 'Day' ? 'Day overview' : 'Selected day overview'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {daySessions.filter(item => item.status === 'planned').length} sessions · {plannedMinutes} min planned · {availableMinutes} min available (06:00–23:00)
        </Text>
      </Card>
      {viewMode === 'Day' ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Schedule</Text>
          {timeline.length ? timeline.map(item => (
            <Card key={item.id} style={styles.timelineRow}>
              <View style={[styles.timelineBar, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {`${String(Math.floor(item.start / 60)).padStart(2, '0')}:${String(item.start % 60).padStart(2, '0')}–${String(Math.floor(item.end / 60)).padStart(2, '0')}:${String(item.end % 60).padStart(2, '0')} · ${item.subtitle}`}
                </Text>
              </View>
              {item.isSession && item.sessionId ? <Button onPress={() => refreshAndComplete(item.sessionId!)}>Done</Button> : null}
            </Card>
          )) : (
            <Card><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Nothing scheduled on this day. Your future plan will appear here as you add tasks and timetable activities.</Text></Card>
          )}
        </>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>This week</Text>
          {weekTimeline.map(day => (
            <View key={day.date} style={styles.weekDay}>
              <Button
                variant="outline"
                onPress={() => { setSelectedDate(day.date); setViewMode('Day'); }}>
                {day.label}
              </Button>
              {day.items.length ? day.items.map(item => (
                <Card key={item.id} style={styles.timelineRow}>
                  <View style={[styles.timelineBar, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                      {`${String(Math.floor(item.start / 60)).padStart(2, '0')}:${String(item.start % 60).padStart(2, '0')}–${String(Math.floor(item.end / 60)).padStart(2, '0')}:${String(item.end % 60).padStart(2, '0')} · ${item.subtitle}`}
                    </Text>
                  </View>
                  {item.isSession && item.sessionId ? <Button onPress={() => refreshAndComplete(item.sessionId!)}>Done</Button> : null}
                </Card>
              )) : (
                <Card><Text style={[styles.subtitle, { color: colors.textSecondary }]}>No scheduled activities.</Text></Card>
              )}
            </View>
          ))}
        </>
      )}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Snackbar
        visible={!!undo}
        message={error}
        actionLabel="Undo"
        onAction={() => undo?.().then(() => { setUndo(null); setError('Completion undone.'); }).catch(caught => setError(String(caught)))}
        onDismiss={() => setUndo(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 18 },
  summary: { gap: 4 },
  summaryTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { ...typography.subtitle },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineBar: { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  sessionTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  weekDay: { gap: 8 },
});
