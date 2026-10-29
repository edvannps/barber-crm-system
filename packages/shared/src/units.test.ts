import { describe, expect, it } from 'vitest';
import { createUnitSchema, unitResponseSchema, updateUnitSchema } from './units.js';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

function businessHours(
  overrides?: Partial<Record<number, { closed: boolean; opensAt?: string; closesAt?: string }>>,
) {
  return Array.from({ length: 7 }, (_, weekday) => {
    const override = overrides?.[weekday];
    if (override) {
      return { weekday, ...override };
    }
    return { weekday, closed: false, opensAt: '09:00', closesAt: '18:00' };
  });
}

const validAddress = {
  street: 'Rua das Flores',
  number: '123',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01310-100',
};

describe('createUnitSchema', () => {
  it('aceita payload válido com 7 dias de businessHours', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      address: validAddress,
      cnpj: '12345678000199',
      businessHours: businessHours(),
    });
    expect(result.success).toBe(true);
  });

  it('aceita payload sem address (opcional no signup)', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      businessHours: businessHours(),
    });
    expect(result.success).toBe(true);
  });

  it('rejeita businessHours com menos de 7 posições', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      businessHours: businessHours().slice(0, 6),
    });
    expect(result.success).toBe(false);
  });

  it('rejeita dia aberto sem opensAt/closesAt', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      businessHours: businessHours({ 0: { closed: false } }),
    });
    expect(result.success).toBe(false);
  });

  it('aceita dia fechado sem horário', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      businessHours: businessHours({ 0: { closed: true } }),
    });
    expect(result.success).toBe(true);
  });

  it('rejeita cnpj com tamanho diferente de 14 dígitos', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      cnpj: '123',
      businessHours: businessHours(),
    });
    expect(result.success).toBe(false);
  });

  it('rejeita UF em minúsculas (alinhado ao CHECK "state" ~ \'^[A-Z]{2}$\' do banco)', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      address: { ...validAddress, state: 'sp' },
      businessHours: businessHours(),
    });
    expect(result.success).toBe(false);
  });

  it('rejeita zipCode fora do padrão 00000-000', () => {
    const result = createUnitSchema.safeParse({
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      address: { ...validAddress, zipCode: '123' },
      businessHours: businessHours(),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUnitSchema', () => {
  it('aceita payload parcial só com isActive', () => {
    expect(updateUnitSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('aceita payload vazio (partial)', () => {
    expect(updateUnitSchema.safeParse({}).success).toBe(true);
  });

  it('ainda valida formato quando o campo é enviado', () => {
    expect(updateUnitSchema.safeParse({ cnpj: 'abc' }).success).toBe(false);
  });
});

describe('unitResponseSchema', () => {
  it('aceita payload de resposta completo', () => {
    const result = unitResponseSchema.safeParse({
      id: UNIT_ID,
      tenantId: TENANT_ID,
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      businessHours: businessHours(),
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita payload sem id', () => {
    const result = unitResponseSchema.safeParse({
      tenantId: TENANT_ID,
      name: 'Unidade Centro',
      timezone: 'America/Sao_Paulo',
      businessHours: businessHours(),
      isActive: true,
    });
    expect(result.success).toBe(false);
  });
});
