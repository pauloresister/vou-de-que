import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { duration } from '@/lib/format';
import type { CarOption, TransitOption } from '@/lib/types';
import { palette, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

const BAR_H = 18;
const DASH = 16;
const GAP = 9;

/**
 * A "pista do tempo": cada opção é uma faixa de asfalto cujo comprimento é proporcional ao tempo total.
 * Carro = faixa amarela tracejada. Coletivo = caminhada, espera e viagem a bordo em segmentos.
 * É o único movimento automático do app: as faixas avançam uma vez quando o resultado chega.
 */
export function TimeTrack({ car, transit }: { car: CarOption; transit: TransitOption }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const carAnim = useRef(new Animated.Value(0)).current;
  const transitAnim = useRef(new Animated.Value(0)).current;

  const max = Math.max(car.available ? car.durationMin : 0, transit.durationMin, 1);
  const carW = car.available ? Math.max(BAR_H, (width * car.durationMin) / max) : 0;
  const transitW = Math.max(BAR_H, (width * transit.durationMin) / max);

  useEffect(() => {
    if (width === 0) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        carAnim.setValue(1);
        transitAnim.setValue(1);
        return;
      }
      carAnim.setValue(0);
      transitAnim.setValue(0);
      Animated.stagger(120, [
        Animated.timing(carAnim, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(transitAnim, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [width, car.durationMin, transit.durationMin, carAnim, transitAnim]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const total = transit.walkMin + transit.waitMin + transit.inVehicleMin || 1;
  const seg = (m: number) => (transitW * m) / total;

  return (
    <View style={{ gap: space.lg }}>
      <Lane
        icon="car-sport"
        label="Carro"
        value={car.available ? duration(car.durationMin) : 'Sem rota'}
        color={t.carText}
      >
        <View style={[styles.track, { backgroundColor: t.dark ? '#0A0F16' : palette.asfalto }]} onLayout={onLayout}>
          {car.available ? (
            <Animated.View style={[styles.fill, { width: carAnim.interpolate({ inputRange: [0, 1], outputRange: [0, carW] }) }]}>
              <View style={[styles.dashRow, { width: carW }]}>
                {Array.from({ length: Math.max(1, Math.floor(carW / (DASH + GAP))) }).map((_, i) => (
                  <View key={i} style={styles.dash} />
                ))}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Lane>

      <Lane
        icon="bus"
        label={transit.modeLabel === 'transporte público' ? 'Coletivo' : capitalizeFirst(transit.modeLabel)}
        value={duration(transit.durationMin)}
        color={t.transitText}
      >
        <View style={[styles.track, { backgroundColor: t.dark ? '#0A0F16' : palette.asfalto }]}>
          <Animated.View
            style={[styles.fill, { width: transitAnim.interpolate({ inputRange: [0, 1], outputRange: [0, transitW] }) }]}
          >
            <View style={[styles.segRow, { width: transitW }]}>
              {transit.walkMin > 0 ? <View style={[styles.segWalk, { width: seg(transit.walkMin) }]} /> : null}
              {transit.waitMin > 0 ? (
                <View style={[styles.segWait, { width: seg(transit.waitMin), borderColor: t.transit }]} />
              ) : null}
              <View style={[styles.segRide, { flex: 1, backgroundColor: t.transit }]} />
            </View>
          </Animated.View>
        </View>
        <View style={styles.legend}>
          <Legend swatch={<View style={styles.swatchWalk} />} text={`Caminhada ${duration(transit.walkMin)}`} />
          <Legend swatch={<View style={[styles.swatchWait, { borderColor: t.transit }]} />} text={`Espera ${duration(transit.waitMin)}`} />
          <Legend swatch={<View style={[styles.swatchRide, { backgroundColor: t.transit }]} />} text={`A bordo ${duration(transit.inVehicleMin)}`} />
        </View>
      </Lane>
    </View>
  );
}

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Lane({
  icon,
  label,
  value,
  color,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.laneHead}>
        <Ionicons name={icon} size={20} color={color} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {label}
        </AppText>
        <AppText variant="numeralSmall" color={color}>
          {value}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function Legend({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.legendItem}>
      {swatch}
      <AppText variant="small" color={t.textMuted}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  laneHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  track: { height: BAR_H + 10, borderRadius: radius.track, padding: 5, overflow: 'hidden' },
  fill: { height: BAR_H, overflow: 'hidden', borderRadius: 3 },
  dashRow: { flexDirection: 'row', gap: GAP, height: BAR_H, alignItems: 'center' },
  dash: { width: DASH, height: 6, borderRadius: 2, backgroundColor: palette.faixa },
  segRow: { flexDirection: 'row', height: BAR_H, gap: 3 },
  segWalk: { height: BAR_H, borderRadius: 3, backgroundColor: '#9AA6B5' },
  segWait: { height: BAR_H, borderRadius: 3, borderWidth: 2, borderStyle: 'dashed' },
  segRide: { height: BAR_H, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatchWalk: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#9AA6B5' },
  swatchWait: { width: 12, height: 12, borderRadius: 3, borderWidth: 2, borderStyle: 'dashed' },
  swatchRide: { width: 12, height: 12, borderRadius: 3 },
});
