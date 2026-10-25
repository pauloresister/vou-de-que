import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { brl, duration } from '@/lib/format';
import type { Choice, CompareResult } from '@/lib/types';
import { palette, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { Badge, StatusDot } from './Chip';
import { CROWD_LABEL, TRAFFIC_LABEL, capitalize } from './modes';

/** Comparativo lado a lado num único painel dividido ao meio: tempo, custo, condição e selos. */
export function SideBySide({ result }: { result: CompareResult }) {
  const t = useTheme();
  const { car, transit, recommendation: r } = result;

  const carCondition = car.available
    ? car.incidents.length > 0
      ? `${TRAFFIC_LABEL[car.trafficLevel]}, ${car.incidents.length} ${car.incidents.length === 1 ? 'ocorrência' : 'ocorrências'}`
      : TRAFFIC_LABEL[car.trafficLevel]
    : (car.unavailableReason ?? 'Sem rota');

  const transitCondition = transit.crowding
    ? `Lotação: ${CROWD_LABEL[transit.crowding.level].toLowerCase()}`
    : transit.lineAlerts.length > 0
      ? 'Atraso relatado'
      : 'Sem relatos de lotação';

  const transitDotColor = transit.crowding
    ? t.crowd[transit.crowding.level]
    : transit.lineAlerts.length > 0
      ? t.danger
      : t.textMuted;

  return (
    <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Column
        choice="car"
        r={r}
        title="Carro"
        icon="car-sport"
        accent={t.carText}
        minutes={car.available ? car.durationMin : null}
        cost={car.available ? car.cost : null}
        condition={<StatusDot color={car.available ? t.traffic[car.trafficLevel] : t.textMuted} label={carCondition} />}
      />
      <View style={[styles.split, { backgroundColor: t.border }]} />
      <Column
        choice="transit"
        r={r}
        title={capitalize(transit.modeLabel)}
        icon="bus"
        accent={t.transitText}
        minutes={transit.durationMin}
        cost={transit.cost}
        condition={<StatusDot color={transitDotColor} label={transitCondition} />}
      />
    </View>
  );
}

function Column({
  choice,
  r,
  title,
  icon,
  accent,
  minutes,
  cost,
  condition,
}: {
  choice: Choice;
  r: CompareResult['recommendation'];
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  minutes: number | null;
  cost: number | null;
  condition: React.ReactNode;
}) {
  const t = useTheme();
  const isBest = r.best === choice && !r.closeCall;
  const fastest = r.fastest === choice;
  const cheapest = r.cheapest === choice;
  const markColor = choice === 'car' ? palette.faixa : t.transit;
  const markInk = choice === 'car' ? palette.asfalto : palette.branco;

  return (
    <View
      style={styles.column}
      accessible
      accessibilityLabel={[
        title,
        minutes != null ? duration(minutes) : 'sem rota',
        cost != null ? brl(cost) : '',
        isBest ? 'opção recomendada' : '',
        fastest ? 'mais rápida' : '',
        cheapest ? 'mais econômica' : '',
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={[styles.topMark, { backgroundColor: isBest ? markColor : 'transparent' }]} />
      <View style={styles.titleRow}>
        <Ionicons name={icon} size={18} color={accent} />
        <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </AppText>
      </View>

      <AppText variant="numeral" color={t.text}>
        {minutes != null ? duration(minutes) : 'Sem rota'}
      </AppText>
      <AppText variant="numeralSmall" color={t.textMuted}>
        {cost != null ? brl(cost) : 'Sem custo'}
      </AppText>

      <View style={{ minHeight: 40, justifyContent: 'center' }}>{condition}</View>

      <View style={styles.badges}>
        {fastest ? (
          <View style={{ gap: 2 }}>
            <Badge label="Mais rápida" color={markColor} ink={markInk} />
            <AppText variant="small" color={t.textMuted}>
              {r.timeSavedMin} min a menos
            </AppText>
          </View>
        ) : null}
        {cheapest ? (
          <View style={{ gap: 2 }}>
            <Badge label="Mais econômica" color={markColor} ink={markInk} />
            <AppText variant="small" color={t.textMuted}>
              {brl(r.moneySaved)} a menos
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' },
  split: { width: StyleSheet.hairlineWidth },
  column: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs },
  topMark: { height: 5, marginHorizontal: -space.lg, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badges: { gap: space.sm, marginTop: space.xs },
});
