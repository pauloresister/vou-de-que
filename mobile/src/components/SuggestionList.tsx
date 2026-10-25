import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { Place } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

interface Props {
  places: Place[];
  loading: boolean;
  error: string | null;
  query: string;
  showMyLocation: boolean;
  locating: boolean;
  onPick: (p: Place) => void;
  onMyLocation: () => void;
}

export function SuggestionList({ places, loading, error, query, showMyLocation, locating, onPick, onMyLocation }: Props) {
  const t = useTheme();
  const tooShort = query.trim().length < 3;
  return (
    <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
      {showMyLocation ? (
        <Row icon="locate" title="Usar minha localização" onPress={onMyLocation} loading={locating} highlight />
      ) : null}
      {tooShort ? (
        <AppText variant="small" color={t.textMuted} style={styles.hint}>
          Digite ao menos 3 letras de um endereço, bairro ou estação.
        </AppText>
      ) : loading && places.length === 0 ? (
        <View style={styles.hint}>
          <ActivityIndicator color={t.textMuted} />
        </View>
      ) : error ? (
        <AppText variant="small" color={t.danger} style={styles.hint}>
          {error}
        </AppText>
      ) : places.length === 0 ? (
        <AppText variant="small" color={t.textMuted} style={styles.hint}>
          Nenhum lugar encontrado para “{query.trim()}”. Tente incluir a cidade.
        </AppText>
      ) : (
        places.map((p) => <Row key={p.id} icon="location-outline" title={p.name} subtitle={p.address} onPress={() => onPick(p)} />)
      )}
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
  loading,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
  highlight?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.surfaceAlt }]}
    >
      {loading ? (
        <ActivityIndicator color={t.transit} />
      ) : (
        <Ionicons name={icon} size={22} color={highlight ? t.transitText : t.textMuted} />
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1} color={highlight ? t.transitText : t.text}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color={t.textMuted} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.piece, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  hint: { padding: space.lg },
});
