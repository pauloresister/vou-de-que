import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type AlertRow, api, rowToAlert } from '@/lib/api';
import { NOT_CONFIGURED } from '@/lib/errors';
import { haversineM } from '@/lib/format';
import { isConfigured, supabase } from '@/lib/supabase';
import type { Alert } from '@/lib/types';

type Live = 'connecting' | 'live' | 'offline';

/**
 * Alertas perto do usuário: carga inicial pelo banco e atualizações pelo Realtime do Supabase.
 * O cliente do Supabase reconecta sozinho; o app pausa a assinatura em segundo plano.
 */
export function useLiveAlerts(center: { lat: number; lng: number } | null, radiusKm = 10) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [live, setLive] = useState<Live>('connecting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(isConfigured ? null : NOT_CONFIGURED);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const centerRef = useRef(center);
  centerRef.current = center;

  const isNear = useCallback(
    (a: Alert) => !centerRef.current || haversineM(centerRef.current, a) <= radiusKm * 1000,
    [radiusKm],
  );

  const refresh = useCallback(async () => {
    if (!centerRef.current || !isConfigured) return;
    setLoading(true);
    try {
      const { alerts: list } = await api.alertsNear(centerRef.current.lat, centerRef.current.lng, radiusKm);
      setAlerts(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [radiusKm]);

  const onChange = useCallback(
    (payload: RealtimePostgresChangesPayload<AlertRow>) => {
      if (payload.eventType === 'INSERT') {
        const alert = rowToAlert(payload.new);
        if (isNear(alert)) setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
      } else if (payload.eventType === 'UPDATE') {
        const alert = rowToAlert(payload.new);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
      } else if (payload.eventType === 'DELETE') {
        const id = (payload.old as Partial<AlertRow>).id;
        if (id) setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    },
    [isNear],
  );

  const subscribe = useCallback(() => {
    if (!isConfigured) {
      setLive('offline');
      return;
    }
    const client = supabase();
    if (channelRef.current) client.removeChannel(channelRef.current);
    setLive('connecting');
    channelRef.current = client
      .channel('alertas-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, onChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLive('offline');
      });
  }, [onChange]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current && isConfigured) supabase().removeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  useEffect(() => {
    subscribe();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        subscribe();
        refresh();
      } else {
        unsubscribe();
      }
    });
    return () => {
      sub.remove();
      unsubscribe();
    };
  }, [subscribe, unsubscribe, refresh]);

  const centerKey = center ? `${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : '';
  useEffect(() => {
    refresh();
  }, [centerKey, refresh]);

  // Remove localmente os que venceram, mesmo sem aviso do servidor.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setAlerts((prev) => prev.filter((a) => Date.parse(a.expiresAt) > now));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const replace = useCallback((alert: Alert) => {
    setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
  }, []);

  return { alerts, live, loading, error, refresh, replace };
}
