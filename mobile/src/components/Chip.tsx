import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

/** Indicador de condição: um ponto colorido + texto (a cor nunca é a única pista). */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="small" style={{ flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

export function Badge({ label, color, ink }: { label: string; color: string; ink: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <AppText variant="small" color={ink} style={{ fontFamily: 'Barlow_700Bold' }}>
        {label}
      </AppText>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <AppText
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            variant="bodyStrong"
            color={active ? t.bg : t.text}
            style={[styles.segment, active && { backgroundColor: t.text }]}
            suppressHighlighting
          >
            {o.label}
          </AppText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3 },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
