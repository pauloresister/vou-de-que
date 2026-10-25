import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Tabela de referência de preços.
 * A ANP publica o levantamento semanal em planilhas (dados abertos), sem API REST estável;
 * por isso o backend serve uma tabela versionada que pode ser atualizada sem publicar o app.
 * O usuário sempre pode sobrescrever os valores nos Ajustes.
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
interface ReferenceFile {
  combustivel: {
    referencia: string;
    atualizadoEm: string;
    nacional: FuelTable;
    porUF: Record<string, Partial<FuelTable>>;
  };
  tarifas: { padrao: FareTable; porUF: Record<string, Partial<FareTable>> };
}

const here = dirname(fileURLToPath(import.meta.url));
const table: ReferenceFile = JSON.parse(readFileSync(join(here, '..', 'data', 'reference-prices.json'), 'utf8'));

export function referencePrices(uf?: string) {
  const key = (uf ?? '').toUpperCase();
  const fuel = { ...table.combustivel.nacional, ...(table.combustivel.porUF[key] ?? {}) };
  const fares = { ...table.tarifas.padrao, ...(table.tarifas.porUF[key] ?? {}) };
  return {
    uf: key || 'BR',
    fuel,
    fuelReference: table.combustivel.referencia,
    fuelUpdatedAt: table.combustivel.atualizadoEm,
    fares: { bus: fares.onibus, rail: fares.trilhos, integrated: fares.integracao },
    faresReference: fares.referencia,
  };
}
