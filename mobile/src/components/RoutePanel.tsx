import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputInstance, View } from 'react-native';
import { fonts, palette, radius, space } from '@/theme';

export type FieldKey = 'origin' | 'destination';

interface Props {
  originText: string;
  destinationText: string;
  active: FieldKey | null;
  onFocus: (field: FieldKey) => void;
  onChangeText: (field: FieldKey, text: string) => void;
  onClear: (field: FieldKey) => void;
  onSwap: () => void;
}

/**
 * Origem e destino ligados por uma faixa tracejada, como numa via.
 * Fica sobre o fundo asfalto do topo da tela.
 */
export const RoutePanel = forwardRef<TextInputInstance, Props>(function RoutePanel(
  { originText, destinationText, active, onFocus, onChangeText, onClear, onSwap },
  destinationRef,
) {
  return (
    <View style={styles.panel}>
      <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.node, { borderColor: palette.papel }]} />
        <View style={styles.dashes}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={[styles.node, styles.nodeEnd]} />
      </View>

      <View style={styles.fields}>
        <Field
          placeholder="De onde você sai?"
          value={originText}
          focused={active === 'origin'}
          onFocus={() => onFocus('origin')}
          onChangeText={(t) => onChangeText('origin', t)}
          onClear={() => onClear('origin')}
          label="Origem"
        />
        <View style={styles.divider} />
        <Field
          ref={destinationRef}
          placeholder="Para onde você vai?"
          value={destinationText}
          focused={active === 'destination'}
          onFocus={() => onFocus('destination')}
          onChangeText={(t) => onChangeText('destination', t)}
          onClear={() => onClear('destination')}
          label="Destino"
        />
      </View>

      <Pressable
        onPress={onSwap}
        style={({ pressed }) => [styles.swap, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Inverter origem e destino"
        hitSlop={8}
      >
        <Ionicons name="swap-vertical" size={22} color={palette.papel} />
      </Pressable>
    </View>
  );
});

interface FieldProps {
  placeholder: string;
  value: string;
  focused: boolean;
  label: string;
  onFocus: () => void;
  onChangeText: (t: string) => void;
  onClear: () => void;
}

const Field = forwardRef<TextInputInstance, FieldProps>(function Field(
  { placeholder, value, focused, label, onFocus, onChangeText, onClear },
  ref,
) {
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <TextInput
        ref={ref}
        value={value}
        onFocus={onFocus}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8E9AAA"
        selectionColor={palette.faixa}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={label}
        selectTextOnFocus
        maxFontSizeMultiplier={1.4}
      />
      {value.length > 0 && focused ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel={`Limpar ${label.toLowerCase()}`}>
          <Ionicons name="close-circle" size={20} color="#8E9AAA" />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: palette.asfaltoClaro,
    borderRadius: radius.panel,
    paddingVertical: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    gap: space.md,
  },
  rail: { width: 14, alignItems: 'center', paddingVertical: 22 },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  nodeEnd: { backgroundColor: palette.faixa, borderColor: palette.faixa, borderRadius: 3 },
  dashes: { flex: 1, justifyContent: 'space-evenly', paddingVertical: 4 },
  dash: { width: 3, height: 6, borderRadius: 2, backgroundColor: '#6F7C8D' },
  fields: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.piece,
    paddingHorizontal: space.sm,
  },
  fieldFocused: { backgroundColor: 'rgba(255,255,255,0.07)' },
  input: { flex: 1, color: palette.papel, fontFamily: fonts.medium, fontSize: 18, paddingVertical: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#3A475A', marginHorizontal: space.sm },
  swap: { width: 44, alignItems: 'center', justifyContent: 'center' },
});
