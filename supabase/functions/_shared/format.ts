/** Formata valores em Reais sem depender de Intl (mesma saída no servidor e no celular). */
export function brl(value: number): string {
  const [int, dec] = Math.abs(value).toFixed(2).split('.');
  return `${value < 0 ? '-' : ''}R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Normaliza o nome de uma linha para comparação: "Linha 8700-10" -> "870010".
 * A mesma regra existe no banco (função public.line_key) para os alertas.
 */
export function lineKey(raw: string | undefined | null): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^LINHA\s*/, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Mesma linha se as chaves coincidem ou uma contém a outra (mínimo 3 caracteres). */
export function sameLine(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.includes(short);
}
