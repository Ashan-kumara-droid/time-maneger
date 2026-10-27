import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CharacterAvatar } from '@/components/ui/CharacterAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Snackbar } from '@/components/ui/Snackbar';
import { getProfile, Profile } from '@/src/db/repositories/profileRepository';
import { SessionRecord } from '@/src/db/repositories/sessionRepository';
import { FixedActivity, listFixedActivities } from '@/src/db/repositories/fixedActivityRepository';
import { TimetableActivity, listTimetableActivities } from '@/src/db/repositories/timetableRepository';
import { getAvailableRanges } from '@/src/scheduler/dayTimeline';
import { getWeekdayMondayZero, toDateKey } from '@/src/scheduler/dateUtils';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

type HomeTimelineItem = {
  id: string;
  start: Date;
  end: Date;
  title: string;
  subtitle: string;
  color: string;
  session?: SessionRecord;
};

function localTime(date: string, minute: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setMinutes(minute);
  return value;
}

export default function HomeScreen() {
  const { theme, characterStyle } = useAppTheme();
  const tasks = useAppStore(state => state.tasks);
  const sessions = useAppStore(state => state.sessions);
  const reload = useAppStore(state => state.reload);
  const completeSession = useAppStore(state => state.completeSession);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kind, setKind] = useState('High-Focus');
  const [snackbar, setSnackbar] = useState('');
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const [now, setNow] = useState(new Date());
  const [weeklyActivities, setWeeklyActivities] = useState<TimetableActivity[]>([]);
  const [fixedActivities, setFixedActivities] = useState<FixedActivity[]>([]);
  const [scheduleError, setScheduleError] = useState('');
  const colors = theme.colors;
  const today = toDateKey(now);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([listTimetableActivities(), listFixedActivities()]).then(([weekly, fixed]) => {
      if (!active) return;
      setWeeklyActivities(weekly);
      setFixedActivities(fixed);
      setScheduleError('');
    }).catch(error => {
      if (active) setScheduleError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    getProfile().then(setProfile).catch(error => console.error('Unable to load profile', error));
    reload();
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [reload]);

  const todaySessions = sessions.filter(session => session.date === today);
  const doneToday = todaySessions.filter(session => session.status === 'done');
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const dayOfWeek = getWeekdayMondayZero(now);
  const fixedTimeline: HomeTimelineItem[] = [
    ...weeklyActivities.filter(item => item.day_of_week === dayOfWeek && item.is_active).map(item => ({
      id: `weekly-${item.id}`,
      start: localTime(today, item.start_min),
      end: localTime(today, Math.min(1440, item.end_min)),
      title: item.title,
      subtitle: item.type,
      color: item.color ?? colors.travelColor,
    })),
    ...fixedActivities.filter(item => item.date === today).map(item => ({
      id: `fixed-${item.id}`,
      start: localTime(today, item.start_min),
      end: localTime(today, item.end_min),
      title: item.title,
      subtitle: 'Fixed activity',
      color: item.color ?? colors.travelColor,
    })),
  ];
  const scheduleItems: HomeTimelineItem[] = [
    ...fixedTimeline,
    ...todaySessions.filter(session => session.status !== 'skipped').flatMap(session => {
      const task = taskById.get(session.task_id);
      if (!task || (task.kind !== (kind === 'High-Focus' ? 'focus' : 'travel') && session.status === 'planned')) return [];
      return [{
        id: session.id,
        start: new Date(session.start_at),
        end: new Date(session.end_at),
        title: task.title,
        subtitle: `${session.status === 'done' ? 'Completed' : session.status === 'missed' ? 'Missed' : 'Task'} · ${session.planned_minutes} min`,
        color: task.priority === 'high' ? colors.priorityHigh : colors.primary,
        session,
      }];
    }),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  const availableItems: HomeTimelineItem[] = getAvailableRanges(
    scheduleItems.map(item => ({
      start: item.start.getHours() * 60 + item.start.getMinutes(),
      end: item.end.getHours() * 60 + item.end.getMinutes(),
    })),
    360,
    1380,
  ).map((range, index) => ({
    id: `available-${index}`,
    start: localTime(today, range.start),
    end: localTime(today, range.end),
    title: 'Available time',
    subtitle: `${range.end - range.start} min open`,
    color: colors.success,
  }));
  const timelineItems = [...scheduleItems, ...availableItems].sort((a, b) => a.start.getTime() - b.start.getTime());
  const progress = todaySessions.length ? doneToday.length / todaySessions.length * 100 : 0;
  const currentActivity = timelineItems.find(item =>
    item.start.getTime() <= now.getTime() && item.end.getTime() > now.getTime(),
  );
  const next = currentActivity ?? timelineItems.find(item => item.start.getTime() >= now.getTime());

  const onComplete = useCallback(async (session: SessionRecord) => {
    try {
      const undoAction = await completeSession(session.id);
      setUndo(() => undoAction);
      setSnackbar('Session completed');
      const timer = setTimeout(() => setSnackbar(''), 5000);
      return () => clearTimeout(timer);
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : 'Could not complete this session.');
      return undefined;
    }
  }, [completeSession]);

  const handleUndo = async () => {
    if (!undo) return;
    try {
      await undo();
      setSnackbar('Completion undone');
      setUndo(null);
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : 'Could not undo completion.');
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.greetingRow}>
          {profile?.avatar_uri ? (
            <Image source={{ uri: profile.avatar_uri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{profile?.username.trim().charAt(0).toUpperCase() ?? 'T'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting(now.getHours())}, {profile?.username ?? 'there'}</Text>
            <Text style={styles.date}>{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          <CharacterAvatar styleId={characterStyle} size={48} accentColor="#FFFFFF" backgroundColor="rgba(255,255,255,0.22)" />
        </View>
        <View style={styles.progressRow}>
          <ProgressRing progress={progress} label="Today's completion" />
          <View style={{ flex: 1 }}>
            <Text style={styles.progressTitle}>{doneToday.length} of {todaySessions.length} sessions done</Text>
            <Text style={styles.progressSubtitle}>Small steps add up. Keep your plan realistic.</Text>
          </View>
        </View>
      </LinearGradient>

      {next ? (
        <Card style={styles.nextCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>{currentActivity ? 'HAPPENING NOW' : 'NEXT UP'}</Text>
            <Text numberOfLines={1} style={[styles.nextTitle, { color: colors.textPrimary }]}>
              {next.title}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {next.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–{next.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {next.subtitle}
            </Text>
          </View>
          <Text style={{ fontSize: 24, color: colors.primary }}>›</Text>
        </Card>
      ) : (
        <Card style={styles.nextCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>NEXT UP</Text>
            <Text style={[styles.nextTitle, { color: colors.textPrimary }]}>No sessions coming up</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>Add a task or create an availability window.</Text>
          </View>
          <Link href="/task/new" asChild><Button onPress={() => undefined}>Add task</Button></Link>
        </Card>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Today&apos;s plan</Text>
        <Link href="/(tabs)/calendar" style={[styles.link, { color: colors.primary }]}>View day</Link>
      </View>
      <View style={styles.quickActionBar}>
        <Link href="/task/new" asChild><Button onPress={() => undefined}>+ Task</Button></Link>
        <Link href="/(tabs)/timetable" asChild><Button variant="outline" onPress={() => undefined}>Timetable</Button></Link>
        <Link href="/(tabs)/analytics" asChild><Button variant="outline" onPress={() => undefined}>Analytics</Button></Link>
      </View>
      <Segmented options={['High-Focus', 'Travel']} value={kind} onChange={setKind} />

      {timelineItems.length ? (
        timelineItems.map(item => {
          const task = item.session ? taskById.get(item.session.task_id) : null;
          if (item.session?.status === 'planned' && task?.kind !== (kind === 'High-Focus' ? 'focus' : 'travel')) return null;
          const active = currentActivity?.id === item.id;
          return (
            <Card key={item.id} style={[styles.timelineCard, active && { borderColor: colors.primary, borderWidth: 2 }]}>
              <View style={[styles.timelineBar, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.timelineTime, { color: colors.primary }]}>
                  {item.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–{item.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                {task && item.session ? (
                  <View style={styles.taskActions}>
                    <Link href={{ pathname: '/task/[id]', params: { id: task.id } }} style={[styles.link, { color: colors.primary }]}>Task details</Link>
                    {item.session.status === 'planned' ? (
                      <Button onPress={() => onComplete(item.session!)}>Mark done</Button>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </Card>
          );
        })
      ) : (
        <Card style={styles.emptyCard}>
          <EmptyState
            title="No activities scheduled today"
            description="Add a task or set up your fixed timetable to see the day take shape."
          />
          <View style={styles.quickActions}>
            <Link href="/task/new" asChild><Button onPress={() => undefined}>Add task</Button></Link>
            <Link href="/(tabs)/timetable" asChild><Button variant="outline" onPress={() => undefined}>Timetable</Button></Link>
          </View>
        </Card>
      )}
      {scheduleError ? <Text style={{ color: colors.danger }}>{scheduleError}</Text> : null}

      {tasks.some(task => task.status === 'unschedulable') ? (
        <Card style={[styles.warningCard, { borderColor: colors.warning }]}>
          <Text style={[styles.warningTitle, { color: colors.warning }]}>Some tasks need more time</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Review task deadlines and add eligible focus or travel windows to make a realistic schedule.
          </Text>
        </Card>
      ) : null}
      <Snackbar
        visible={!!snackbar}
        message={snackbar}
        actionLabel={undo ? 'Undo' : undefined}
        onAction={undo ? handleUndo : undefined}
        onDismiss={() => { setSnackbar(''); setUndo(null); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  hero: {
    margin: -spacing.md,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Poppins_600SemiBold' },
  greeting: { color: '#FFFFFF', fontSize: 22, fontFamily: 'Poppins_700Bold' },
  date: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  progressTitle: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  progressSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 4 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionEyebrow: { ...typography.caption, letterSpacing: 1 },
  nextTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  meta: { ...typography.caption, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.title },
  link: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  emptyCard: { gap: spacing.sm },
  warningCard: { borderWidth: 1, gap: 4 },
  warningTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  timelineCard: { flexDirection: 'row', gap: 12 },
  timelineBar: { width: 5, borderRadius: 5 },
  timelineTime: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  timelineTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  taskActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
