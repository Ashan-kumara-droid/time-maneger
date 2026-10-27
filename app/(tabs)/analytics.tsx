import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { listFixedActivities, FixedActivity } from '@/src/db/repositories/fixedActivityRepository';
import { listTimetableActivities, TimetableActivity } from '@/src/db/repositories/timetableRepository';
import {
  AnalyticsPeriod,
  getAnalyticsRange,
  getDatesInRange,
  shiftAnalyticsAnchor,
  summarizeAnalytics,
} from '@/src/scheduler/analytics';
import { fromDateKey, toDateKey } from '@/src/scheduler/dateUtils';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';

const periods: { id: AnalyticsPeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatTimeRange(start: string, end: string, period: AnalyticsPeriod) {
  const startDate = fromDateKey(start);
  const endDate = fromDateKey(end);
  if (period === 'day') {
    return startDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  if (period === 'month') {
    return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startLabel = startDate.toLocaleDateString(undefined, { month: sameMonth ? undefined : 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

export default function AnalyticsScreen() {
  const { theme } = useAppTheme();
  const tasks = useAppStore(state => state.tasks);
  const sessions = useAppStore(state => state.sessions);
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [weeklyActivities, setWeeklyActivities] = useState<TimetableActivity[]>([]);
  const [fixedActivities, setFixedActivities] = useState<FixedActivity[]>([]);
  const [error, setError] = useState('');
  const colors = theme.colors;

  useEffect(() => {
    let active = true;
    Promise.all([listTimetableActivities(), listFixedActivities()]).then(([weekly, fixed]) => {
      if (!active) return;
      setWeeklyActivities(weekly);
      setFixedActivities(fixed);
    }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { active = false; };
  }, []);

  const range = useMemo(() => getAnalyticsRange(anchor, period), [anchor, period]);
  const summary = useMemo(
    () => summarizeAnalytics(sessions, tasks, range, new Date(), weeklyActivities, fixedActivities),
    [sessions, tasks, range, weeklyActivities, fixedActivities],
  );
  const dates = useMemo(() => getDatesInRange(range), [range]);
  const dateSummaries = useMemo(() => dates.map(date => {
    const daySessions = sessions.filter(session => session.date === date && session.status !== 'skipped');
    const completed = daySessions.filter(session => session.status === 'done').length;
    const pending = daySessions.filter(session => session.status === 'planned').length;
    const missed = daySessions.filter(session => session.status === 'missed').length;
    return { date, total: daySessions.length, completed, pending, missed };
  }), [dates, sessions]);
  const completionRate = summary.scheduledCount
    ? Math.round(summary.completedCount / summary.scheduledCount * 100)
    : 0;
  const maxCategoryMinutes = Math.max(1, ...summary.categories.map(item => item.plannedMinutes));
  const isCurrentRange = range.start <= toDateKey(new Date()) && range.end >= toDateKey(new Date());

  return (
    <Screen contentContainerStyle={styles.page}>
      <View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Productivity</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Trends from recorded sessions and your saved timetable.
        </Text>
      </View>

      <View style={styles.chips}>
        {periods.map(item => (
          <Chip key={item.id} label={item.label} selected={period === item.id} onPress={() => setPeriod(item.id)} />
        ))}
      </View>

      <View style={styles.rangeControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous period"
          onPress={() => setAnchor(current => shiftAnalyticsAnchor(current, period, -1))}
          style={[styles.arrow, { borderColor: colors.border }]}>
          <Text style={[styles.arrowText, { color: colors.primary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.rangeTitle, { color: colors.textPrimary }]}>
          {formatTimeRange(range.start, range.end, period)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next period"
          onPress={() => setAnchor(current => shiftAnalyticsAnchor(current, period, 1))}
          style={[styles.arrow, { borderColor: colors.border }]}>
          <Text style={[styles.arrowText, { color: colors.primary }]}>›</Text>
        </Pressable>
      </View>
      {!isCurrentRange ? (
        <Chip label="Today" selected={false} onPress={() => setAnchor(new Date())} />
      ) : null}

      {summary.scheduledCount || summary.fixedMinutes || summary.overdueTasks ? (
        <>
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Session completion</Text>
              <Text style={[styles.percent, { color: colors.primary }]}>{completionRate}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.fill, { width: `${completionRate}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {summary.completedCount} completed · {summary.pendingCount} pending · {summary.missedCount} missed
            </Text>
          </Card>

          <View style={styles.metrics}>
            <Metric label="Fixed time" value={formatMinutes(summary.fixedMinutes)} color={colors.travelColor} />
            <Metric label="Available" value={formatMinutes(summary.freeMinutes)} color={colors.success} />
            <Metric label="Task sessions" value={formatMinutes(summary.scheduledMinutes)} color={colors.primary} />
            <Metric label="Travel" value={formatMinutes(summary.travelMinutes)} color={colors.accent} />
            <Metric label="Completed time" value={formatMinutes(summary.completedMinutes)} color={colors.focusColor} />
            <Metric label="Overdue tasks" value={String(summary.overdueTasks)} color={colors.danger} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Daily progress</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Tap a day to open its schedule</Text>
          </View>
          <Card style={styles.listCard}>
            {dateSummaries.map((item, index) => {
              const rate = item.total ? Math.round(item.completed / item.total * 100) : 0;
              const dayLabel = fromDateKey(item.date).toLocaleDateString(undefined, {
                weekday: period === 'month' ? undefined : 'short',
                month: period === 'month' ? 'short' : undefined,
                day: 'numeric',
              });
              return (
                <Pressable
                  key={item.date}
                  accessibilityRole="button"
                  accessibilityLabel={`Open schedule for ${dayLabel}. ${item.completed} completed, ${item.pending} pending, ${item.missed} missed.`}
                  onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { date: item.date } })}
                  style={[styles.dayRow, index ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                  <Text style={[styles.dayLabel, { color: colors.textPrimary }]}>{dayLabel}</Text>
                  <View style={[styles.miniTrack, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.miniFill, { width: `${rate}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={[styles.dayCount, { color: colors.textSecondary }]}>{item.completed}/{item.total}</Text>
                </Pressable>
              );
            })}
          </Card>

          {summary.categories.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Planned time by category</Text>
              <Card style={styles.listCard}>
                {summary.categories.map(category => (
                  <View key={category.category} style={styles.categoryRow}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.dayLabel, { color: colors.textPrimary }]}>
                        {category.category.replace(/_/g, ' ')}
                      </Text>
                      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {formatMinutes(category.completedMinutes)} done · {formatMinutes(category.plannedMinutes)} planned
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                      <View style={[styles.fill, {
                        width: `${Math.round(category.plannedMinutes / maxCategoryMinutes * 100)}%`,
                        backgroundColor: colors.focusColor,
                      }]} />
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Daily time distribution</Text>
          <Card style={styles.listCard}>
            {summary.dailyActivityMinutes.map(day => {
              const total = Math.max(1, day.fixedMinutes + day.taskMinutes + day.freeMinutes);
              const label = fromDateKey(day.date).toLocaleDateString(undefined, {
                weekday: period === 'month' ? undefined : 'short',
                month: period === 'month' ? 'short' : undefined,
                day: 'numeric',
              });
              return (
                <Pressable
                  key={day.date}
                  accessibilityRole="button"
                  accessibilityLabel={`View time distribution for ${label}`}
                  onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { date: day.date } })}
                  style={styles.categoryRow}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.dayLabel, { color: colors.textPrimary }]}>{label}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                      {formatMinutes(day.fixedMinutes)} fixed · {formatMinutes(day.taskMinutes)} tasks · {formatMinutes(day.freeMinutes)} available
                    </Text>
                  </View>
                  <View style={[styles.track, styles.stackedTrack, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.stackedPart, { width: `${day.fixedMinutes / total * 100}%`, backgroundColor: colors.travelColor }]} />
                    <View style={[styles.stackedPart, { width: `${day.taskMinutes / total * 100}%`, backgroundColor: colors.primary }]} />
                    <View style={[styles.stackedPart, { width: `${day.freeMinutes / total * 100}%`, backgroundColor: colors.success }]} />
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            title="No analytics for this period yet"
            description="Add timetable activities or schedule tasks to see real time-use and completion data here."
          />
        </Card>
      )}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Text style={[styles.footnote, { color: colors.textSecondary }]}>
        Completion reflects explicitly marked sessions only. Available time uses the app&apos;s 06:00–23:00 planning window and excludes overlapping saved activities.
      </Text>
    </Screen>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const { theme } = useAppTheme();
  return (
    <Card style={styles.metric}>
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 36 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 30, lineHeight: 34 },
  rangeTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold', textAlign: 'center', flex: 1 },
  progressCard: { gap: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  percent: { ...typography.subtitle, fontFamily: 'Poppins_600SemiBold' },
  track: { height: 9, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '47%', minHeight: 108, gap: 5 },
  metricDot: { width: 9, height: 9, borderRadius: 5 },
  metricLabel: { ...typography.caption },
  metricValue: { ...typography.subtitle, fontFamily: 'Poppins_600SemiBold' },
  sectionHeader: { gap: 3 },
  sectionTitle: { ...typography.subtitle },
  listCard: { paddingVertical: 4 },
  dayRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dayLabel: { ...typography.caption, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize', width: 62 },
  miniTrack: { flex: 1, height: 7, borderRadius: 99, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 99 },
  dayCount: { ...typography.caption, minWidth: 36, textAlign: 'right' },
  categoryRow: { paddingVertical: 10, gap: 8 },
  stackedTrack: { flexDirection: 'row' },
  stackedPart: { height: '100%' },
  footnote: { ...typography.caption, lineHeight: 18 },
});
