import 'react-native-url-polyfill/auto';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import { BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useSettings } from '@/store/settings';
import { space, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  const hydrated = useSettings((s) => s.hydrated);
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });

  // Se o armazenamento local demorar demais, segue com os valores padrão em vez de travar na abertura.
  useEffect(() => {
    const t = setTimeout(() => useSettings.setState({ hydrated: true }), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reportar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

/** Qualquer erro inesperado de tela cai aqui, com saída clara, em vez de fechar o app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useTheme();
  return (
    <View style={[styles.error, { backgroundColor: t.bg }]}>
      <AppText variant="title">Algo saiu do trajeto</AppText>
      <AppText variant="body" color={t.textMuted}>
        Esta tela encontrou um erro e foi interrompida. Toque em tentar de novo para recarregá-la.
      </AppText>
      <AppText variant="small" color={t.textMuted}>
        {error.message}
      </AppText>
      <Button label="Tentar de novo" icon="refresh" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg },
});
