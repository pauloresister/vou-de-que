import type { WebSocket } from 'ws';
import type { Alert } from '../types.js';

export type HubEvent =
  | { type: 'alert.created'; alert: Alert }
  | { type: 'alert.updated'; alert: Alert }
  | { type: 'alert.expired'; ids: string[] };

/** Distribui alertas em tempo real para todos os aparelhos conectados via WebSocket. */
export class AlertHub {
  private clients = new Set<WebSocket>();
  private heartbeat: NodeJS.Timeout;

  constructor() {
    // Ping periódico mantém a conexão viva atrás de proxies que encerram sockets ociosos.
    this.heartbeat = setInterval(() => {
      for (const ws of this.clients) {
        if (ws.readyState === ws.OPEN) ws.ping();
      }
    }, 25_000);
    this.heartbeat.unref();
  }

  add(ws: WebSocket) {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
    ws.on('error', () => this.clients.delete(ws));
  }

  broadcast(event: HubEvent) {
    const payload = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  get size() {
    return this.clients.size;
  }

  close() {
    clearInterval(this.heartbeat);
    for (const ws of this.clients) ws.close();
  }
}
