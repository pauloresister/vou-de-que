// Ponto de entrada da Edge Function "api" do Vou de Quê? (Supabase, plano gratuito sem cartão).
import { handle } from '../_shared/handler.ts';

Deno.serve(handle);
