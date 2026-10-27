import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { getTask } from '@/src/db/repositories/taskRepository';
import { listSessions } from '@/src/db/repositories/sessionRepository';
import { listTimetableActivities } from '@/src/db/repositories/timetableRepository';
import { listFixedActivities } from '@/src/db/repositories/fixedActivityRepository';
import { createTask, saveScheduledStudyTask, updateTask, TaskInput } from '@/src/services/taskService';
import { getSuggestedStudyDeadline, StudyTaskType } from '@/src/scheduler/studyDeadlines';
import { checkStudySchedule, formatStudyAlternatives, StudyBusyBlock } from '@/src/scheduler/studySchedule';
import { localDateTimeToMinutes, toDateKey } from '@/src/scheduler/dateUtils';
import { useAppStore } from '@/src/stores/useAppStore';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/tokens';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task name is required.').max(120, 'Keep the title under 120 characters.'),
  description: z.string().max(2000, 'Keep notes under 2000 characters.'),
  category: z.enum(['assignment', 'personal', 'study', 'financial', 'other']),
  kind: z.enum(['focus', 'travel']),
  priority: z.enum(['high', 'medium', 'low']),
  estimated_minutes: z.number().int().min(5, 'Minimum duration is 5 minutes.').max(10080, 'Duration must be under one week.'),
});

const initialDeadlineDate = new Date(Date.now() + 86_400_000);
const initialDeadlineTime = new Date();
const studyActivityOptions: Record<StudyTaskType, string[]> = {
  preparation: ['Review previous notes', 'Read upcoming material', 'Complete preparation questions'],
  revision: ['Summarize key concepts', 'Review lecture notes', 'Practice questions'],
};

function getStudyDefaults(activity: { day_of_week: number; start_min: number; end_min: number }, type: StudyTaskType) {
  const lecture = getSuggestedStudyDeadline(activity, 'preparation', new Date());
  const date = new Date(lecture.getFullYear(), lecture.getMonth(), lecture.getDate());
  let startMin = type === 'preparation' ? activity.start_min - 30 : activity.end_min + 15;
  const now = new Date();
  if (type === 'preparation' && startMin < 0) {
    date.setDate(date.getDate() - 1);
    startMin += 1440;
  } else if (type === 'revision' && startMin >= 1440) {
    date.setDate(date.getDate() + 1);
    startMin = 9 * 60;
  }
  if (type === 'preparation'
    && toDateKey(date) === toDateKey(now)
    && startMin <= now.getHours() * 60 + now.getMinutes()) {
    date.setDate(date.getDate() + 7);
  }
  const time = new Date(date);
  time.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return { date, time };
}

