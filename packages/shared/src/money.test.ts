import { describe, expect, it } from 'vitest';
import { formatBRL } from './money.js';

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(4550).replace(/\s/g, ' ')).toBe('R$ 45,50');
  });
});
