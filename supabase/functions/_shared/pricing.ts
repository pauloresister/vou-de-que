/**
 * Tabela de referência de preços (dados abertos da ANP e tarifas oficiais).
 * A ANP publica o levantamento semanal em planilhas, sem API REST; atualize aqui e rode o deploy
 * (o app não precisa de nova versão). O usuário sempre pode sobrescrever os valores nos Ajustes.
 */
interface FuelTable {
  gasolina: number;
  etanol: number;
  diesel: number;
}
interface FareTable {
  referencia: string;
  onibus: number;
  trilhos: number;
  integracao: number;
}

export const REFERENCE = {
  combustivel: {
    referencia: 'ANP, Levantamento de Preços de Combustíveis, semana de 11 a 17/10/2026',
    atualizadoEm: '2026-10-17',
    nacional: { gasolina: 6.53, etanol: 4.11, diesel: 7.0 } as FuelTable,
    porUF: { SP: { etanol: 3.86 } } as Record<string, Partial<FuelTable>>,
  },
  tarifas: {
    padrao: {
      referencia: 'SPTrans e Governo de SP, valores vigentes desde 06/01/2026',
      onibus: 5.3,
      trilhos: 5.4,
      integracao: 9.38,
    } as FareTable,
    porUF: {} as Record<string, Partial<FareTable>>,
  },
};

export function referencePrices(uf?: string) {
  const key = (uf ?? '').toUpperCase();
  const fuel = { ...REFERENCE.combustivel.nacional, ...(REFERENCE.combustivel.porUF[key] ?? {}) };
  const fares = { ...REFERENCE.tarifas.padrao, ...(REFERENCE.tarifas.porUF[key] ?? {}) };
  return {
    uf: key || 'BR',
    fuel,
    fuelReference: REFERENCE.combustivel.referencia,
    fuelUpdatedAt: REFERENCE.combustivel.atualizadoEm,
    fares: { bus: fares.onibus, rail: fares.trilhos, integrated: fares.integracao },
    faresReference: fares.referencia,
  };
}
