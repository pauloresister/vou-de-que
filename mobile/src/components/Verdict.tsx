import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { clock } from '@/lib/format';
import type { CompareResult } from '@/lib/types';
import { fonts, space, useTheme } from '@/theme';
import { AppText } from './AppText';

/** O veredito: a frase que responde "vou de quê?" em uma linha, seguida do resumo de apoio. */
export function Verdict({ result }: { result: CompareResult }) {
  const t = useTheme();
  const { recommendation: r, car, transit } = result;
  const color = r.closeCall || !r.best ? t.text : r.best === 'car' ? t.carText : t.transitText;
  const icon = r.best === 'car' ? 'car-sport' : r.best === 'transit' ? 'bus' : 'swap-horizontal';
  const carPart =
    car.source === 'tempo_real' ? 'trânsito ao vivo' : car.available ? 'trânsito estimado pelo horário' : null;
  const transitPart =
    transit.source === 'tempo_real'
      ? 'horários do coletivo em tempo real'
      : transit.source === 'horario'
        ? 'horários oficiais das linhas'
        : 'tempo do coletivo estimado';
  const basis = [carPart, transitPart].filter(Boolean).join(' e ');

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.headRow}>
        <Ionicons name={icon} size={30} color={color} />
        <AppText variant="display" color={color} style={styles.headline} accessibilityRole="header">
          {r.headline}
        </AppText>
      </View>
      <AppText variant="body" style={styles.summary}>
        {r.summary}
      </AppText>
      <AppText variant="small" color={t.textMuted}>
        Calculado às {clock(result.generatedAt)} com {basis}.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headline: { flexShrink: 1, fontFamily: fonts.numeral, letterSpacing: -0.3 },
  summary: { fontSize: 18, lineHeight: 27 },
});
