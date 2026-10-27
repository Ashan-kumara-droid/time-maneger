import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, AppState, StyleSheet, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getSetting } from '@/src/db/repositories/settingsRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';

const PIN_HASH_KEY = 'timeflow_pin_hash';
const PIN_SALT_KEY = 'timeflow_pin_salt';

export default function LockScreen() {
  const { theme } = useAppTheme();
  const [pin, setPin] = useState('');
  const [method, setMethod] = useState('pin');
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  const unlock = () => router.replace('/(tabs)');

  const authenticateBiometric = async () => {
    try {
      const available = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
      if (!available) throw new Error('Biometrics are not available. Enter your PIN instead.');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock TimeFlow',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });
      if (result.success) unlock();
      else if (result.error !== 'user_cancel') setError('Authentication did not succeed. You can use your PIN.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  useEffect(() => {
    getSetting('lock_method').then(value => {
      const selected = value ?? 'pin';
      setMethod(selected);
      if (selected === 'biometric') authenticateBiometric();
    }).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);

  useEffect(() => {
    let backgroundAt: number | null = null;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') backgroundAt = Date.now();
      if (state === 'active' && backgroundAt !== null && Date.now() - backgroundAt > 30_000) {
        backgroundAt = null;
        setPin('');
        setError('App locked after returning from the background.');
      }
    });
    return () => subscription.remove();
  }, []);

  const verifyPin = async () => {
    setWaiting(true);
    try {
      const lockedUntil = Number(await SecureStore.getItemAsync('timeflow_pin_locked_until') ?? 0);
      if (Date.now() < lockedUntil) {
        throw new Error(`Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds.`);
      }
      const [salt, expected] = await Promise.all([
        SecureStore.getItemAsync(PIN_SALT_KEY),
        SecureStore.getItemAsync(PIN_HASH_KEY),
      ]);
      if (!salt || !expected) throw new Error('PIN credentials are unavailable. Ask the device owner to reset the app lock.');
      const actual = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
      if (actual !== expected) {
        const attempts = Number(await SecureStore.getItemAsync('timeflow_pin_attempts') ?? 0) + 1;
        await SecureStore.setItemAsync('timeflow_pin_attempts', String(attempts));
        if (attempts >= 5) {
          const delay = Math.min(30 * 60_000, 30_000 * 2 ** (attempts - 5));
          await SecureStore.setItemAsync('timeflow_pin_locked_until', String(Date.now() + delay));
          throw new Error(`Incorrect PIN. Try again in ${Math.ceil(delay / 1000)} seconds.`);
        }
        throw new Error(`Incorrect PIN. ${5 - attempts} attempt${attempts === 4 ? '' : 's'} remaining.`);
      }
      await SecureStore.deleteItemAsync('timeflow_pin_attempts');
      await SecureStore.deleteItemAsync('timeflow_pin_locked_until');
      unlock();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setWaiting(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.icon, { color: theme.colors.primary }]}>◷</Text>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>TimeFlow is locked</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Unlock to view your private schedule.</Text>
      {method === 'pin' ? (
        <>
          <Input label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <Button loading={waiting} onPress={verifyPin}>Unlock</Button>
        </>
      ) : <Button onPress={authenticateBiometric}>Use biometrics</Button>}
      {method !== 'biometric' ? <Button variant="outline" onPress={authenticateBiometric}>Try biometrics</Button> : null}
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', paddingBottom: 32 },
  icon: { fontSize: 48, textAlign: 'center' },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.body, textAlign: 'center' },
});
