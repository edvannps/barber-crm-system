import { z } from 'zod';

const weekdayHoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6), // 0 = domingo, igual Postgres EXTRACT(DOW)
    closed: z.boolean(),
    opensAt: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(), // "09:00"
    closesAt: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  })
  .refine((v) => v.closed || (v.opensAt && v.closesAt), 'Informe horário ou marque como fechado');
export type WeekdayHours = z.infer<typeof weekdayHoursSchema>;

export const createUnitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().min(1).max(64), // validado como IANA tz no backend (Intl.supportedValuesOf)
  address: z
    .object({
      street: z.string().trim().min(1).max(200),
      number: z.string().trim().min(1).max(20),
      complement: z.string().trim().max(100).optional(),
      neighborhood: z.string().trim().min(1).max(100),
      city: z.string().trim().min(1).max(100),
      // UF em maiúsculas: alinhado ao CHECK "state" ~ '^[A-Z]{2}$' da migration
      // (apps/api/prisma/migrations/20261028231712_init_auth_tenants_memberships/migration.sql) —
      // o plano só pedia `z.string().length(2)`; a borda Zod passa a rejeitar o que o banco rejeitaria.
      state: z
        .string()
        .trim()
        .regex(/^[A-Z]{2}$/, 'UF deve ter 2 letras maiúsculas (ex.: SP)'),
      zipCode: z.string().regex(/^\d{5}-?\d{3}$/),
    })
    .optional(), // opcional no payload da Unit do signup (preenchida depois); obrigatório na UI de gestão
  cnpj: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  businessHours: z.array(weekdayHoursSchema).length(7),
});
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = createUnitSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const unitResponseSchema = createUnitSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  isActive: z.boolean(),
});
export type UnitResponse = z.infer<typeof unitResponseSchema>;