export default function NewTaskScreen() {
  const { id, linkedActivityId, studyType } = useLocalSearchParams<{
    id?: string;
    linkedActivityId?: string;
    studyType?: string;
  }>();
  const { theme } = useAppTheme();
  const reload = useAppStore(state => state.reload);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [kind, setKind] = useState<'focus' | 'travel'>('focus');
  const [repeat, setRepeat] = useState<'One-time' | 'Daily recurring'>('One-time');
  const [fixedTime, setFixedTime] = useState('08:00');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState<'assignment' | 'personal' | 'study' | 'financial' | 'other'>('study');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [linkedStudy, setLinkedStudy] = useState<{
    activityId: string;
    studyType: 'preparation' | 'revision';
  } | null>(null);
  const [studyLecture, setStudyLecture] = useState<Awaited<ReturnType<typeof listTimetableActivities>>[number] | null>(null);
  const [studyDate, setStudyDate] = useState(new Date());
  const [studyTime, setStudyTime] = useState(new Date());
  const [studyDuration, setStudyDuration] = useState('20');
  const [studyActivity, setStudyActivity] = useState(studyActivityOptions.preparation[0]);
  const [studyReminder, setStudyReminder] = useState(false);
  const [studyAlternatives, setStudyAlternatives] = useState<number[]>([]);
  const [deadlineDate, setDeadlineDate] = useState(initialDeadlineDate);
  const [deadlineTime, setDeadlineTime] = useState(initialDeadlineTime);
  const [picker, setPicker] = useState<'date' | 'time' | 'studyDate' | 'studyTime' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(!id);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getTask(id), listTimetableActivities(), listSessions(id)]).then(([task, activities, sessions]) => {
      if (!active) return;
      if (!task) throw new Error('Task could not be found.');
      setTitle(task.title);
      setDescription(task.description);
      setHours(String(Math.floor(task.estimated_minutes / 60)));
      setMinutes(String(task.estimated_minutes % 60));
      setKind(task.kind);
      setRepeat(task.is_recurring_daily ? 'Daily recurring' : 'One-time');
      setFixedTime(task.fixed_time_min === null ? '08:00' : `${String(Math.floor(task.fixed_time_min / 60)).padStart(2, '0')}:${String(task.fixed_time_min % 60).padStart(2, '0')}`);
      setPriority(task.priority);
      setCategory(task.category as typeof category);
      setHasDeadline(task.has_deadline === 1);
      if (task.deadline_at) setDeadlineDate(new Date(task.deadline_at));
      if (task.linked_activity_id && task.linked_study_type) {
        const activity = activities.find(item => item.id === task.linked_activity_id) ?? null;
        setLinkedStudy({
          activityId: task.linked_activity_id,
          studyType: task.linked_study_type,
        });
        setStudyLecture(activity);
        setStudyDuration(String(task.estimated_minutes));
        setStudyReminder((task.reminder_enabled ?? 1) === 1);
        const activityOptions = studyActivityOptions[task.linked_study_type];
        const descriptionLines = task.description.split('\n');
        const activityLine = descriptionLines[0]?.startsWith('Study activity: ')
          ? descriptionLines.shift()?.slice('Study activity: '.length)
          : null;
        setStudyActivity(activityLine && activityOptions.includes(activityLine) ? activityLine : activityOptions[0]);
        setDescription(descriptionLines.join('\n').replace(/^\n+/, ''));
        const scheduled = sessions.find(session => session.status === 'planned' && session.is_locked === 1);
        if (scheduled) {
          const start = new Date(scheduled.start_at);
          setStudyDate(new Date(start.getFullYear(), start.getMonth(), start.getDate()));
          setStudyTime(start);
        } else if (activity) {
          const defaults = getStudyDefaults(activity, task.linked_study_type);
          setStudyDate(defaults.date);
          setStudyTime(defaults.time);
        }
      }
      setInitialized(true);
    }).catch(error => {
      setInitialized(true);
      setErrors({ form: error instanceof Error ? error.message : String(error) });
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (id || !linkedActivityId || (studyType !== 'preparation' && studyType !== 'revision')) return;
    let active = true;
    listTimetableActivities().then(activities => {
      const activity = activities.find(item => item.id === linkedActivityId);
      if (!active) return;
      if (!activity) throw new Error('The linked lecture could not be found.');
      const studyTaskType = studyType as StudyTaskType;
      const deadline = getSuggestedStudyDeadline(activity, studyTaskType, new Date());
      const defaults = getStudyDefaults(activity, studyTaskType);
      setTitle(`${studyType === 'preparation' ? 'Prepare for' : 'Revise after'} ${activity.title}`);
      setDescription('');
      setCategory('study');
      setPriority('high');
      setDeadlineDate(deadline);
      setDeadlineTime(deadline);
      setHasDeadline(false);
      setLinkedStudy({ activityId: activity.id, studyType: studyTaskType });
      setStudyLecture(activity);
      setStudyDuration(studyTaskType === 'preparation' ? '20' : '15');
      setStudyActivity(studyActivityOptions[studyTaskType][0]);
      setStudyDate(defaults.date);
      setStudyTime(defaults.time);
    }).catch(error => {
      if (active) setErrors({ form: error instanceof Error ? error.message : String(error) });
    });
    return () => { active = false; };
  }, [id, linkedActivityId, studyType]);

  if (id && !initialized) {
    return <Screen><Text style={{ color: theme.colors.textSecondary }}>Loading task…</Text></Screen>;
  }

  const save = async () => {
    const duration = linkedStudy
      ? Number(studyDuration)
      : Number(hours || 0) * 60 + Number(minutes || 0);
    const taskDescription = linkedStudy
      ? `Study activity: ${studyActivity}${description.trim() ? `\n${description.trim()}` : ''}`
      : description;
    const parsed = taskSchema.safeParse({ title, description: taskDescription, category, kind, priority, estimated_minutes: duration });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return;
    }
    if (repeat === 'Daily recurring' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fixedTime)) {
      setErrors({ fixedTime: 'Enter a time as HH:mm.' });
      return;
    }

    let studyStartMin: number | null = null;
    if (linkedStudy) {
      if (!studyLecture) {
        setErrors({ form: 'The linked lecture could not be found. Return to the timetable and try again.' });
        return;
      }
      studyStartMin = studyTime.getHours() * 60 + studyTime.getMinutes();
      try {
        const [weeklyActivities, fixedActivities, sessions] = await Promise.all([
          listTimetableActivities(),
          listFixedActivities(),
          listSessions(),
        ]);
        const busy: StudyBusyBlock[] = [
          ...weeklyActivities.filter(item => item.is_active === 1).map(item => ({
            dayOfWeek: item.day_of_week,
            startMin: item.start_min,
            endMin: item.end_min,
            title: item.title,
          })),
          ...fixedActivities.map(item => ({
            date: item.date,
            startMin: item.start_min,
            endMin: item.end_min,
            title: item.title,
          })),
          ...sessions.filter(session => session.status === 'planned' && session.task_id !== id).map(session => {
            const range = localDateTimeToMinutes(session.start_at);
            return {
              date: range.date,
              startMin: range.minute,
              endMin: range.minute + session.planned_minutes,
              title: 'Scheduled study or task session',
            };
          }),
        ];
        const check = checkStudySchedule({
          studyType: linkedStudy.studyType,
          studyDate: toDateKey(studyDate),
          startMin: studyStartMin,
          durationMin: duration,
          lectureDay: studyLecture.day_of_week,
          lectureStartMin: studyLecture.start_min,
          lectureEndMin: studyLecture.end_min,
          busy,
        });
        if (check.error) {
          setStudyAlternatives(check.alternatives);
          setErrors({ form: check.error });
          return;
        }
        setStudyAlternatives([]);
      } catch (error) {
        setErrors({ form: error instanceof Error ? error.message : String(error) });
        return;
      }
    }

    let deadlineAt: string | null = null;
    if (hasDeadline && !linkedStudy) {
      const deadline = new Date(deadlineDate);
      deadline.setHours(deadlineTime.getHours(), deadlineTime.getMinutes(), 0, 0);
      if (deadline.getTime() <= Date.now()) {
        setErrors({ deadline: 'Deadline must be in the future.' });
        return;
      }
      deadlineAt = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}T${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`;
    }
    const [fixedHour, fixedMinute] = fixedTime.split(':').map(Number);
    const input: TaskInput = {
      ...parsed.data,
      ...(linkedStudy ? {
        category: 'study' as const,
        kind: 'focus' as const,
        priority: 'high' as const,
        is_recurring_daily: 0,
        fixed_time_min: null,
        has_deadline: 0,
        deadline_at: null,
      } : {
        is_recurring_daily: repeat === 'Daily recurring' ? 1 : 0,
        fixed_time_min: repeat === 'Daily recurring' ? fixedHour * 60 + fixedMinute : null,
        has_deadline: hasDeadline ? 1 : 0,
        deadline_at: deadlineAt,
      }),
      linked_activity_id: linkedStudy?.activityId ?? null,
      linked_study_type: linkedStudy?.studyType ?? null,
      reminder_enabled: linkedStudy ? Number(studyReminder) : 1,
    };

    setSaving(true);
    try {
      const result = linkedStudy && studyStartMin !== null
        ? await saveScheduledStudyTask(id ?? null, input, toDateKey(studyDate), studyStartMin)
        : id ? await updateTask(id, input) : await createTask(input);
      await reload();
      const task = result.task;
      const planned = result.result.sessions.filter(session => session.taskId === task.id && session.status === 'planned');
      if (result.result.warnings.some(warning => warning.taskId === task.id)) {
        const warning = result.result.warnings.find(item => item.taskId === task.id);
        Alert.alert(
          'Not enough eligible time',
          `${warning?.shortfallMinutes ?? 0} minutes could not be scheduled. Add more ${kind === 'focus' ? 'focus' : 'travel'} time, shorten the task, or change the deadline.`,
          [{ text: 'Review task', onPress: () => router.replace({ pathname: '/task/[id]', params: { id: task.id } }) }],
        );
      } else {
        const plannedText = planned.map(session => {
          const startDate = new Date(`${session.date}T00:00:00`);
          const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
          return `${startDate.toLocaleDateString(undefined, { weekday: 'short' })} ${time(session.startMin)}–${time(session.endMin)}`;
        }).join('\n');
        Alert.alert(
          linkedStudy ? 'Study session scheduled' : id ? 'Task updated' : 'Task scheduled',
          linkedStudy
            ? `${studyDate.toLocaleDateString()} at ${studyTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${duration} minutes`
            : planned.length ? `Scheduled across ${planned.length} session${planned.length === 1 ? '' : 's'}:\n${plannedText}` : 'No sessions were placed in the selected horizon. Review your availability and deadline.',
          [{ text: 'View task', onPress: () => router.replace({ pathname: '/task/[id]', params: { id: task.id } }) }],
        );
      }
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const pickerChanged = (event: { type: string }, selected?: Date) => {
    if (event.type === 'dismissed') {
      setPicker(null);
      return;
    }
    if (!selected) return;
    if (picker === 'date') setDeadlineDate(selected);
    if (picker === 'time') setDeadlineTime(selected);
    if (picker === 'studyDate') {
      setStudyDate(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()));
      setStudyAlternatives([]);
      setErrors({});
    }
    if (picker === 'studyTime') setStudyTime(selected);
    setPicker(Platform.OS === 'ios' ? picker : null);
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{id ? 'Edit task' : 'Create a task'}</Text>
      {linkedStudy ? (
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
          {linkedStudy.studyType === 'preparation' ? 'Preparation' : 'Revision'} for {studyLecture?.title ?? 'the selected lecture'} ({studyLecture?.type ?? 'Lecture'}). The scheduled session will appear in your timetable.
        </Text>
      ) : null}
      <Input label="Task name" value={title} onChangeText={setTitle} placeholder="e.g. Finish biology notes" error={errors.title} />
      {linkedStudy ? (
        <>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Study activity</Text>
          <View style={styles.chips}>
            {studyActivityOptions[linkedStudy.studyType].map(activity => (
              <Chip key={activity} label={activity} selected={studyActivity === activity} onPress={() => setStudyActivity(activity)} />
            ))}
          </View>
          <Input
            label={linkedStudy.studyType === 'revision' ? 'Revision notes or checklist' : 'Preparation notes or checklist'}
            value={description}
            onChangeText={setDescription}
            placeholder="Add topics, pages, or questions to review"
            multiline
            numberOfLines={4}
            style={styles.multiline}
            error={errors.description}
          />
          <Input
            label="Duration (minutes)"
            value={studyDuration}
            onChangeText={value => { setStudyDuration(value); setStudyAlternatives([]); }}
            keyboardType="number-pad"
            error={errors.estimated_minutes}
          />
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Session date and start time</Text>
          <View style={styles.chips}>
            <Button variant="outline" onPress={() => setPicker('studyDate')}>{studyDate.toLocaleDateString()}</Button>
            <Button variant="outline" onPress={() => setPicker('studyTime')}>{studyTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Button>
          </View>
          {picker === 'studyDate' || picker === 'studyTime' ? (
            <DateTimePicker
              value={picker === 'studyDate' ? studyDate : studyTime}
              mode={picker === 'studyDate' ? 'date' : 'time'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={pickerChanged}
              minimumDate={new Date()}
            />
          ) : null}
          <View style={styles.deadlineHeader}>
            <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Reminder for this session</Text>
            <Chip label={studyReminder ? 'On' : 'Off'} selected={studyReminder} onPress={() => setStudyReminder(!studyReminder)} />
          </View>
          <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
            Session reminders also require notifications to be enabled in Settings.
          </Text>
        </>
      ) : (
        <>
          <Input label="Description / comments" value={description} onChangeText={setDescription} placeholder="Optional notes" multiline numberOfLines={4} style={styles.multiline} error={errors.description} />
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Estimated time</Text>
          <View style={styles.durationRow}>
            <Input value={hours} onChangeText={setHours} keyboardType="number-pad" accessibilityLabel="Hours" style={styles.durationInput} />
            <Text style={{ color: theme.colors.textSecondary }}>hours</Text>
            <Input value={minutes} onChangeText={setMinutes} keyboardType="number-pad" accessibilityLabel="Minutes" style={styles.durationInput} />
            <Text style={{ color: theme.colors.textSecondary }}>minutes ({Number(hours || 0) * 60 + Number(minutes || 0)} total)</Text>
          </View>
        </>
      )}
      {errors.estimated_minutes ? <Text style={{ color: theme.colors.danger }}>{errors.estimated_minutes}</Text> : null}
      {!linkedStudy ? (
        <>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Task kind</Text>
          <Segmented
            options={['High-Focus', 'Travel']}
            value={kind === 'focus' ? 'High-Focus' : 'Travel'}
            onChange={value => setKind(value === 'Travel' ? 'travel' : 'focus')}
          />
          <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
            {kind === 'focus' ? 'For work that needs uninterrupted concentration.' : 'For low-concentration tasks you can do while commuting.'}
          </Text>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Repeat</Text>
          <Segmented options={['One-time', 'Daily recurring']} value={repeat} onChange={value => setRepeat(value as typeof repeat)} />
          {repeat === 'Daily recurring' ? (
            <>
              <Input label="Fixed start time (HH:mm)" value={fixedTime} onChangeText={setFixedTime} placeholder="08:00" error={errors.fixedTime} />
              <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>Daily recurring tasks are reserved at this time.</Text>
            </>
          ) : <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>This task will be automatically scheduled in an eligible time window.</Text>}
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Priority</Text>
          <View style={styles.chips}>
            {(['high', 'medium', 'low'] as const).map(value => (
              <Chip key={value} label={value} selected={priority === value} onPress={() => setPriority(value)} />
            ))}
          </View>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Category</Text>
          <View style={styles.chips}>
            {(['assignment', 'personal', 'study', 'financial', 'other'] as const).map(value => (
              <Chip key={value} label={value} selected={category === value} onPress={() => setCategory(value)} />
            ))}
          </View>
          <View style={styles.deadlineHeader}>
            <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Add a deadline</Text>
            <Chip label={hasDeadline ? 'Yes' : 'No'} selected={hasDeadline} onPress={() => setHasDeadline(!hasDeadline)} />
          </View>
          {hasDeadline ? (
            <>
              <View style={styles.chips}>
                <Button variant="outline" onPress={() => setPicker('date')}>{deadlineDate.toLocaleDateString()}</Button>
                <Button variant="outline" onPress={() => setPicker('time')}>{deadlineTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Button>
              </View>
              {picker === 'date' || picker === 'time' ? (
                <DateTimePicker
                  value={picker === 'date' ? deadlineDate : deadlineTime}
                  mode={picker}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={pickerChanged}
                />
              ) : null}
              {errors.deadline ? <Text style={{ color: theme.colors.danger }}>{errors.deadline}</Text> : null}
            </>
          ) : null}
        </>
      ) : null}
      {errors.form ? <Text style={{ color: theme.colors.danger }}>{errors.form}</Text> : null}
      {studyAlternatives.length ? (
        <View style={styles.chips}>
          {studyAlternatives.map(minute => (
            <Chip
              key={minute}
              label={formatStudyAlternatives([minute])}
              onPress={() => {
                const suggested = new Date(studyDate);
                suggested.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
                setStudyTime(suggested);
                setStudyAlternatives([]);
                setErrors({});
              }}
            />
          ))}
        </View>
      ) : null}
      <Button loading={saving} onPress={save}>{id ? 'Save changes' : 'Save and schedule'}</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  helper: { ...typography.caption, marginTop: -8 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  durationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  durationInput: { width: 70 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  deadlineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
