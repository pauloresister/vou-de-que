/** Configuração lida das variáveis de ambiente da Edge Function (definidas com `supabase secrets set`). */
const env = (k: string) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined)?.trim() ?? '';

export const config = {
  /** Chave gratuita do TomTom (2.500 rotas/dia, sem cartão). Sem ela, o app usa o modo estimado. */
  get tomtomKey() {
    return env('TOMTOM_API_KEY');
  },
  /** Photon, OSRM e Transitous pedem um User-Agent identificável, com contato. */
  get userAgent() {
    return env('APP_USER_AGENT') || 'VouDeQue/1.0 (app de codigo aberto; +https://github.com/seu-usuario/vou-de-que)';
  },
  get timezone() {
    return env('LOCAL_TIMEZONE') || 'America/Sao_Paulo';
  },
  get transitousBase() {
    return env('TRANSITOUS_BASE_URL') || 'https://api.transitous.org';
  },
  get supabaseUrl() {
    return env('SUPABASE_URL');
  },
  /** Só leitura de alertas: a chave pública basta, a de serviço é usada se existir. */
  get supabaseKey() {
    return env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_ANON_KEY');
  },
};

export const hasTomTom = () => config.tomtomKey.length > 0;
