import { Text, type TextProps } from 'react-native';
import { type, useTheme, type TypeVariant } from '@/theme';

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
}

/** Texto com a escala tipográfica do app. Respeita o tamanho de fonte do sistema até 1,6×. */
export function AppText({ variant = 'body', color, style, ...rest }: Props) {
  const t = useTheme();
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[type[variant], { color: color ?? t.text }, style]} />;
}
