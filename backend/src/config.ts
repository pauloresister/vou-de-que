import 'dotenv/config';

/** Configuração central lida do ambiente (.env em desenvolvimento, variáveis no servidor em produção). */
export const config = {
  port: Number(process.env.PORT ?? 3333),
  host: process.env.HOST ?? '0.0.0.0',
  /** Chave gratuita do HERE Developer Portal. Sem ela, o app continua funcionando em modo estimado. */
  hereApiKey: (process.env.HERE_API_KEY ?? '').trim(),
  dbPath: process.env.DB_PATH ?? './data/alertas.db',
  /** Photon e OSRM pedem um User-Agent identificável com contato. */
  userAgent: process.env.USER_AGENT ?? 'VouDeQue/1.0 (+https://github.com/seu-usuario/vou-de-que)',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  timezone: process.env.LOCAL_TIMEZONE ?? 'America/Sao_Paulo',
  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;

export const hasHere = () => config.hereApiKey.length > 0;
