import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, type TextInputInstance, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { RouteMap } from '@/components/RouteMap';
import { RoutePanel, type FieldKey } from '@/components/RoutePanel';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SideBySide } from '@/components/SideBySide';
import { SuggestionList } from '@/components/SuggestionList';
import { TimeTrack } from '@/components/TimeTrack';
import { CarDetails, TransitSteps } from '@/components/TripDetails';
import { Verdict } from '@/components/Verdict';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useDebounced } from '@/hooks/useDebounced';
import { api } from '@/lib/api';
import { brl, decimal } from '@/lib/format';
import type { Place } from '@/lib/types';
import { useSettings } from '@/store/settings';
import { useTrip, type TripPoint } from '@/store/trip';
import { palette, radius, space, useTheme } from '@/theme';

export default function CompareScreen() {
  const t = useTheme();
  const { origin, destination, result, status, error, setOrigin, setDestination, swap, setResult, setStatus } = useTrip();
  const [active, setActive] = useState<FieldKey | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 350);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const { locate, state: locationState } = useCurrentLocation();
  const destinationRef = useRef<TextInputInstance>(null);
  const settings = useSettings();

  // Autocompletar com cancelamento das buscas antigas.
  useEffect(() => {
    if (!active || debouncedQuery.trim().length < 3) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const near = userPos ?? (origin ? { lat: origin.lat, lng: origin.lng } : undefined);
    api
      .searchPlaces(debouncedQuery.trim(), near, controller.signal)
      .then((r) => {
        setPlaces(r.places);
        setSearchError(null);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setSearchError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const runCompare = useCallback(
    async (o: TripPoint | null = origin, d: TripPoint | null = destination) => {
      if (!o || !d) return;
      setStatus('loading');
      try {
        const r = await api.compare(o, d);
        setResult(r);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        setStatus('error', (e as Error).message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    },
    [origin, destination, setResult, setStatus],
  );

  const closeSearch = () => {
    setActive(null);
    setQuery('');
    setPlaces([]);
    Keyboard.dismiss();
  };

  const choose = (field: FieldKey, point: TripPoint) => {
    closeSearch();
    if (field === 'origin') {
      setOrigin(point);
      if (destination) runCompare(point, destination);
      else setTimeout(() => destinationRef.current?.focus(), 80);
    } else {
      setDestination(point);
      if (origin) runCompare(origin, point);
    }
  };

  const useMyLocation = async () => {
    const field = active ?? 'origin';
    const pos = await locate();
    if (!pos) return;
    setUserPos(pos);
    const point: TripPoint = { id: 'minha-localizacao', name: 'Minha localização', address: '', ...pos, isCurrentLocation: true };
    choose(field, point);
    // Endereço legível chega depois, sem atrasar a comparação.
    api
      .reverse(pos.lat, pos.lng)
      .then(({ place }) => {
        if (!place) return;
        const s = useTrip.getState();
        const current = field === 'origin' ? s.origin : s.destination;
        if (current?.id !== 'minha-localizacao') return;
        const withAddress = { ...current, address: [place.name, place.address].filter(Boolean).join(', ') };
        useTrip.setState(field === 'origin' ? { origin: withAddress } : { destination: withAddress });
      })
      .catch(() => {});
  };

  const textFor = (field: FieldKey) => {
    if (active === field) return query;
    const p = field === 'origin' ? origin : destination;
    return p ? p.name : '';
  };

  const searching_ = active !== null;
  const canCompare = !!origin && !!destination;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        result && !searching_ ? (
          <RefreshControl refreshing={status === 'loading'} onRefresh={() => runCompare()} tintColor={t.textMuted} />
        ) : undefined
      }
    >
      <ScreenHeader
        title="Vou de quê?"
        subtitle="Carro ou transporte público, agora"
        right={
          searching_ ? (
            <Pressable onPress={closeSearch} hitSlop={10} accessibilityRole="button">
              <AppText variant="bodyStrong" color={palette.faixa}>
                Cancelar
              </AppText>
            </Pressable>
          ) : null
        }
      >
        <RoutePanel
          ref={destinationRef}
          originText={textFor('origin')}
          destinationText={textFor('destination')}
          active={active}
          onFocus={(field) => {
            setActive(field);
            const p = field === 'origin' ? origin : destination;
            setQuery(p && !p.isCurrentLocation ? p.name : '');
          }}
          onChangeText={(_, text) => setQuery(text)}
          onClear={(field) => {
            setQuery('');
            if (field === 'origin') setOrigin(null);
            else setDestination(null);
          }}
          onSwap={() => {
            swap();
            const s = useTrip.getState();
            if (s.origin && s.destination) runCompare(s.origin, s.destination);
          }}
        />
        {!searching_ ? (
          <Button
            variant="sign"
            icon={result ? 'refresh' : 'git-compare'}
            label={result ? 'Atualizar comparação' : 'Comparar agora'}
            onPress={() => runCompare()}
            loading={status === 'loading'}
            disabled={!canCompare}
            accessibilityHint="Calcula tempo e custo de carro e de transporte público para este trajeto"
          />
        ) : null}
      </ScreenHeader>

      <View style={styles.body}>
        {searching_ ? (
          <View style={{ gap: space.md }}>
            <SuggestionList
              places={places}
              loading={searching}
              error={searchError}
              query={query}
              showMyLocation
              locating={locationState === 'locating'}
              onPick={(p) => choose(active ?? 'origin', p)}
              onMyLocation={useMyLocation}
            />
            {locationState === 'denied' ? (
              <AppText variant="small" color={t.danger}>
                Sem permissão de localização. Libere o acesso nas configurações do aparelho ou digite o endereço.
              </AppText>
            ) : null}
          </View>
        ) : status === 'loading' && !result ? (
          renderLoading()
        ) : status === 'error' ? (
          <ErrorBox message={error ?? 'Não foi possível comparar agora.'} onRetry={() => runCompare()} />
        ) : result && origin && destination ? (
          renderResults()
        ) : (
          renderIntro()
        )}
      </View>
    </ScrollView>
  );

  // Funções de renderização (e não componentes aninhados) para não remontar a tela a cada digitação.
  function renderResults() {
    if (!result || !origin || !destination) return null;
    const firstLine = result.transit.legs.find((l) => l.mode !== 'walk' && l.line)?.line;
    return (
      <View style={{ gap: space.xl }}>
        <Verdict result={result} />
        <View style={[styles.trackPanel, { backgroundColor: t.surface, borderColor: t.border }]}>
          <TimeTrack car={result.car} transit={result.transit} />
        </View>
        <SideBySide result={result} />

        <Pressable
          onPress={() => router.push({ pathname: '/reportar', params: firstLine ? { line: firstLine } : {} })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.nudge, { borderColor: t.border }, pressed && { backgroundColor: t.surfaceAlt }]}
        >
          <Ionicons name="megaphone-outline" size={22} color={t.text} />
          <AppText variant="body" style={{ flex: 1 }}>
            Já está a caminho? Conte como está a lotação ou o trânsito.
          </AppText>
          <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
        </Pressable>

        <TransitSteps transit={result.transit} />
        <CarDetails car={result.car} />
        <RouteMap result={result} origin={origin} destination={destination} />
        <AppText variant="small" color={t.textMuted}>
          Carro: {result.car.provider || 'indisponível'}. Coletivo: {result.transit.provider}. Endereços e mapas:
          OpenStreetMap e OpenFreeMap.{' '}
          <AppText
            variant="small"
            color={t.transitText}
            accessibilityRole="link"
            onPress={() => Linking.openURL('https://transitous.org/sources/').catch(() => {})}
            style={{ textDecorationLine: 'underline' }}
          >
            Fontes do Transitous
          </AppText>
        </AppText>
      </View>
    );
  }

  function renderIntro() {
    const s = settings;
    return (
      <View style={{ gap: space.lg }}>
        <AppText variant="heading">Escolha a origem e o destino</AppText>
        <AppText variant="body" color={t.textMuted}>
          Calculamos agora o tempo e o custo de ir de carro e de transporte público, somando caminhada, espera e
          trânsito, e mostramos qual compensa mais.
        </AppText>
        <View style={[styles.assumptions, { backgroundColor: t.surface, borderColor: t.border }]}>
          <AppText variant="bodyStrong">Valores usados no cálculo</AppText>
          <AppText variant="body">
            Seu carro faz {decimal(s.consumptionKmL)} km/L com {s.fuelType} a {brl(s.fuelPrices[s.fuelType])}.
          </AppText>
          <AppText variant="body">Ônibus a {brl(s.fares.bus)} e metrô ou trem a {brl(s.fares.rail)}.</AppText>
          <Button variant="ghost" label="Ajustar valores" icon="options-outline" onPress={() => router.navigate('/ajustes')} />
        </View>
      </View>
    );
  }

  function renderLoading() {
    return (
      <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={t.textMuted} />
        <AppText variant="body" color={t.textMuted}>
          Consultando trânsito, linhas e alertas da comunidade…
        </AppText>
      </View>
    );
  }
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.assumptions, { backgroundColor: t.surface, borderColor: t.danger }]} accessibilityLiveRegion="assertive">
      <AppText variant="bodyStrong" color={t.danger}>
        Não foi possível comparar
      </AppText>
      <AppText variant="body">{message}</AppText>
      <Button label="Tentar de novo" icon="refresh" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingTop: space.xl },
  trackPanel: { borderRadius: radius.panel, borderWidth: 1, padding: space.lg },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.piece,
    padding: space.lg,
  },
  assumptions: { borderRadius: radius.piece, borderWidth: 1, padding: space.lg, gap: space.md },
  loading: { alignItems: 'center', gap: space.lg, paddingVertical: space.xxl },
});
