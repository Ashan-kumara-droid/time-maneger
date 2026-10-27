import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type ButtonProps = PropsWithChildren<{
  onPress: PressableProps['onPress'];
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}>;

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const backgroundColor = variant === 'primary'
    ? colors.primary
    : variant === 'danger'
      ? colors.danger
      : variant === 'secondary'
        ? colors.primaryLight
        : 'transparent';
  const foregroundColor = variant === 'primary' || variant === 'danger'
    ? '#FFFFFF'
    : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'outline' ? colors.border : backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={foregroundColor} /> : (
        <Text style={[styles.label, { color: foregroundColor }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
});
