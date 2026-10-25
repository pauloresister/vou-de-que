import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export type LocationState = 'idle' | 'locating' | 'denied' | 'error';

/** Pede permissão só quando o usuário toca em "usar minha localização" (nunca na abertura do app). */
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>('idle');

  const locate = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    setState('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState('denied');
        return null;
      }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 });
      const pos =
        last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setState('idle');
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      setState('error');
      return null;
    }
  }, []);

  return { locate, state };
}
