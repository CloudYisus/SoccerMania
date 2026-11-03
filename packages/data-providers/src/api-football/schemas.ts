import { z } from 'zod';

/** Envoltorio común de todas las respuestas de API-Football v3. */
export const envelopeSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    get: z.string().optional(),
    parameters: z.unknown().optional(),
    // La API devuelve [] cuando no hay errores, u objeto {campo: mensaje} cuando los hay.
    errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
    results: z.number().optional(),
    paging: z.object({ current: z.number(), total: z.number() }).optional(),
    response: z.array(item),
  });

export const countrySchema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  flag: z.string().nullable(),
});
export type ApiFootballCountry = z.infer<typeof countrySchema>;

export const teamItemSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    founded: z.number().nullable().optional(),
    national: z.boolean().optional(),
    logo: z.string().nullable().optional(),
  }),
  venue: z
    .object({
      id: z.number().nullable().optional(),
      name: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
    })
    .partial()
    .optional(),
});
export type ApiFootballTeamItem = z.infer<typeof teamItemSchema>;
