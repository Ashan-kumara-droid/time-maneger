import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

let database: SQLiteDatabase | null = null;
let initialization: Promise<SQLiteDatabase> | null = null;

export async function initializeDatabase(): Promise<SQLiteDatabase> {
  if (database) return database;
  if (initialization) return initialization;

  initialization = (async () => {
    const openedDatabase = await openDatabaseAsync('timeflow.db');
    try {
      await runMigrations(openedDatabase);
      database = openedDatabase;
      return openedDatabase;
    } catch (error) {
      await openedDatabase.closeAsync();
      throw error;
    }
  })();

  try {
    return await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

export function getDatabase(): SQLiteDatabase {
  if (!database) {
    throw new Error('Database is not initialized. Call initializeDatabase() first.');
  }
  return database;
}
