import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FuelType = 'gasolina' | 'etanol' | 'diesel';

export interface Settings {
  fuelType: FuelType;
  consumptionKmL: number;
  fuelPrices: Record<FuelType, number>;
  parkingCost: number;
  fares: { bus: number; rail: number; integrated: number };
  /** Quanto vale 1 hora do seu tempo, em R$. Pesa tempo contra dinheiro na recomendação. */
  valueOfTimePerHour: number;
  uf: string;
  deviceId: string;
}

interface SettingsStore extends Settings {
  hydrated: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const newDeviceId = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/** Valores iniciais: ANP semana 11–17/10/2026 (SP para etanol) e tarifas de SP vigentes em 2026. */
export const DEFAULT_SETTINGS: Omit<Settings, 'deviceId'> = {
  fuelType: 'gasolina',
  consumptionKmL: 11,
  fuelPrices: { gasolina: 6.53, etanol: 3.86, diesel: 7.0 },
  parkingCost: 0,
  fares: { bus: 5.3, rail: 5.4, integrated: 9.38 },
  valueOfTimePerHour: 25,
  uf: 'SP',
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      deviceId: newDeviceId(),
      hydrated: false,
      update: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'vou-de-que/ajustes',
      version: 2,
      // Versão 1 tinha o campo apiUrl (servidor próprio); ele é descartado na migração.
      migrate: (state) => {
        const { apiUrl: _old, ...rest } = (state ?? {}) as Record<string, unknown>;
        return rest as unknown as SettingsStore;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, update, reset, ...rest }) => rest,
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    },
  ),
);
