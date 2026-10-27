import { create } from 'zustand';
import * as Haptics from 'expo-haptics';

import { listTasks } from '@/src/db/repositories/taskRepository';
import { listSessions } from '@/src/db/repositories/sessionRepository';
import { completeSession as completeSessionService, completeTask as completeTaskService } from '@/src/services/taskService';
import { TaskRecord } from '@/src/db/repositories/taskRepository';
import { SessionRecord } from '@/src/db/repositories/sessionRepository';

type AppState = {
  tasks: TaskRecord[];
  sessions: SessionRecord[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  completeSession: (id: string, actualMinutes?: number) => Promise<() => Promise<void>>;
  completeTask: (id: string) => Promise<() => Promise<void>>;
};

export const useAppStore = create<AppState>((set, get) => ({
  tasks: [],
  sessions: [],
  loading: false,
  error: null,
  reload: async () => {
    set({ loading: true, error: null });
    try {
      const [tasks, sessions] = await Promise.all([listTasks(), listSessions()]);
      set({ tasks, sessions, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  completeSession: async (id, actualMinutes) => {
    const undo = await completeSessionService(id, actualMinutes);
    await Haptics.selectionAsync();
    await get().reload();
    return async () => {
      await undo();
      await get().reload();
    };
  },
  completeTask: async id => {
    const undo = await completeTaskService(id);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await get().reload();
    return async () => {
      await undo();
      await get().reload();
    };
  },
}));
