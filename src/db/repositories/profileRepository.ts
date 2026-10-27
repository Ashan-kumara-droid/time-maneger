import { getDatabase } from '../client';

export type Profile = {
  id: 1;
  username: string;
  gender: 'male' | 'female' | 'other';
  occupation: 'university' | 'school' | 'professional' | null;
  avatar_uri: string | null;
  created_at: string;
};

export async function getProfile(): Promise<Profile | null> {
  return getDatabase().getFirstAsync<Profile>('SELECT * FROM profile WHERE id = 1');
}

export async function saveProfile(profile: Omit<Profile, 'id'>): Promise<void> {
  await getDatabase().runAsync(
    `INSERT INTO profile (id, username, gender, occupation, avatar_uri, created_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       username = excluded.username,
       gender = excluded.gender,
       occupation = excluded.occupation,
       avatar_uri = excluded.avatar_uri`,
    profile.username,
    profile.gender,
    profile.occupation,
    profile.avatar_uri,
    profile.created_at,
  );
}
