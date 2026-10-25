export class ApiError extends Error {}

export const NOT_CONFIGURED =
  'O app foi compilado sem o endereço do servidor. Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY e gere o APK de novo.';

/** Converte falhas de rede em mensagens claras; mensagens do banco já chegam em português. */
export function friendlyError(message: string | undefined): string {
  const m = message ?? '';
  if (/network|fetch|timeout|aborted|connect/i.test(m)) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  if (/paused|project.*inactive/i.test(m)) {
    return 'O servidor gratuito está pausado por inatividade. Reative o projeto no painel do Supabase.';
  }
  return m || 'Erro inesperado no servidor.';
}
