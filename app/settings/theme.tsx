import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CharacterStylePicker } from '@/components/ui/CharacterStylePicker';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { ThemeBase } from '@/src/theme/palettes';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/tokens';
import { CharacterAvatar } from '@/components/ui/CharacterAvatar';
import { universityDegreeTypes } from '@/src/university/degreeTypes';

const customSwatches = [
  { label: 'Violet', primary: '#7C3AED', accent: '#A78BFA', background: '#F5F3FF' },
  { label: 'Teal', primary: '#0F766E', accent: '#5EEAD4', background: '#F0FDFA' },
  { label: 'Ocean', primary: '#0369A1', accent: '#38BDF8', background: '#F0F9FF' },
  { label: 'Berry', primary: '#BE185D', accent: '#F472B6', background: '#FDF2F8' },
  { label: 'Amber', primary: '#B45309', accent: '#FBBF24', background: '#FFFBEB' },
  { label: 'Slate', primary: '#475569', accent: '#94A3B8', background: '#F8FAFC' },
];

export default function ThemeSettingsScreen() {
  const {
    theme,
    characterStyle,
    degreeType,
    setBase,
    setMode,
    setCustomColors,
    setCharacterStyle,
    setDegreeType,
  } = useAppTheme();
  const colors = theme.colors;
  const palettes: { id: ThemeBase; label: string }[] = [
    { id: 'blue', label: 'Blue' },
    { id: 'pink', label: 'Pink' },
    { id: 'neutral', label: 'Neutral' },
  ];

  return (
    <Screen contentContainerStyle={styles.page}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Appearance</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Choose a palette, university program theme, and display mode.
      </Text>
      <Text style={[styles.label, { color: colors.textPrimary }]}>Palette</Text>
      <View style={styles.row}>
        {palettes.map(item => <Chip key={item.id} label={item.label} selected={theme.base === item.id} onPress={() => { setBase(item.id); setMode('system'); }} />)}
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]}>University program theme</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Choose a degree-specific color palette and matching timetable activity presets.
      </Text>
      <View style={styles.row}>
        <Chip
          label="General"
          selected={degreeType === null}
          onPress={() => { setDegreeType(null); setMode('system'); }}
        />
        {universityDegreeTypes.map(degree => (
          <Chip
            key={degree.id}
            label={degree.label}
            selected={degreeType === degree.id}
            onPress={() => { setDegreeType(degree.id); setMode('system'); }}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]}>Mode</Text>
      <View style={styles.row}>
        {(['system', 'light', 'dark', 'custom'] as const).map(value => (
          <Chip key={value} label={value === 'system' ? 'System' : value[0].toUpperCase() + value.slice(1)} selected={theme.selection === value} onPress={() => setMode(value)} />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]}>Custom color builder</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Choose a tested color combination. Text colors stay high-contrast for comfortable reading.
      </Text>
      <View style={styles.swatches}>
        {customSwatches.map(swatch => (
          <Chip key={swatch.label} label={swatch.label} selected={theme.selection === 'custom' && colors.primary === swatch.primary} onPress={() => {
            setCustomColors({ primary: swatch.primary, accent: swatch.accent, background: swatch.background });
            setMode('custom');
          }} style={styles.swatch} />
        ))}
      </View>
      <CharacterStylePicker value={characterStyle} onChange={setCharacterStyle} />
      <Card style={styles.preview}>
        <View style={styles.previewHeader}>
          {characterStyle ? (
            <CharacterAvatar styleId={characterStyle} size={48} accentColor={colors.primary} backgroundColor={colors.primaryLight} />
          ) : null}
          <View style={styles.previewCopy}>
            <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Live preview</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your theme updates throughout TimeFlow.</Text>
          </View>
        </View>
        <Button onPress={() => undefined}>Primary button</Button>
      </Card>
      <Button variant="outline" onPress={() => { setBase('blue'); setMode('system'); }}>Reset to blue system default</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  title: { ...typography.title },
  subtitle: { ...typography.caption, lineHeight: 18 },
  label: { ...typography.caption, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { minWidth: '30%' },
  preview: { gap: 10 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewCopy: { flex: 1 },
  previewTitle: { ...typography.body, fontFamily: 'Inter_600SemiBold' },
});
