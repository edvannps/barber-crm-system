import { describe, expect, it } from 'vitest';
import {
  acceptInvitationSchema,
  authTokensResponseSchema,
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
  selectTenantSchema,
  signupSchema,
  tenantSelectionRequiredResponseSchema,
} from './auth.js';

describe('emailSchema', () => {
  it('normaliza espaços e caixa alta para lowercase (CHECK email = lower(email) do banco)', () => {
    expect(emailSchema.parse('  Owner@Example.COM  ')).toBe('owner@example.com');
  });

  it('rejeita e-mail inválido', () => {
    expect(emailSchema.safeParse('não-é-email').success).toBe(false);
  });

  it('rejeita e-mail acima de 254 caracteres', () => {
    const tooLong = `${'a'.repeat(250)}@a.co`;
    expect(emailSchema.safeParse(tooLong).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('aceita senha com 8 a 72 caracteres', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
  });

  it('rejeita senha menor que 8 caracteres', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
  });

  it('rejeita senha maior que 72 caracteres (limite prático do argon2id)', () => {
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
  });
});

describe('signupSchema', () => {
  const valid = {
    name: 'Edvan Sabino',
    email: 'Edvan@Example.com',
    password: 'segredo123',
    businessName: 'Barbearia do Edvan',
  };

  it('aceita payload válido e normaliza o e-mail', () => {
    const result = signupSchema.parse(valid);
    expect(result.email).toBe('edvan@example.com');
  });

  it('rejeita nome com menos de 2 caracteres', () => {
    expect(signupSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
  });

  it('rejeita businessName ausente', () => {
    const withoutBusinessName: Record<string, unknown> = { ...valid };
    delete withoutBusinessName.businessName;
    expect(signupSchema.safeParse(withoutBusinessName).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('aceita senha de qualquer tamanho não vazio (não força política de criação)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(true);
  });

  it('rejeita senha vazia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('selectTenantSchema', () => {
  it('rejeita tenantId que não é uuid', () => {
    expect(
      selectTenantSchema.safeParse({ selectTenantToken: 'tok', tenantId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('aceita payload válido', () => {
    expect(
      selectTenantSchema.safeParse({
        selectTenantToken: 'tok',
        tenantId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('rejeita newPassword fraca mesmo com currentPassword válida', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'atual123', newPassword: '123' }).success,
    ).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('normaliza o e-mail', () => {
    expect(forgotPasswordSchema.parse({ email: 'A@B.COM' }).email).toBe('a@b.com');
  });
});

describe('resetPasswordSchema', () => {
  it('rejeita token vazio', () => {
    expect(resetPasswordSchema.safeParse({ token: '', newPassword: '12345678' }).success).toBe(
      false,
    );
  });
});

describe('acceptInvitationSchema', () => {
  it('aceita payload vazio (convidado já tem User)', () => {
    expect(acceptInvitationSchema.safeParse({}).success).toBe(true);
  });

  it('aceita name + password quando convidado é novo', () => {
    expect(
      acceptInvitationSchema.safeParse({ name: 'Novo Membro', password: '12345678' }).success,
    ).toBe(true);
  });

  it('rejeita password fraca quando informada', () => {
    expect(acceptInvitationSchema.safeParse({ name: 'Novo Membro', password: '123' }).success).toBe(
      false,
    );
  });
});

describe('authTokensResponseSchema', () => {
  it('não aceita refreshToken no corpo (campo não existe no contrato)', () => {
    const result = authTokensResponseSchema.safeParse({
      accessToken: 'jwt',
      refreshToken: 'nope',
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      role: 'OWNER',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('refreshToken');
    }
  });

  it('rejeita role fora de MEMBERSHIP_ROLES', () => {
    const result = authTokensResponseSchema.safeParse({
      accessToken: 'jwt',
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
  });
});

describe('tenantSelectionRequiredResponseSchema', () => {
  it('aceita lista de tenants candidatos', () => {
    const result = tenantSelectionRequiredResponseSchema.safeParse({
      selectTenantToken: 'tok',
      tenants: [
        {
          tenantId: '11111111-1111-4111-8111-111111111111',
          tenantName: 'Barbearia A',
          role: 'OWNER',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
