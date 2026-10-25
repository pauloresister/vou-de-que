import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';
import { AppText } from './AppText';

/** Topo em "asfalto", comum a todas as telas. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { backgroundColor: t.header, paddingTop: insets.top + space.lg }]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" color={t.headerText} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="small" color={t.headerMuted}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
