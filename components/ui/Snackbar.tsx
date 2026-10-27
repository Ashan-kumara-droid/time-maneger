import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type SnackbarProps = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

export function Snackbar({ visible, message, actionLabel, onAction, onDismiss }: SnackbarProps) {
  const { theme } = useAppTheme();

  useEffect(() => {
    if (!visible || !onDismiss) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, message, onDismiss]);

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: theme.colors.textPrimary }]}>
      <Text style={[styles.message, { color: theme.colors.surface }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={styles.action}>
          <Text style={[styles.actionLabel, { color: theme.colors.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          style={styles.action}>
          <Text style={[styles.actionLabel, { color: theme.colors.accent }]}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    elevation: 5,
  },
  message: { ...typography.body, flex: 1 },
  action: { minHeight: 40, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { ...typography.caption, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
});
