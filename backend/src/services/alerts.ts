import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { boundingBox, haversineM } from '../lib/geo.js';
import { lineKey } from '../lib/format.js';
import type { Alert, AlertKind, CrowdLevel, IncidentType, LatLng } from '../types.js';

/** Quanto tempo cada tipo de alerta continua válido. Lotação muda rápido; ocorrência dura mais. */
export const TTL_MIN = { lotacao: 30, ocorrencia: 60 } as const;
const CONFIRM_EXTENSION_MIN = 10;
const DUPLICATE_WINDOW_MIN = 5;

export interface NewAlert {
  kind: AlertKind;
  crowdLevel?: CrowdLevel;
  incidentType?: IncidentType;
  line?: string;
  lat: number;
  lng: number;
  note?: string;
  deviceId: string;
}

interface Row {
  id: string;
  kind: AlertKind;
  crowd_level: CrowdLevel | null;
  incident_type: IncidentType | null;
  line: string | null;
  line_key: string | null;
  lat: number;
  lng: number;
  note: string | null;
  device_id: string;
  created_at: number;
  expires_at: number;
  confirmations: number;
}

export class AlertError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const toAlert = (r: Row): Alert => ({
  id: r.id,
  kind: r.kind,
  crowdLevel: r.crowd_level ?? undefined,
  incidentType: r.incident_type ?? undefined,
  line: r.line ?? undefined,
  lat: r.lat,
  lng: r.lng,
  note: r.note ?? undefined,
  createdAt: new Date(r.created_at).toISOString(),
  expiresAt: new Date(r.expires_at).toISOString(),
  confirmations: r.confirmations,
});

export class AlertStore {
  private db: Database.Database;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        crowd_level TEXT,
        incident_type TEXT,
        line TEXT,
        line_key TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        note TEXT,
        device_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        confirmations INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_expires ON alerts(expires_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_line ON alerts(line_key);
      CREATE INDEX IF NOT EXISTS idx_alerts_geo ON alerts(lat, lng);
      CREATE TABLE IF NOT EXISTS confirmations (
        alert_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        PRIMARY KEY (alert_id, device_id)
      );
    `);
  }

  create(input: NewAlert, now = Date.now()): Alert {
    const key = lineKey(input.line);
    const duplicate = this.db
      .prepare(
        `SELECT id FROM alerts WHERE device_id = ? AND kind = ? AND COALESCE(line_key,'') = ?
         AND created_at > ? AND expires_at > ? LIMIT 1`,
      )
      .get(input.deviceId, input.kind, key, now - DUPLICATE_WINDOW_MIN * 60_000, now);
    if (duplicate) {
      throw new AlertError(429, 'Você já enviou um alerta parecido há poucos minutos. Obrigado!');
    }
    const row: Row = {
      id: randomUUID(),
      kind: input.kind,
      crowd_level: input.kind === 'lotacao' ? (input.crowdLevel ?? null) : null,
      incident_type: input.kind === 'ocorrencia' ? (input.incidentType ?? null) : null,
      line: input.line?.trim() || null,
      line_key: key || null,
      lat: input.lat,
      lng: input.lng,
      note: input.note?.trim() || null,
      device_id: input.deviceId,
      created_at: now,
      expires_at: now + TTL_MIN[input.kind] * 60_000,
      confirmations: 0,
    };
    this.db
      .prepare(
        `INSERT INTO alerts VALUES (@id,@kind,@crowd_level,@incident_type,@line,@line_key,@lat,@lng,@note,
         @device_id,@created_at,@expires_at,@confirmations)`,
      )
      .run(row);
    return toAlert(row);
  }

  /** "Ainda está assim": confirma o alerta e prolonga sua validade. Um voto por aparelho. */
  confirm(id: string, deviceId: string, now = Date.now()): Alert {
    const row = this.db.prepare('SELECT * FROM alerts WHERE id = ? AND expires_at > ?').get(id, now) as Row | undefined;
    if (!row) throw new AlertError(404, 'Este alerta já expirou.');
    if (row.device_id === deviceId) throw new AlertError(409, 'Você criou este alerta.');
    const inserted = this.db
      .prepare('INSERT OR IGNORE INTO confirmations (alert_id, device_id) VALUES (?, ?)')
      .run(id, deviceId);
    if (inserted.changes === 0) throw new AlertError(409, 'Você já confirmou este alerta.');
    const maxExpiry = now + TTL_MIN[row.kind] * 60_000;
    const newExpiry = Math.min(maxExpiry, row.expires_at + CONFIRM_EXTENSION_MIN * 60_000);
    this.db
      .prepare('UPDATE alerts SET confirmations = confirmations + 1, expires_at = ? WHERE id = ?')
      .run(newExpiry, id);
    return toAlert({ ...row, confirmations: row.confirmations + 1, expires_at: newExpiry });
  }

  listNear(center: LatLng, radiusKm: number, now = Date.now()): Alert[] {
    const box = boundingBox(center, radiusKm);
    const rows = this.db
      .prepare(
        `SELECT * FROM alerts WHERE expires_at > ? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
         ORDER BY created_at DESC LIMIT 200`,
      )
      .all(now, box.minLat, box.maxLat, box.minLng, box.maxLng) as Row[];
    return rows.filter((r) => haversineM(center, r) <= radiusKm * 1000).map(toAlert);
  }

  /** Alertas ativos com linha informada (para cruzar com as linhas da rota sugerida). */
  listWithLines(now = Date.now()): Array<Alert & { lineKey: string }> {
    const rows = this.db
      .prepare('SELECT * FROM alerts WHERE expires_at > ? AND line_key IS NOT NULL ORDER BY created_at DESC LIMIT 500')
      .all(now) as Row[];
    return rows.map((r) => ({ ...toAlert(r), lineKey: r.line_key ?? '' }));
  }

  /** Ocorrências de via ativas numa caixa (para cruzar com a rota de carro). */
  listIncidentsInBox(box: ReturnType<typeof boundingBox>, now = Date.now()): Alert[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM alerts WHERE expires_at > ? AND kind = 'ocorrencia'
         AND incident_type IN ('transito_parado','acidente')
         AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? LIMIT 300`,
      )
      .all(now, box.minLat, box.maxLat, box.minLng, box.maxLng) as Row[];
    return rows.map(toAlert);
  }

  /** Remove expirados e devolve os ids removidos (para avisar os clientes conectados). */
  purgeExpired(now = Date.now()): string[] {
    const ids = (this.db.prepare('SELECT id FROM alerts WHERE expires_at <= ?').all(now) as { id: string }[]).map(
      (r) => r.id,
    );
    if (ids.length) {
      this.db.prepare('DELETE FROM alerts WHERE expires_at <= ?').run(now);
      this.db.prepare('DELETE FROM confirmations WHERE alert_id NOT IN (SELECT id FROM alerts)').run();
    }
    return ids;
  }

  close() {
    this.db.close();
  }
}
