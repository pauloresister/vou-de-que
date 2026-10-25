import { config } from './config.ts';

export class UpstreamError extends Error {
  constructor(
    public readonly service: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** GET JSON com tempo limite e User-Agent identificável. Nenhuma API externa trava a resposta. */
export async function getJson<T>(url: string, service: string, timeoutMs = 8000, headers: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': config.userAgent, Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new UpstreamError(service, res.status, `${service} respondeu HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    const reason = (err as Error).name === 'AbortError' ? 'tempo esgotado' : (err as Error).message;
    throw new UpstreamError(service, 0, `${service} indisponível (${reason})`);
  } finally {
    clearTimeout(timer);
  }
}

/** Cache simples em memória com expiração (vive enquanto a instância da função estiver ativa). */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  constructor(
    private ttlMs: number,
    private maxEntries = 500,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}
