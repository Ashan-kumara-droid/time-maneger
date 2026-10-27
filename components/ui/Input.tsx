import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...inputProps }: InputProps) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const inputId = inputProps.nativeID;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text nativeID={inputId ? `${inputId}-label` : undefined} style={[styles.label, { color: colors.textPrimary }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        accessibilityHint={error}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
      />
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  error: { ...typography.caption },
});
