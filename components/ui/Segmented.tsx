import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type SegmentedProps = {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Segmented({ options, value, onChange, style, accessibilityLabel }: SegmentedProps) {
  const { theme } = useAppTheme();
  const colors = theme.colors;

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.container, { backgroundColor: colors.surfaceAlt }, style]}>
      {options.map(option => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.option,
              selected && { backgroundColor: colors.surface, shadowColor: colors.textPrimary },
            ]}>
            <Text style={[styles.label, { color: selected ? colors.primary : colors.textSecondary }]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    borderRadius: radius.md,
    padding: spacing.xxs,
    flexDirection: 'row',
  },
  option: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
});
