import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, ColorValue } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { CharacterAvatar } from '@/components/ui/CharacterAvatar';
import { useAppStore } from '@/src/stores/useAppStore';
import { markPastSessionsMissed } from '@/src/services/schedulerService';
import { getSetting } from '@/src/db/repositories/settingsRepository';
import { useAppTheme } from '@/src/theme/ThemeProvider';

const tabDefinitions = [
  { name: 'index', title: 'Home' },
  { name: 'calendar', title: 'Calendar' },
  { name: 'tasks', title: 'Tasks' },
  { name: 'timetable', title: 'Timetable' },
  { name: 'analytics', title: 'Analytics' },
  { name: 'settings', title: 'Settings' },
] as const;

type TabIconName = (typeof tabDefinitions)[number]['name'];

function TabIcon({ name, color, size }: { name: TabIconName; color: ColorValue; size: number }) {
  const iconProps = {
    fill: 'none' as const,
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'index' && (
        <>
          <Path {...iconProps} d="m3.5 10.5 8.5-7 8.5 7" />
          <Path {...iconProps} d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" />
          <Circle cx="17.5" cy="6.5" r="1.1" fill={color} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect {...iconProps} x="3.5" y="5" width="17" height="16" rx="2.2" />
          <Line {...iconProps} x1="7.5" y1="3.5" x2="7.5" y2="7" />
          <Line {...iconProps} x1="16.5" y1="3.5" x2="16.5" y2="7" />
          <Line {...iconProps} x1="3.5" y1="9" x2="20.5" y2="9" />
          <Circle cx="8" cy="13" r="1" fill={color} />
          <Circle cx="12" cy="13" r="1" fill={color} />
          <Circle cx="16" cy="13" r="1" fill={color} />
          <Circle cx="8" cy="17" r="1" fill={color} />
          <Circle cx="12" cy="17" r="1" fill={color} />
        </>
      )}
      {name === 'tasks' && (
        <>
          <Rect {...iconProps} x="5" y="3.5" width="14" height="17" rx="2.5" />
          <Path {...iconProps} d="m8 9 1.4 1.4L12 7.8M13.8 9.5H16" />
          <Path {...iconProps} d="m8 15 1.4 1.4L12 13.8M13.8 15.5H16" />
        </>
      )}
      {name === 'timetable' && (
        <>
          <Circle {...iconProps} cx="12" cy="12.5" r="8.5" />
          <Path {...iconProps} d="M12 7.5v5l3.5 2" />
          <Path {...iconProps} d="M17.8 4.6 19.4 3M19.5 7h2" />
        </>
      )}
      {name === 'analytics' && (
        <>
          <Path {...iconProps} d="M4 20V5M4 20h17" />
          <Rect {...iconProps} x="7" y="13" width="3" height="5" rx="0.7" />
          <Rect {...iconProps} x="12" y="9" width="3" height="9" rx="0.7" />
          <Rect {...iconProps} x="17" y="5" width="3" height="13" rx="0.7" />
          <Path {...iconProps} d="m7.5 10 4-3 3 1 4-4" />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path
            {...iconProps}
            d="m10 3.5 4-.1.7 2.1a7.3 7.3 0 0 1 1.7 1l2.1-.8 2 3.5-1.5 1.7a7.6 7.6 0 0 1 0 2l1.5 1.7-2 3.5-2.1-.8a7.3 7.3 0 0 1-1.7 1l-.7 2.1-4 .1-.7-2.1a7.3 7.3 0 0 1-1.7-1l-2.1.8-2-3.5L5 13a7.6 7.6 0 0 1 0-2L3.5 9.3l2-3.5 2.1.8a7.3 7.3 0 0 1 1.7-1L10 3.5Z"
          />
          <Circle {...iconProps} cx="12" cy="12" r="3" />
        </>
      )}
    </Svg>
  );
}

export default function TabLayout() {
  const { theme, characterStyle } = useAppTheme();
  const router = useRouter();
  const reload = useAppStore(state => state.reload);

  useEffect(() => {
    let backgroundAt: number | null = null;
    const refresh = async () => {
      try {
        await markPastSessionsMissed();
        await reload();
      } catch (error) {
        console.error('Unable to refresh today’s schedule', error);
      }
    };
    refresh().catch(error => console.error('Unable to initialize schedule', error));
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        backgroundAt = Date.now();
        return;
      }
      refresh().catch(error => console.error('Unable to refresh schedule', error));
      if (backgroundAt !== null) {
        const backgroundDuration = Date.now() - backgroundAt;
        backgroundAt = null;
        Promise.all([getSetting('app_lock_enabled'), getSetting('lock_after_seconds')]).then(([enabled, delay]) => {
          const delayMs = delay === 'immediate' ? 0 : Number(delay ?? 30) * 1000;
          if (enabled === 'true' && backgroundDuration >= delayMs) router.replace('/lock');
        }).catch(error => console.error('Unable to check app lock policy', error));
      }
    });
    return () => subscription.remove();
  }, [reload, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 62,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
      }}>
      {tabDefinitions.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              tab.name === 'index' && characterStyle ? (
                <CharacterAvatar styleId={characterStyle} size={size + 8} accentColor={theme.colors.primary} backgroundColor={theme.colors.primaryLight} />
              ) : (
                <TabIcon name={tab.name} color={color} size={size} />
              )
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
