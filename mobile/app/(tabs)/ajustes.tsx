import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Chip';
import { NumberField } from '@/components/NumberField';
import { ScreenHeader } from '@/components/ScreenHeader';
import { api } from '@/lib/api';
import { brl } from '@/lib/format';
import { type FuelType, useSettings } from '@/store/settings';
import { useTrip } from '@/store/trip';
import { fonts, radius, space, useTheme } from '@/theme';

const FUEL_LABEL: Record<FuelType, string> = { gasolina: 'Gasolina', etanol: 'Etanol', diesel: 'Diesel' };

export default function SettingsScreen() {
  const t = useTheme();
  const s = useSettings();
  const [loadingRef, setLoadingRef] = useState(false);
  const [refInfo, setRefInfo] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);

  // Mudou algum valor: o comparativo antigo deixa de valer.
  const update = (patch: Parameters<typeof s.update>[0]) => {
    s.update(patch);
    const trip = useTrip.getState();
    if (trip.result) useTrip.setState({ result: null, status: 'idle' });
  };

  const loadReference = async () => {
    setLoadingRef(true);
    setRefError(null);
    try {
      const ref = await api.referencePrices(s.uf);
      update({ fuelPrices: ref.fuel, fares: ref.fares });
      setRefInfo(`${ref.fuelReference}. Tarifas: ${ref.faresReference}.`);
    } catch (e) {
      setRefError((e as Error).message);
    } finally {
      setLoadingRef(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Ajustes" subtitle="Os valores que entram na conta" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Section title="Seu carro">
          <Segmented<FuelType>
            value={s.fuelType}
            onChange={(fuelType) => update({ fuelType })}
            options={(Object.keys(FUEL_LABEL) as FuelType[]).map((v) => ({ value: v, label: FUEL_LABEL[v] }))}
          />
          <NumberField
            label="Consumo médio"
            value={s.consumptionKmL}
            digits={1}
            min={1}
            max={60}
            suffix="km/L"
            help="Na cidade, a maioria dos carros fica entre 8 e 13 km/L."
            onCommit={(consumptionKmL) => update({ consumptionKmL })}
          />
          <NumberField
            label={`Preço da ${FUEL_LABEL[s.fuelType].toLowerCase()}`}
            value={s.fuelPrices[s.fuelType]}
            min={0.5}
            max={30}
            prefix="R$"
            suffix="/L"
            onCommit={(v) => update({ fuelPrices: { ...s.fuelPrices, [s.fuelType]: v } })}
          />
          <NumberField
            label="Estacionamento no destino"
            value={s.parkingCost}
            min={0}
            max={500}
            prefix="R$"
            help="Deixe 0 se você estaciona de graça."
            onCommit={(parkingCost) => update({ parkingCost })}
          />
        </Section>

        <Section title="Transporte público">
          <NumberField label="Tarifa de ônibus" value={s.fares.bus} max={100} prefix="R$" onCommit={(bus) => update({ fares: { ...s.fares, bus } })} />
          <NumberField label="Tarifa de metrô e trem" value={s.fares.rail} max={100} prefix="R$" onCommit={(rail) => update({ fares: { ...s.fares, rail } })} />
          <NumberField
            label="Integração ônibus + trilhos"
            value={s.fares.integrated}
            max={200}
            prefix="R$"
            help="Cobrada quando o trajeto combina ônibus com metrô ou trem."
            onCommit={(integrated) => update({ fares: { ...s.fares, integrated } })}
          />
        </Section>

        <Section title="Preços de referência">
          <View style={styles.ufRow}>
            <AppText variant="bodyStrong">Estado (UF)</AppText>
            <TextInput
              value={s.uf}
              onChangeText={(uf) => s.update({ uf: uf.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2) })}
              autoCapitalize="characters"
              maxLength={2}
              style={[styles.uf, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
              accessibilityLabel="Estado"
            />
          </View>
          <Button variant="ghost" icon="download-outline" label="Usar preços médios da ANP" onPress={loadReference} loading={loadingRef} />
          {refInfo ? (
            <AppText variant="small" color={t.textMuted}>
              Atualizado. Fonte: {refInfo}
            </AppText>
          ) : null}
          {refError ? (
            <AppText variant="small" color={t.danger}>
              {refError}
            </AppText>
          ) : null}
        </Section>

        <Section title="Seu tempo">
          <NumberField
            label="Quanto vale 1 hora sua"
            value={s.valueOfTimePerHour}
            min={0}
            max={2000}
            prefix="R$"
            suffix="/h"
            help="Valores altos favorecem a opção mais rápida; baixos, a mais barata. Caminhada, espera e lotação pesam mais que o tempo sentado."
            onCommit={(valueOfTimePerHour) => update({ valueOfTimePerHour })}
          />
          <AppText variant="small" color={t.textMuted}>
            Com o valor atual, economizar 10 minutos equivale a {brl((s.valueOfTimePerHour / 60) * 10)}.
          </AppText>
        </Section>

        <Section title="De onde vêm os dados">
          <AppText variant="body" color={t.textMuted}>
            Tudo gratuito e aberto. Trânsito ao vivo: TomTom. Rotas sem trânsito ao vivo: OSRM. Transporte público:
            Transitous, com horários oficiais publicados pelas operadoras. Endereços: Photon. Mapas: OpenFreeMap.
            Combustível: levantamento semanal da ANP. Lotação e ocorrências: usuários do app.
          </AppText>
          <Link label="Fontes de dados do Transitous" url="https://transitous.org/sources/" />
          <Link label="© Colaboradores do OpenStreetMap" url="https://www.openstreetmap.org/copyright" />
          <Link label="OpenFreeMap" url="https://openfreemap.org/" />
        </Section>

        <Button
          variant="ghost"
          icon="refresh"
          label="Restaurar valores padrão"
          onPress={() => {
            s.reset();
            setRefInfo(null);
          }}
        />
      </ScrollView>
    </View>
  );
}

function Link({ label, url }: { label: string; url: string }) {
  const t = useTheme();
  return (
    <AppText
      variant="bodyStrong"
      color={t.transitText}
      accessibilityRole="link"
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={{ textDecorationLine: 'underline' }}
    >
      {label}
    </AppText>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingTop: space.xl, gap: space.xxl, paddingBottom: space.xxl * 2 },
  section: { gap: space.lg },
  ufRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  uf: {
    width: 72,
    textAlign: 'center',
    borderWidth: 1.5,
    borderRadius: radius.piece,
    paddingVertical: 10,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
});
