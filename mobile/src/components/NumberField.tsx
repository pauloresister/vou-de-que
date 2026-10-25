import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { decimal, parseDecimal } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

interface Props {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  prefix?: string;
  suffix?: string;
  digits?: number;
  min?: number;
  max?: number;
  help?: string;
}

/** Campo numérico que aceita vírgula, valida no fim da edição e volta ao último valor válido. */
export function NumberField({ label, value, onCommit, prefix, suffix, digits = 2, min = 0, max = 10_000, help }: Props) {
  const t = useTheme();
  const [text, setText] = useState(decimal(value, digits));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setText(decimal(value, digits)), [value, digits]);

  const commit = () => {
    const n = parseDecimal(text);
    if (n == null || n < min || n > max) {
      setInvalid(true);
      setText(decimal(value, digits));
      return;
    }
    setInvalid(false);
    onCommit(n);
    setText(decimal(n, digits));
  };

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View style={[styles.box, { backgroundColor: t.surface, borderColor: invalid ? t.danger : t.border }]}>
        {prefix ? <AppText color={t.textMuted}>{prefix}</AppText> : null}
        <TextInput
          value={text}
          onChangeText={(v) => {
            setInvalid(false);
            setText(v);
          }}
          onEndEditing={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          accessibilityLabel={label}
          style={[styles.input, { color: t.text }]}
          maxFontSizeMultiplier={1.4}
        />
        {suffix ? <AppText color={t.textMuted}>{suffix}</AppText> : null}
      </View>
      {invalid ? (
        <AppText variant="small" color={t.danger}>
          Use um valor entre {decimal(min, 0)} e {decimal(max, 0)}.
        </AppText>
      ) : help ? (
        <AppText variant="small" color={t.textMuted}>
          {help}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.piece,
    paddingHorizontal: space.lg,
    minHeight: 54,
    gap: space.sm,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 20, paddingVertical: 10 },
});
