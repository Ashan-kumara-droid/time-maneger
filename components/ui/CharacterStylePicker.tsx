import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { CharacterAvatar } from '@/components/ui/CharacterAvatar';
import { characterStyles, CharacterStyleId } from '@/src/theme/characterStyles';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/tokens';

type CharacterStylePickerProps = {
  value: CharacterStyleId | null;
  onChange: (value: CharacterStyleId | null) => void;
};

export function CharacterStylePicker({ value, onChange }: CharacterStylePickerProps) {
  const { theme } = useAppTheme();
  const [group, setGroup] = useState<'boy' | 'girl'>(
    value?.startsWith('girl-') ? 'girl' : 'boy',
  );
  const colors = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.textPrimary }]}>Character (optional)</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Choose an animated study companion, or leave characters off.
      </Text>
      <View style={styles.groupRow}>
        {(['boy', 'girl'] as const).map(option => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: group === option }}
            onPress={() => setGroup(option)}
            style={[
              styles.groupOption,
              {
                backgroundColor: group === option ? colors.primaryLight : colors.surface,
                borderColor: group === option ? colors.primary : colors.border,
              },
            ]}>
            <Text style={{ color: colors.textPrimary, ...typography.caption }}>
              {option === 'boy' ? 'Boy styles' : 'Girl styles'}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: value === null }}
          onPress={() => onChange(null)}
          style={[
            styles.groupOption,
            {
              backgroundColor: value === null ? colors.primaryLight : colors.surface,
              borderColor: value === null ? colors.primary : colors.border,
            },
          ]}>
          <Text style={{ color: colors.textPrimary, ...typography.caption }}>Off</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {characterStyles.filter(style => style.group === group).map(character => {
          const selected = value === character.id;
          return (
            <Pressable
              key={character.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(character.id)}
              style={styles.option}>
              <Card style={[
                styles.card,
                selected && { borderColor: colors.primary, borderWidth: 2 },
              ]}>
                <CharacterAvatar
                  styleId={character.id}
                  size={50}
                  accentColor={colors.primary}
                  backgroundColor={colors.primaryLight}
                />
                <Text style={[styles.label, { color: colors.textPrimary }]}>{character.label}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
  description: { ...typography.caption, lineHeight: 18 },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupOption: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  option: { width: '50%', padding: 4 },
  card: { minHeight: 116, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { ...typography.caption, textAlign: 'center', lineHeight: 17 },
});
