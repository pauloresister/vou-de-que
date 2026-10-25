import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { brl, clock, decimal, duration } from '@/lib/format';
import type { CarOption, TransitLeg, TransitOption } from '@/lib/types';
import { useSettings } from '@/store/settings';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { MODE_ICON } from './modes';

/** Passo a passo do coletivo: é uma sequência real, então cada etapa vira um marco na linha. */
export function TransitSteps({ transit }: { transit: TransitOption }) {
  const t = useTheme();
  const firstRide = transit.legs.findIndex((l) => l.mode !== 'walk');
  const steps: Array<{ key: string; icon: keyof typeof Ionicons.glyphMap; color: string; title: string; detail?: string }> = [];

  transit.legs.forEach((leg, i) => {
    if (i === firstRide && transit.waitMin > 0) {
      steps.push({
        key: 'wait',
        icon: 'hourglass-outline',
        color: t.textMuted,
        title: `Espere ${duration(transit.waitMin)} no ponto`,
        detail:
          transit.source === 'tempo_real'
            ? 'Pela previsão em tempo real do próximo veículo'
            : transit.source === 'horario'
              ? 'Pelo horário oficial da linha'
              : 'Estimativa pelo horário do dia',
      });
    }
    steps.push(stepFor(leg, i, t.textMuted, t.transit));
  });

  return (
    <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
      <AppText variant="heading">Como ir de {transit.modeLabel}</AppText>
      <View>
        {steps.map((s, i) => (
          <View key={s.key} style={styles.step}>
            <View style={styles.gutter}>
              <View style={[styles.stepIcon, { backgroundColor: s.color }]}>
                <Ionicons name={s.icon} size={16} color="#FFFFFF" />
              </View>
              {i < steps.length - 1 ? <View style={[styles.connector, { backgroundColor: t.border }]} /> : null}
            </View>
            <View style={styles.stepText}>
              <AppText variant="bodyStrong">{s.title}</AppText>
              {s.detail ? (
                <AppText variant="small" color={t.textMuted}>
                  {s.detail}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <AppText variant="body" color={t.textMuted} style={{ flex: 1 }}>
          {transit.fareRule}
          {transit.transfers > 0 ? `, ${transit.transfers} ${transit.transfers === 1 ? 'baldeação' : 'baldeações'}` : ''}
        </AppText>
        <AppText variant="numeralSmall">{brl(transit.cost)}</AppText>
      </View>
      {transit.reportedDelayMin > 0 ? (
        <AppText variant="small" color={t.danger}>
          Inclui {transit.reportedDelayMin} min de atraso relatado por usuários nesta linha.
        </AppText>
      ) : null}
    </View>
  );
}

function stepFor(leg: TransitLeg, i: number, walkColor: string, rideColor: string) {
  if (leg.mode === 'walk') {
    return {
      key: `leg-${i}`,
      icon: MODE_ICON.walk,
      color: walkColor,
      title: `Caminhe ${duration(leg.durationMin)}`,
      detail: leg.toName ? `Até ${leg.toName}` : undefined,
    };
  }
  const line = leg.line ? `Linha ${leg.line}` : 'Embarque no coletivo';
  const headsign = leg.headsign ? ` sentido ${leg.headsign}` : '';
  const when = leg.departure ? `Embarque às ${clock(leg.departure)}` : undefined;
  const where = leg.fromName ? `em ${leg.fromName}` : undefined;
  const ride = `${duration(leg.durationMin)} a bordo${leg.toName ? ` até ${leg.toName}` : ''}`;
  return {
    key: `leg-${i}`,
    icon: MODE_ICON[leg.mode],
    color: leg.color && /^#[0-9a-f]{6}$/i.test(leg.color) ? leg.color : rideColor,
    title: `${line}${headsign}`,
    detail: [when && where ? `${when} ${where}` : (when ?? where), ride].filter(Boolean).join('. '),
  };
}

/** Conta do carro à vista, para o usuário confiar no número. */
export function CarDetails({ car }: { car: CarOption }) {
  const t = useTheme();
  const { consumptionKmL, fuelType, fuelPrices } = useSettings();
  if (!car.available) return null;
  return (
    <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
      <AppText variant="heading">A conta do carro</AppText>
      <AppText variant="body">
        {decimal(car.distanceKm)} km ÷ {decimal(consumptionKmL)} km/L = {decimal(car.fuelLiters, 2)} L de {fuelType}
      </AppText>
      <AppText variant="body">
        {decimal(car.fuelLiters, 2)} L × {brl(fuelPrices[fuelType])} = {brl(car.fuelCost)}
      </AppText>
      {car.parkingCost > 0 ? <AppText variant="body">Estacionamento: {brl(car.parkingCost)}</AppText> : null}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <AppText variant="body" color={t.textMuted} style={{ flex: 1 }}>
          Sem trânsito, levaria {duration(car.freeFlowMin)}
        </AppText>
        <AppText variant="numeralSmall">{brl(car.cost)}</AppText>
      </View>
      {car.reportedDelayMin > 0 ? (
        <AppText variant="small" color={t.danger}>
          Inclui {car.reportedDelayMin} min por ocorrências relatadas no caminho.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.piece, borderWidth: 1, padding: space.lg, gap: space.md },
  step: { flexDirection: 'row', gap: space.md },
  gutter: { alignItems: 'center', width: 30 },
  stepIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 2, flex: 1, minHeight: 14, marginVertical: 2 },
  stepText: { flex: 1, paddingBottom: space.md, paddingTop: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, gap: space.md },
});
