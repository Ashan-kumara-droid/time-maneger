import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppTheme } from '@/src/theme/ThemeProvider';

export default function TimetableSetupScreen() {
  const { theme } = useAppTheme();
  return (
    <View style={styles.page}>
      <Text style={[styles.step, { color: theme.colors.primary }]}>STEP 3 OF 3</Text>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Your timetable, your rules</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Add weekly commitments now or begin with a clean slate. You can update your timetable any time.
      </Text>
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Start by setting up your week</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Entering fixed activities helps TimeFlow find realistic time for tasks.
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button onPress={() => router.replace('/(tabs)/timetable')}>Add timetable activities</Button>
        <Button variant="outline" onPress={() => router.replace('/(tabs)')}>Set up later</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  step: { fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  title: { fontSize: 28, lineHeight: 35, fontFamily: 'Poppins_700Bold' },
  subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  card: { gap: 10, marginVertical: 8 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  actions: { gap: 10 },
});
