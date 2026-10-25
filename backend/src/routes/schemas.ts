import { z } from 'zod';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
export const pointSchema = z.object({ lat, lng });

export const compareSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
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

export const newAlertSchema = z
  .object({
    kind: z.enum(['lotacao', 'ocorrencia']),
    crowdLevel: z.enum(['vazio', 'moderado', 'lotado']).optional(),
    incidentType: z.enum(['transito_parado', 'acidente', 'atraso_linha']).optional(),
    line: z.string().trim().max(40).optional(),
    lat,
    lng,
    note: z.string().trim().max(140).optional(),
    deviceId: z.string().min(8).max(64),
  })
  .superRefine((a, ctx) => {
    if (a.kind === 'lotacao' && !a.crowdLevel) {
      ctx.addIssue({ code: 'custom', message: 'Informe o nível de lotação.', path: ['crowdLevel'] });
    }
    if (a.kind === 'lotacao' && !a.line) {
      ctx.addIssue({ code: 'custom', message: 'Informe a linha do ônibus ou trem.', path: ['line'] });
    }
    if (a.kind === 'ocorrencia' && !a.incidentType) {
      ctx.addIssue({ code: 'custom', message: 'Informe o tipo de ocorrência.', path: ['incidentType'] });
    }
    if (a.incidentType === 'atraso_linha' && !a.line) {
      ctx.addIssue({ code: 'custom', message: 'Informe qual linha está atrasada.', path: ['line'] });
    }
  });

export const nearQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(50).default(10),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/** Primeira mensagem de erro legível para mostrar no app. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}
