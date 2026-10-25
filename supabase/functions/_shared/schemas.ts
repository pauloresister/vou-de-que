import { z } from 'npm:zod@4.1.12';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const compareSchema = z.object({
  origin: z.object({ lat, lng }),
  destination: z.object({ lat, lng }),
  vehicle: z.object({
    consumptionKmL: z.number().min(1).max(60),
    fuelPrice: z.number().min(0.5).max(30),
    parkingCost: z.number().min(0).max(500).default(0),
  }),
  fares: z.object({
    bus: z.number().min(0).max(100),
    rail: z.number().min(0).max(100),
    integrated: z.number().min(0).max(200),
  }),
  valueOfTimePerHour: z.number().min(0).max(2000).default(25),
});

export const searchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const pointQuerySchema = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}
