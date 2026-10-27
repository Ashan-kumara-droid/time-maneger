import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getProfile, Profile, saveProfile } from '@/src/db/repositories/profileRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';
import * as Crypto from 'expo-crypto';

const occupations = [
  { id: 'university', label: 'University' },
  { id: 'school', label: 'School' },
  { id: 'professional', label: 'Professional' },
] as const;

export default function ProfileSettingsScreen() {
  const { theme, setBase } = useAppTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [occupation, setOccupation] = useState<Profile['occupation']>('university');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile().then(data => {
      setProfile(data);
      setUsername(data?.username ?? '');
      setOccupation(data?.occupation ?? 'university');
    }).catch(caught => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);

  const update = async (avatarUri = profile?.avatar_uri ?? null) => {
    if (!profile) return;
    const cleaned = username.trim();
    if (cleaned.length < 2 || cleaned.length > 24) { setError('Name must be between 2 and 24 characters.'); return; }
    try {
      const nextProfile = { ...profile, username: cleaned, occupation, avatar_uri: avatarUri };
      await saveProfile(nextProfile);
      setProfile(nextProfile);
      setSaved(true);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const chooseAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture. You can also continue without one.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      if (!FileSystem.documentDirectory) throw new Error('App storage is unavailable.');
      const directory = `${FileSystem.documentDirectory}avatars/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const destination = `${directory}${Crypto.randomUUID()}.jpg`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: destination });
      await update(destination);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const removeAvatar = () => Alert.alert('Remove profile photo?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => update(null).catch(caught => setError(String(caught))) },
  ]);

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Your profile</Text>
      {profile?.avatar_uri ? (
        <Image source={{ uri: profile.avatar_uri }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.placeholder, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={{ fontSize: 36, color: theme.colors.primary }}>{username.trim().charAt(0).toUpperCase() || 'T'}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Button variant="outline" onPress={chooseAvatar}>Choose photo</Button>
        {profile?.avatar_uri ? <Button variant="outline" onPress={removeAvatar}>Remove photo</Button> : null}
      </View>
      <Input label="Username" value={username} onChangeText={value => { setUsername(value); setSaved(false); }} maxLength={24} />
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Optional color palette</Text>
      <View style={styles.row}>
        {([
          { value: 'blue', label: 'Blue' },
          { value: 'pink', label: 'Pink' },
          { value: 'neutral', label: 'Neutral' },
        ] as const).map(option => (
          <Chip key={option.value} label={option.label} selected={theme.base === option.value} onPress={() => {
            setBase(option.value);
          }} />
        ))}
      </View>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>Occupation</Text>
      <View style={styles.row}>
        {occupations.map(item => (
          <Chip key={item.id} label={item.label} selected={occupation === item.id} onPress={() => {
            if (occupation !== item.id) {
              Alert.alert('Change occupation?', 'This changes activity presets, not your saved timetable data.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Change', onPress: () => setOccupation(item.id) },
              ]);
            }
          }} />
        ))}
      </View>
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      {saved ? <Text style={{ color: theme.colors.success }}>Profile saved.</Text> : null}
      <Button onPress={() => update()}>Save profile</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32, alignItems: 'stretch' },
  title: { ...typography.title },
  avatar: { width: 112, height: 112, borderRadius: 56, alignSelf: 'center' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
});
