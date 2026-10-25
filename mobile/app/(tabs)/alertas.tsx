import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { AlertRow } from '@/components/AlertRow';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Chip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useLiveAlerts } from '@/hooks/useLiveAlerts';
import { api } from '@/lib/api';
import type { Alert } from '@/lib/types';
import { useTrip } from '@/store/trip';
import { palette, space, useTheme } from '@/theme';

type Filter = 'todos' | 'lotacao' | 'ocorrencia';
const RADIUS_KM = 10;

export default function AlertsScreen() {
  const t = useTheme();
  const tripOrigin = useTrip((s) => s.origin);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const { locate, state: locationState } = useCurrentLocation();
  const center = position ?? (tripOrigin ? { lat: tripOrigin.lat, lng: tripOrigin.lng } : null);
  const { alerts, live, loading, error, refresh, replace } = useLiveAlerts(center, RADIUS_KM);
  const [filter, setFilter] = useState<Filter>('todos');
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Usa a localização sem pedir permissão se ela já foi concedida antes.
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(async ({ granted }) => {
        if (!granted) return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
        if (last) setPosition({ lat: last.coords.latitude, lng: last.coords.longitude });
      })
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const visible = useMemo(() => (filter === 'todos' ? alerts : alerts.filter((a) => a.kind === filter)), [alerts, filter]);

  const confirm = async (a: Alert) => {
    setConfirming(a.id);
    try {
      const { alert } = await api.confirmAlert(a.id);
      replace(alert);
      setConfirmed((prev) => new Set(prev).add(a.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setConfirming(null);
    }
  };

  const liveLabel = live === 'live' ? 'Ao vivo' : live === 'connecting' ? 'Conectando' : 'Reconectando';
  const liveColor = live === 'live' ? palette.linhaClara : palette.faixa;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader
        title="Alertas da comunidade"
        subtitle={center ? `Num raio de ${RADIUS_KM} km` : 'Escolha um local para ver alertas'}
        right={
          <View style={styles.live} accessibilityLabel={`Conexão: ${liveLabel}`}>
            <View style={[styles.liveDot, { backgroundColor: liveColor }]} />
            <AppText variant="small" color={t.headerText}>
              {liveLabel}
            </AppText>
          </View>
        }
      >
        <Button variant="sign" icon="megaphone" label="Reportar alerta" onPress={() => router.push('/reportar')} />
      </ScreenHeader>

      <FlatList
        data={center ? visible : []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.textMuted} />}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'lotacao', label: 'Lotação' },
                { value: 'ocorrencia', label: 'Ocorrências' },
              ]}
            />
            {notice ? (
              <AppText variant="small" color={t.danger} onPress={() => setNotice(null)}>
                {notice}
              </AppText>
            ) : null}
            {error ? (
              <AppText variant="small" color={t.danger}>
                {error}
              </AppText>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) => (
          <AlertRow
            alert={item}
            from={center}
            onConfirm={confirm}
            confirming={confirming === item.id}
            confirmed={confirmed.has(item.id)}
          />
        )}
        ListEmptyComponent={
          !center ? (
            <View style={styles.empty}>
              <AppText variant="heading">Onde você está?</AppText>
              <AppText variant="body" color={t.textMuted}>
                Use sua localização para ver lotação e ocorrências por perto, ou faça uma comparação de trajeto na
                primeira aba.
              </AppText>
              <Button
                icon="locate"
                label="Usar minha localização"
                loading={locationState === 'locating'}
                onPress={async () => {
                  const pos = await locate();
                  if (pos) setPosition(pos);
                }}
              />
              {locationState === 'denied' ? (
                <AppText variant="small" color={t.danger}>
                  Sem permissão de localização. Libere o acesso nas configurações do aparelho.
                </AppText>
              ) : null}
            </View>
          ) : loading ? undefined : (
            <View style={styles.empty}>
              <AppText variant="heading">Tudo tranquilo por aqui</AppText>
              <AppText variant="body" color={t.textMuted}>
                Nenhum alerta ativo num raio de {RADIUS_KM} km. Viu ônibus lotado ou trânsito parado? Avise quem vem
                atrás.
              </AppText>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl, gap: space.md },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  empty: { gap: space.md, paddingTop: space.lg },
});
