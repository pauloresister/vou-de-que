import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { fonts, palette, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'sign' | 'solid' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/**
 * "sign": amarelo de placa sobre asfalto (ação principal no topo).
 * "solid": cor de texto do tema. "ghost": contorno discreto.
 */
export function Button({ label, onPress, variant = 'solid', icon, loading, disabled, style, accessibilityHint }: Props) {
  const t = useTheme();
  const bg = variant === 'sign' ? palette.faixa : variant === 'solid' ? t.text : 'transparent';
  const fg = variant === 'sign' ? palette.asfalto : variant === 'solid' ? t.bg : t.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: inactive ? 0.55 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: t.border },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={fg} />
        ) : null}
        <AppText variant="bodyStrong" color={fg} style={{ fontFamily: fonts.bold }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, borderRadius: radius.piece, paddingHorizontal: space.xl, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
