import { Pressable, PressableProps, StyleSheet, Text, ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: PressableProps['onPress'];
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Chip({ label, selected = false, onPress, style, accessibilityLabel }: ChipProps) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const content = (
    <Text style={[styles.label, { color: selected ? colors.primary : colors.textSecondary }]}>
      {label}
    </Text>
  );

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={onPress ? { selected } : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
});
