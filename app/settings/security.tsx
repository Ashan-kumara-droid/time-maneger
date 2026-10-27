import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getDatabase } from '@/src/db/client';
import { getSetting, setSetting } from '@/src/db/repositories/settingsRepository';
import { listTasks } from '@/src/db/repositories/taskRepository';
import { listSessions } from '@/src/db/repositories/sessionRepository';
import { requestNotificationPermissions, syncSessionReminders } from '@/src/services/notificationService';
import { rebuildSchedule } from '@/src/services/schedulerService';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';

const PIN_HASH_KEY = 'timeflow_pin_hash';
const PIN_SALT_KEY = 'timeflow_pin_salt';

async function verifyDeviceAuthentication(promptMessage: string) {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !enrolled) throw new Error('Biometrics are unavailable or not enrolled on this device.');
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });
  if (!result.success) throw new Error(result.error === 'user_cancel' ? 'Authentication cancelled.' : 'Authentication did not succeed.');
}

export default function SecuritySettingsScreen() {
  const { theme } = useAppTheme();
  const [lockEnabled, setLockEnabled] = useState(false);
  const [method, setMethod] = useState('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderOffset, setReminderOffset] = useState('10');
  const [lockAfter, setLockAfter] = useState('30');
  const [horizonDays, setHorizonDays] = useState('30');
  const [minSession, setMinSession] = useState('25');
  const [buffer, setBuffer] = useState('5');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      getSetting('app_lock_enabled'),
      getSetting('lock_method'),
      getSetting('reminders_enabled'),
      getSetting('reminder_offset_minutes'),
      getSetting('lock_after_seconds'),
      getSetting('scheduling_horizon_days'),
      getSetting('min_session_minutes'),
      getSetting('buffer_minutes'),
      getSetting('notification_last_error'),
    ]).then(([lock, lockMethod, reminders, offset, lockDelay, horizon, minimum, gap, notificationError]) => {
      setLockEnabled(lock === 'true');
      setMethod(lockMethod ?? 'pin');
      setRemindersEnabled(reminders === 'true');
      setReminderOffset(offset ?? '10');
      setLockAfter(lockDelay ?? '30');
      setHorizonDays(horizon ?? '30');
      setMinSession(minimum ?? '25');
      setBuffer(gap ?? '5');
      if (notificationError) setError(notificationError);
    }).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);

  const enablePin = async () => {
    if (!/^\d{4,6}$/.test(pin)) { setError('PIN must contain 4 to 6 digits.'); return; }
    if (pin !== confirmPin) { setError('PIN entries do not match.'); return; }
    setBusy(true);
    try {
      const salt = Crypto.randomUUID();
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
      await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
      await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
      await setSetting('lock_method', 'pin');
      await setSetting('app_lock_enabled', 'true');
      setLockEnabled(true);
      setMethod('pin');
      setPin('');
      setConfirmPin('');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const enableBiometric = async () => {
    setBusy(true);
    try {
      await verifyDeviceAuthentication('Enable TimeFlow app lock');
      await setSetting('lock_method', 'biometric');
      await setSetting('app_lock_enabled', 'true');
      setLockEnabled(true);
      setMethod('biometric');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const disableLock = async () => {
    setBusy(true);
    try {
      if (method === 'biometric') await verifyDeviceAuthentication('Disable TimeFlow app lock');
      else {
        const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
        const expected = await SecureStore.getItemAsync(PIN_HASH_KEY);
        if (!salt || !expected) throw new Error('Saved PIN credentials are missing. Set up a new PIN before disabling the lock.');
        const actual = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
        if (actual !== expected) throw new Error('PIN is incorrect.');
      }
      await setSetting('app_lock_enabled', 'false');
      await SecureStore.deleteItemAsync(PIN_SALT_KEY);
      await SecureStore.deleteItemAsync(PIN_HASH_KEY);
      setLockEnabled(false);
      setPin('');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const updateReminders = async (enable: boolean) => {
    try {
      if (enable) {
        const permission = await requestNotificationPermissions();
        if (!permission.granted) {
          setError('Notification permission was not granted. TimeFlow continues to work without reminders.');
          setRemindersEnabled(false);
          return;
        }
      }
      setRemindersEnabled(enable);
      await setSetting('reminders_enabled', String(enable));
      setError('');
      const [sessions, tasks] = await Promise.all([listSessions(), listTasks()]);
      await syncSessionReminders(sessions.map(session => ({
        id: session.id,
        taskId: session.task_id,
        date: session.date,
        startMin: new Date(session.start_at).getHours() * 60 + new Date(session.start_at).getMinutes(),
        endMin: new Date(session.end_at).getHours() * 60 + new Date(session.end_at).getMinutes(),
        durationMin: session.planned_minutes,
        status: session.status,
        isLocked: session.is_locked === 1,
      })), tasks);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (enable) {
        try {
          await setSetting('reminders_enabled', 'false');
          setRemindersEnabled(false);
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          setError(`${message} Could not reset the reminder setting: ${rollbackMessage}`);
          return;
        }
      }
      setError(message);
    }
  };

  const saveOffset = async (value: string) => {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) {
      setError('Reminder lead time must be from 0 to 120 minutes.');
      return;
    }
    setReminderOffset(value);
    await setSetting('reminder_offset_minutes', value);
    setError('');
  };

  const saveLockDelay = async (value: string) => {
    setLockAfter(value);
    await setSetting('lock_after_seconds', value);
  };

  const savePlanningSettings = async () => {
    const horizon = Number(horizonDays);
    const minimum = Number(minSession);
    const gap = Number(buffer);
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 90
      || !Number.isInteger(minimum) || minimum < 5 || minimum > 180
      || !Number.isInteger(gap) || gap < 0 || gap > 60) {
      setError('Use a 1–90 day horizon, 5–180 minute minimum session, and 0–60 minute buffer.');
      return;
    }
    try {
      await Promise.all([
        setSetting('scheduling_horizon_days', String(horizon)),
        setSetting('min_session_minutes', String(minimum)),
        setSetting('buffer_minutes', String(gap)),
      ]);
      await rebuildSchedule('manual_rebuild');
      setError('Planning settings saved and schedule rebuilt.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const db = getDatabase();
      const tableNames = ['profile', 'settings', 'timetable_activities', 'time_windows', 'fixed_activities', 'free_time_ranges', 'tasks', 'sessions', 'skipped_dates', 'task_occurrences', 'schedule_log'];
      const data: Record<string, unknown[]> = {};
      for (const table of tableNames) {
        const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
        data[table] = table === 'settings'
          ? rows.filter(row => !['app_lock_enabled', 'lock_method', 'notification_ids'].includes(String(row.key)))
          : rows;
      }
      if (!FileSystem.cacheDirectory) throw new Error('Temporary file storage is unavailable.');
      const uri = `${FileSystem.cacheDirectory}timeflow-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2));
      const available = await Sharing.isAvailableAsync();
      if (!available) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export TimeFlow backup' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const contents = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsed: unknown = JSON.parse(contents);
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 || !('data' in parsed)) {
        throw new Error('This file is not a supported TimeFlow backup.');
      }
      const source = parsed.data;
      if (!source || typeof source !== 'object') throw new Error('Backup data is missing.');
      const allowedTables = ['profile', 'settings', 'timetable_activities', 'time_windows', 'fixed_activities', 'free_time_ranges', 'tasks', 'sessions', 'skipped_dates', 'task_occurrences', 'schedule_log'];
      const rowsByTable = new Map<string, Array<Record<string, string | number | null>>>();
      const db = getDatabase();
      for (const table of allowedTables) {
        const rows = (source as Record<string, unknown>)[table] ?? [];
        if (!Array.isArray(rows)) throw new Error(`Backup table ${table} is invalid.`);
        const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        const knownColumns = new Set(columns.map(column => column.name));
        const normalizedRows: Array<Record<string, string | number | null>> = [];
        for (const row of rows) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`A row in ${table} is invalid.`);
          const normalized: Record<string, string | number | null> = {};
          for (const [key, value] of Object.entries(row)) {
            if (!knownColumns.has(key)) throw new Error(`Backup column ${table}.${key} is not supported.`);
            if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
              throw new Error(`Backup value ${table}.${key} has an invalid type.`);
            }
            normalized[key] = value;
          }
          normalizedRows.push(normalized);
        }
        rowsByTable.set(table, normalizedRows);
      }
      Alert.alert(
        'Replace local data?',
        'Importing replaces the profile and schedule currently stored on this device. PIN and biometric lock settings are not imported.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace data', style: 'destructive', onPress: async () => {
            try {
              await db.withTransactionAsync(async () => {
                for (const table of ['sessions', 'task_occurrences', 'tasks', 'fixed_activities', 'free_time_ranges', 'time_windows', 'timetable_activities', 'skipped_dates', 'schedule_log', 'profile', 'settings']) {
                  await db.runAsync(`DELETE FROM ${table}`);
                }
                for (const table of allowedTables) {
                  for (const row of rowsByTable.get(table) ?? []) {
                    const columns = Object.keys(row);
                    if (!columns.length) continue;
                    const placeholders = columns.map(() => '?').join(', ');
                    const quotedColumns = columns.map(column => `"${column}"`).join(', ');
                    const values = columns.map(column => row[column]);
                    await db.runAsync(
                      `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders})`,
                      values,
                    );
                  }
                }
              });
              await SecureStore.deleteItemAsync(PIN_HASH_KEY);
              await SecureStore.deleteItemAsync(PIN_SALT_KEY);
              await setSetting('app_lock_enabled', 'false');
              Alert.alert('Backup imported', 'Restart TimeFlow to load the imported profile and schedule.');
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : String(caught));
            }
          } },
        ],
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const resetAll = () => Alert.alert('Delete all TimeFlow data?', 'This permanently removes your profile, tasks, timetable, and settings from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: () => Alert.alert('Confirm data reset', 'This cannot be undone. Export a backup first if you need one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: async () => {
        try {
          const db = getDatabase();
          await db.withTransactionAsync(async () => {
            for (const table of ['sessions', 'task_occurrences', 'tasks', 'fixed_activities', 'free_time_ranges', 'time_windows', 'timetable_activities', 'skipped_dates', 'schedule_log', 'profile', 'settings']) {
              await db.runAsync(`DELETE FROM ${table}`);
            }
          });
          await SecureStore.deleteItemAsync(PIN_HASH_KEY);
          await SecureStore.deleteItemAsync(PIN_SALT_KEY);
          Alert.alert('Data removed', 'Restart TimeFlow to begin onboarding again.');
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } },
    ]) },
  ]);

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Privacy & security</Text>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>App lock</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        PINs are stored as a salted hash in secure device storage. Biometric availability depends on your device.
      </Text>
      {!lockEnabled ? (
        <>
          <View style={styles.row}>
            <Button variant="outline" onPress={enableBiometric}>Enable biometrics</Button>
          </View>
          <Input label="Create 4–6 digit PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <Input label="Confirm PIN" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <Button loading={busy} onPress={enablePin}>Enable PIN lock</Button>
        </>
      ) : (
        <>
          <Text style={[styles.subtitle, { color: theme.colors.success }]}>App lock is enabled ({method}).</Text>
          {method === 'pin' ? <Input label="Enter PIN to disable lock" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} /> : null}
          <Button variant="danger" loading={busy} onPress={disableLock}>Disable app lock</Button>
          {method === 'pin' ? (
            <>
              <Input label="New PIN" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
              <Button variant="outline" onPress={async () => {
                if (!/^\d{4,6}$/.test(confirmPin)) { setError('New PIN must contain 4 to 6 digits.'); return; }
                const salt = Crypto.randomUUID();
                const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${confirmPin}`);
                await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
                await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
                setConfirmPin('');
                setError('PIN changed.');
              }}>Change PIN</Button>
            </>
          ) : null}
        </>
      )}

      <Text style={[styles.subtitle, { color: theme.colors.textPrimary }]}>Lock after leaving the app</Text>
      <View style={styles.row}>
        {[
          { value: 'immediate', label: 'Immediately' },
          { value: '30', label: '30 sec' },
          { value: '60', label: '1 min' },
          { value: '300', label: '5 min' },
        ].map(option => (
          <Chip key={option.value} label={option.label} selected={lockAfter === option.value} onPress={() => saveLockDelay(option.value)} />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Reminders</Text>
      <View style={styles.row}>
        <Chip label={remindersEnabled ? 'Reminders on' : 'Reminders off'} selected={remindersEnabled} onPress={() => updateReminders(!remindersEnabled)} />
      </View>
      <Input label="Minutes before a session (0–120)" value={reminderOffset} onChangeText={saveOffset} keyboardType="number-pad" />
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Scheduling</Text>
      <Input label="Planning horizon (days, 1–90)" value={horizonDays} onChangeText={setHorizonDays} keyboardType="number-pad" />
      <Input label="Minimum session (minutes)" value={minSession} onChangeText={setMinSession} keyboardType="number-pad" />
      <Input label="Buffer between activities (minutes)" value={buffer} onChangeText={setBuffer} keyboardType="number-pad" />
      <Button variant="outline" onPress={savePlanningSettings}>Save and rebuild schedule</Button>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Your data</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Export a JSON backup of your local profile and schedule.</Text>
      <Button loading={busy} variant="outline" onPress={exportBackup}>Export backup</Button>
      <Button variant="outline" onPress={importBackup}>Import backup</Button>
      <Button variant="danger" onPress={resetAll}>Reset all data</Button>
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  sectionTitle: { ...typography.subtitle, marginTop: 8 },
  subtitle: { ...typography.caption, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8 },
});
