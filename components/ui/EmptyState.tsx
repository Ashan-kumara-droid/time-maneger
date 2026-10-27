import { StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/ui/CharacterAvatar';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/tokens';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: string;
};

export function EmptyState({ title, description, icon = '◷' }: EmptyStateProps) {
  const { theme, characterStyle } = useAppTheme();
  return (
    <View style={styles.container}>
      {characterStyle ? (
        <CharacterAvatar styleId={characterStyle} size={64} accentColor={theme.colors.primary} backgroundColor={theme.colors.primaryLight} />
      ) : (
        <View style={[styles.icon, { backgroundColor: theme.colors.primaryLight }]}>
          <Text accessibilityElementsHidden style={[styles.iconText, { color: theme.colors.primary }]}>{icon}</Text>
        </View>
      )}
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 28 },
  title: { ...typography.subtitle, textAlign: 'center' },
  description: { ...typography.body, textAlign: 'center', maxWidth: 300 },
});
