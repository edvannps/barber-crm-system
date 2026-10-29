import { describe, expect, it } from 'vitest';
import {
  invitationResponseSchema,
  inviteMemberSchema,
  membershipResponseSchema,
  updateMembershipSchema,
} from './memberships.js';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';

describe('inviteMemberSchema', () => {
  it('aceita convite com ao menos uma unidade', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'Novo@Membro.com',
      role: 'RECEPTION',
      unitIds: [UNIT_ID],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('novo@membro.com');
    }
  });

  it('rejeita convite sem nenhuma unidade', () => {
    expect(
      inviteMemberSchema.safeParse({ email: 'a@b.com', role: 'RECEPTION', unitIds: [] }).success,
    ).toBe(false);
  });

  it('rejeita role fora de MEMBERSHIP_ROLES', () => {
    expect(
      inviteMemberSchema.safeParse({ email: 'a@b.com', role: 'ADMIN', unitIds: [UNIT_ID] }).success,
    ).toBe(false);
  });
});

describe('updateMembershipSchema', () => {
  it('rejeita payload vazio (nada para atualizar)', () => {
    expect(updateMembershipSchema.safeParse({}).success).toBe(false);
  });

  it('aceita apenas role', () => {
    expect(updateMembershipSchema.safeParse({ role: 'MANAGER' }).success).toBe(true);
  });

  it('aceita apenas unitIds', () => {
    expect(updateMembershipSchema.safeParse({ unitIds: [UNIT_ID] }).success).toBe(true);
  });

  it('rejeita unitIds vazio quando informado', () => {
    expect(updateMembershipSchema.safeParse({ unitIds: [] }).success).toBe(false);
  });
});

describe('membershipResponseSchema', () => {
  it('aceita payload de resposta completo', () => {
    const result = membershipResponseSchema.safeParse({
      id: UNIT_ID,
      userId: UNIT_ID,
      name: 'Edvan Sabino',
      email: 'edvan@example.com',
      role: 'OWNER',
      unitIds: [UNIT_ID],
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejeita createdAt que não é datetime ISO', () => {
    const result = membershipResponseSchema.safeParse({
      id: UNIT_ID,
      userId: UNIT_ID,
      name: 'Edvan Sabino',
      email: 'edvan@example.com',
      role: 'OWNER',
      unitIds: [UNIT_ID],
      isActive: true,
      createdAt: '28/10/2026',
    });
    expect(result.success).toBe(false);
  });
});

describe('invitationResponseSchema', () => {
  it('aceita status dentro de INVITATION_STATUSES', () => {
    const result = invitationResponseSchema.safeParse({
      id: UNIT_ID,
      email: 'convidado@example.com',
      role: 'PROFESSIONAL',
      unitIds: [UNIT_ID],
      status: 'PENDING',
      expiresAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejeita status fora de INVITATION_STATUSES', () => {
    const result = invitationResponseSchema.safeParse({
      id: UNIT_ID,
      email: 'convidado@example.com',
      role: 'PROFESSIONAL',
      unitIds: [UNIT_ID],
      status: 'REVOKED',
      expiresAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
