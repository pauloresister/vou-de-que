import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError, NOT_CONFIGURED } from './errors';

/** Endereço e chave pública do projeto Supabase, embutidos no momento do build. */
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
export const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
export const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

let client: SupabaseClient | null = null;

/** Cliente único, sem login: o app só lê alertas e chama funções públicas validadas no banco. */
export function supabase(): SupabaseClient {
  if (!isConfigured) throw new ApiError(NOT_CONFIGURED);
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

/** Cabeçalhos para a Edge Function: chaves novas (sb_...) vão só em apikey; as legadas (JWT) também em Authorization. */
export function functionHeaders(): Record<string, string> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY };
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  return headers;
}
