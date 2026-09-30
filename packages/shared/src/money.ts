import { z } from 'zod';

/** Valores monetários sempre em centavos inteiros. */
export const centsSchema = z.number().int().nonnegative();
export type Cents = z.infer<typeof centsSchema>;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}
