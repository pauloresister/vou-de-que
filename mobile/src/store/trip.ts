import { create } from 'zustand';
import type { CompareResult, Place } from '@/lib/types';

export interface TripPoint extends Place {
  isCurrentLocation?: boolean;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

interface TripStore {
  origin: TripPoint | null;
  destination: TripPoint | null;
  result: CompareResult | null;
  status: Status;
  error: string | null;
  setOrigin: (p: TripPoint | null) => void;
  setDestination: (p: TripPoint | null) => void;
  swap: () => void;
  setResult: (r: CompareResult) => void;
  setStatus: (s: Status, error?: string | null) => void;
}

export const useTrip = create<TripStore>((set) => ({
  origin: null,
  destination: null,
  result: null,
  status: 'idle',
  error: null,
  setOrigin: (origin) => set({ origin, result: null, status: 'idle' }),
  setDestination: (destination) => set({ destination, result: null, status: 'idle' }),
  swap: () => set((s) => ({ origin: s.destination, destination: s.origin, result: null, status: 'idle' })),
  setResult: (result) => set({ result, status: 'done', error: null }),
  setStatus: (status, error = null) => set({ status, error }),
}));
