import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Chip';
import { CROWD_LABEL, INCIDENT_ICON, INCIDENT_LABEL } from '@/components/modes';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { api } from '@/lib/api';
import type { AlertKind, CrowdLevel, IncidentType } from '@/lib/types';
import { useTrip } from '@/store/trip';
import { fonts, radius, space, useTheme } from '@/theme';

export default function ReportScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ line?: string }>();
  const { result, origin } = useTrip();
  const [kind, setKind] = useState<AlertKind>('lotacao');
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);
  const [incident, setIncident] = useState<IncidentType | null>(null);
  const [line, setLine] = useState(params.line ?? '');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { locate } = useCurrentLocation();

  const tripLines = useMemo(
    () => [...new Set((result?.transit.legs ?? []).filter((l) => l.mode !== 'walk' && l.line).map((l) => l.line as string))],
    [result],
  );

  const needsLine = kind === 'lotacao' || incident === 'atraso_linha';
  const ready = kind === 'lotacao' ? !!crowd && line.trim().length > 0 : !!incident && (!needsLine || line.trim().length > 0);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const pos = (await locate()) ?? (origin ? { lat: origin.lat, lng: origin.lng } : null);
      if (!pos) {
        setError('Precisamos da sua localização para posicionar o alerta. Libere o acesso nas configurações do aparelho.');
        return;
      }
      await api.createAlert({
        kind,
        crowdLevel: kind === 'lotacao' ? (crowd ?? undefined) : undefined,
        incidentType: kind === 'ocorrencia' ? (incident ?? undefined) : undefined,
        line: needsLine ? line.trim() : undefined,
        note: note.trim() || undefined,
        ...pos,
      });
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/alertas')), 900);
    } catch (e) {
      setError((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + space.md, borderBottomColor: t.border }]}>
        <AppText variant="title" style={{ flex: 1 }} accessibilityRole="header">
          Reportar alerta
        </AppText>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
          <Ionicons name="close" size={28} color={t.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        <Segmented<AlertKind>
          value={kind}
          onChange={(k) => {
            setKind(k);
            setError(null);
          }}
          options={[
            { value: 'lotacao', label: 'Lotação' },
            { value: 'ocorrencia', label: 'Ocorrência' },
          ]}
        />

        {kind === 'lotacao' ? (
          <View style={styles.section}>
            <AppText variant="heading">Como está o ônibus ou trem?</AppText>
            <View style={styles.levels}>
              {(['vazio', 'moderado', 'lotado'] as CrowdLevel[]).map((level) => {
                const selected = crowd === level;
                const color = t.crowd[level];
                return (
                  <Pressable
                    key={level}
                    onPress={() => setCrowd(level)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.level, { borderColor: selected ? color : t.border, backgroundColor: selected ? color : t.surface }]}
                  >
                    <View style={styles.people}>
                      {Array.from({ length: level === 'vazio' ? 1 : level === 'moderado' ? 2 : 3 }).map((_, i) => (
                        <Ionicons key={i} name="person" size={20} color={selected ? '#FFFFFF' : color} />
                      ))}
                    </View>
                    <AppText variant="bodyStrong" color={selected ? '#FFFFFF' : t.text}>
                      {CROWD_LABEL[level]}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <AppText variant="heading">O que está acontecendo?</AppText>
            {(['transito_parado', 'acidente', 'atraso_linha'] as IncidentType[]).map((type) => {
              const selected = incident === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setIncident(type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.option,
                    { borderColor: selected ? t.danger : t.border, backgroundColor: t.surface },
                    selected && { borderWidth: 2.5 },
                  ]}
                >
                  <Ionicons name={INCIDENT_ICON[type]} size={24} color={selected ? t.danger : t.textMuted} />
                  <AppText variant="bodyStrong" style={{ flex: 1 }}>
                    {INCIDENT_LABEL[type]}
                  </AppText>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={t.danger} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {needsLine ? (
          <View style={styles.section}>
            <AppText variant="bodyStrong">Qual linha?</AppText>
            <TextInput
              value={line}
              onChangeText={setLine}
              placeholder="Ex.: 8700-10 ou Linha 4-Amarela"
              placeholderTextColor={t.textMuted}
              autoCapitalize="characters"
              maxLength={40}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
              accessibilityLabel="Linha"
            />
            {tripLines.length > 0 ? (
              <View style={styles.suggestions}>
                {tripLines.map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => setLine(l)}
                    style={[styles.lineChip, { borderColor: t.border, backgroundColor: line === l ? t.surfaceAlt : 'transparent' }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Usar linha ${l}`}
                  >
                    <Ionicons name="bus-outline" size={16} color={t.text} />
                    <AppText variant="small">{l}</AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="bodyStrong">Comentário (opcional)</AppText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ex.: faixa da direita bloqueada"
            placeholderTextColor={t.textMuted}
            maxLength={140}
            multiline
            style={[styles.input, styles.note, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
            accessibilityLabel="Comentário"
          />
          <AppText variant="small" color={t.textMuted}>
            O alerta fica visível por {kind === 'lotacao' ? '30' : '60'} minutos e usa sua localização atual.
          </AppText>
        </View>

        {error ? (
          <AppText variant="body" color={t.danger} accessibilityLiveRegion="assertive">
            {error}
          </AppText>
        ) : null}

        <Button
          label={sent ? 'Alerta enviado' : 'Enviar alerta'}
          icon={sent ? 'checkmark' : 'send'}
          onPress={send}
          loading={sending}
          disabled={!ready || sent}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { padding: space.lg, gap: space.xl },
  section: { gap: space.md },
  levels: { flexDirection: 'row', gap: space.sm },
  level: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.piece,
    borderWidth: 2,
  },
  people: { flexDirection: 'row', height: 22 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.piece,
    borderWidth: 1.5,
    minHeight: 60,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.piece,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  note: { minHeight: 84, textAlignVertical: 'top' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
});
