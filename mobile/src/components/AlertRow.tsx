import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { distance, haversineM, timeAgo } from '@/lib/format';
import type { Alert } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { CROWD_LABEL, INCIDENT_ICON, INCIDENT_LABEL } from './modes';

interface Props {
  alert: Alert;
  from: { lat: number; lng: number } | null;
  onConfirm: (a: Alert) => void;
  confirming: boolean;
  confirmed: boolean;
}

export function AlertRow({ alert, from, onConfirm, confirming, confirmed }: Props) {
  const t = useTheme();
  const isCrowd = alert.kind === 'lotacao';
  const color = isCrowd ? t.crowd[alert.crowdLevel ?? 'moderado'] : t.danger;
  const icon: keyof typeof Ionicons.glyphMap = isCrowd ? 'people' : INCIDENT_ICON[alert.incidentType ?? 'transito_parado'];
  const title = isCrowd
    ? `${CROWD_LABEL[alert.crowdLevel ?? 'moderado']} na linha ${alert.line ?? ''}`.trim()
    : alert.line
      ? `${INCIDENT_LABEL[alert.incidentType ?? 'atraso_linha']}, linha ${alert.line}`
      : INCIDENT_LABEL[alert.incidentType ?? 'transito_parado'];
  const where = from ? `a ${distance(haversineM(from, alert))} de você, ` : '';
  const meta = `${where}${timeAgo(alert.createdAt)}`;

  return (
    <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[styles.icon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small" color={t.textMuted}>
          {meta}
          {alert.confirmations > 0
            ? `. ${alert.confirmations} ${alert.confirmations === 1 ? 'pessoa confirmou' : 'pessoas confirmaram'}`
            : ''}
        </AppText>
        {alert.note ? (
          <AppText variant="small" style={{ marginTop: 2 }}>
            “{alert.note}”
          </AppText>
        ) : null}
        <Pressable
          onPress={() => onConfirm(alert)}
          disabled={confirming || confirmed}
          accessibilityRole="button"
          accessibilityLabel={confirmed ? 'Você confirmou este alerta' : 'Confirmar que ainda está assim'}
          style={({ pressed }) => [
            styles.confirm,
            { borderColor: t.border, opacity: confirming ? 0.5 : 1 },
            pressed && { backgroundColor: t.surfaceAlt },
          ]}
        >
          <Ionicons name={confirmed ? 'checkmark-circle' : 'checkmark'} size={16} color={confirmed ? t.transitText : t.text} />
          <AppText variant="small" color={confirmed ? t.transitText : t.text}>
            {confirmed ? 'Confirmado' : 'Ainda está assim'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.piece, borderWidth: 1 },
  icon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confirm: {
    marginTop: space.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
});
