import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

export default function NotFoundScreen() {
  const { theme } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>This screen isn’t available.</Text>
        <Link href="/" style={[styles.link, { color: theme.colors.primary }]}>Return to TimeFlow</Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 20, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  link: { minHeight: 48, textAlignVertical: 'center', fontFamily: 'Inter_600SemiBold' },
});
