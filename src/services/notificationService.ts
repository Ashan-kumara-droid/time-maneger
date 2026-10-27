import { getSetting, setSetting } from '@/src/db/repositories/settingsRepository';
import { TaskRecord } from '@/src/db/repositories/taskRepository';
import { PlannedSession } from '@/src/scheduler/types';
import { listFixedActivities } from '@/src/db/repositories/fixedActivityRepository';
import { listTimetableActivities } from '@/src/db/repositories/timetableRepository';
import { buildReminderCandidates } from './reminderSchedule';

type SavedNotification = { id: string; sessionId: string };

let notificationsModule: Promise<typeof import('expo-notifications')> | null = null;

async function getNotifications() {
  if (!notificationsModule) {
    notificationsModule = import('expo-notifications').then(Notifications => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      return Notifications;
    }).catch(error => {
      notificationsModule = null;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Cannot find native module 'ExpoTopicSubscriptionModule'")) {
        throw new Error(
          'Notifications are unavailable in this Expo Go app. Install a development build to use reminders.',
        );
      }
      throw error;
    });
  }
  return notificationsModule;
}

export async function requestNotificationPermissions() {
  const Notifications = await getNotifications();
  return Notifications.requestPermissionsAsync();
}

export async function syncSessionReminders(sessions: PlannedSession[], tasks: TaskRecord[], now = new Date()) {
  const previousJson = await getSetting('notification_ids');
  let previous: SavedNotification[] = [];
  if (previousJson) {
    try {
      const parsed: unknown = JSON.parse(previousJson);
      if (Array.isArray(parsed)) previous = parsed as SavedNotification[];
    } catch (error) {
      await setSetting('notification_last_error', `Saved notification map is invalid: ${String(error)}`);
    }
  }
  const remindersEnabled = await getSetting('reminders_enabled') === 'true';
  if (!remindersEnabled && previous.length === 0) {
    await setSetting('notification_ids', '[]');
    return;
  }

  const Notifications = await getNotifications();
  const failedCancellations: SavedNotification[] = [];
  for (const item of previous) {
    try {
      await Notifications.cancelScheduledNotificationAsync(item.id);
    } catch (error) {
      console.warn(`Could not cancel outdated reminder ${item.id}`, error);
      failedCancellations.push(item);
    }
  }
  if (!remindersEnabled) {
    await setSetting('notification_ids', JSON.stringify(failedCancellations));
    return;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await setSetting('notification_last_error', 'Notification permission is not granted.');
    await setSetting('notification_ids', JSON.stringify(failedCancellations));
    return;
  }

  const offset = Number(await getSetting('reminder_offset_minutes') ?? 10);
  const [timetable, fixedActivities] = await Promise.all([listTimetableActivities(), listFixedActivities()]);
  const candidates = buildReminderCandidates(sessions, tasks, timetable, fixedActivities, now);
  const sessionsWithUncancelledReminder = new Set(failedCancellations.map(item => item.sessionId));
  const upcoming = candidates
    .filter(item => !sessionsWithUncancelledReminder.has(item.key))
    .map(item => ({ ...item, notifyAt: new Date(item.startsAt.getTime() - offset * 60_000) }))
    .filter(item => item.notifyAt.getTime() > now.getTime())
    .sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime())
    .slice(0, 60);
  const created: SavedNotification[] = [];
  try {
    for (const event of upcoming) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'TimeFlow reminder',
          body: `${event.title} starts in ${offset} minute${offset === 1 ? '' : 's'}.`,
          data: { scheduleEventId: event.key },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: event.notifyAt,
        },
      });
      created.push({ id, sessionId: event.key });
    }
  } catch (error) {
    await setSetting('notification_ids', JSON.stringify([...failedCancellations, ...created]));
    await setSetting(
      'notification_last_error',
      `Could not schedule all reminders: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
  await setSetting('notification_ids', JSON.stringify([...failedCancellations, ...created]));
  await setSetting(
    'notification_last_error',
    failedCancellations.length
      ? `Could not cancel ${failedCancellations.length} outdated reminder(s); they will be retried during the next reminder update.`
      : '',
  );
}
