/**
 * Seed de desenvolvimento — dados fictícios (nunca dados reais; e-mails só no TLD reservado `.test`).
 *
 * Roda como o role dono das tabelas (o mesmo das migrations), que não é sujeito a RLS. Por isso NÃO usar o
 * usuário de conexão da API (membro de `barber_app`) para rodar o seed.
 *
 * Idempotente: ids fixos + upsert, pode rodar várias vezes (`pnpm --filter @barber/api db:seed`).
 * Senha de todos os usuários: SEED_PASSWORD (padrão "Barbearia@2026" — apenas dev).
 */
import { createHash } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';

import { PrismaClient } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile('../../.env');
} catch {
  // Em CI as variáveis vêm do ambiente.
}

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL não definida');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'Barbearia@2026';

// Ids fixos (formato UUID v7) para o seed ser idempotente e os testes manuais terem referências estáveis.
const ids = {
  tenantExemplo: '0192f000-0000-7000-8000-000000000001',
  tenantMoema: '0192f000-0000-7000-8000-000000000002',
  unitCentro: '0192f000-0000-7000-8000-000000000101',
  unitPinheiros: '0192f000-0000-7000-8000-000000000102',
  unitMoema: '0192f000-0000-7000-8000-000000000103',
  userRicardo: '0192f000-0000-7000-8000-000000000201',
  userJuliana: '0192f000-0000-7000-8000-000000000202',
  userCamila: '0192f000-0000-7000-8000-000000000203',
  userThiago: '0192f000-0000-7000-8000-000000000204',
  mRicardo: '0192f000-0000-7000-8000-000000000301',
  mJuliana: '0192f000-0000-7000-8000-000000000302',
  mCamila: '0192f000-0000-7000-8000-000000000303',
  mThiago: '0192f000-0000-7000-8000-000000000304',
  mJulianaMoema: '0192f000-0000-7000-8000-000000000305',
  invitePending: '0192f000-0000-7000-8000-000000000401',
} as const;

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo (Postgres EXTRACT(DOW))
type DayHours = { weekday: Weekday; closed: boolean; opensAt?: string; closesAt?: string };

function week(hours: Partial<Record<Weekday, [string, string]>>): DayHours[] {
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((weekday) => {
    const h = hours[weekday];
    return h
      ? { weekday, closed: false, opensAt: h[0], closesAt: h[1] }
      : { weekday, closed: true };
  });
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function main() {
  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  // --- Tenants --------------------------------------------------------------
  const tenants = [
    { id: ids.tenantExemplo, name: 'Barbearia Exemplo' },
    { id: ids.tenantMoema, name: 'Studio Exemplo Moema' },
  ];
  for (const t of tenants) {
    await prisma.tenant.upsert({ where: { id: t.id }, update: { name: t.name }, create: t });
  }

  // --- Units (horários diferentes) -----------------------------------------
  const units = [
    {
      id: ids.unitCentro,
      tenantId: ids.tenantExemplo,
      name: 'Unidade Centro',
      street: 'Rua Barão de Itapetininga',
      number: '120',
      complement: 'Loja 3',
      neighborhood: 'República',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01042-000',
      cnpj: '11222333000181',
      // Ter–Sex 09–20, Sáb 08–18; Dom e Seg fechada
      businessHours: week({
        2: ['09:00', '20:00'],
        3: ['09:00', '20:00'],
        4: ['09:00', '20:00'],
        5: ['09:00', '20:00'],
        6: ['08:00', '18:00'],
      }),
    },
    {
      id: ids.unitPinheiros,
      tenantId: ids.tenantExemplo,
      name: 'Unidade Pinheiros',
      street: 'Rua dos Pinheiros',
      number: '870',
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '05422-001',
      // Seg–Sex 10–21, Sáb 09–19, Dom 10–15
      businessHours: week({
        0: ['10:00', '15:00'],
        1: ['10:00', '21:00'],
        2: ['10:00', '21:00'],
        3: ['10:00', '21:00'],
        4: ['10:00', '21:00'],
        5: ['10:00', '21:00'],
        6: ['09:00', '19:00'],
      }),
    },
    {
      id: ids.unitMoema,
      tenantId: ids.tenantMoema,
      name: 'Unidade Moema',
      neighborhood: 'Moema',
      city: 'São Paulo',
      state: 'SP',
      businessHours: week({
        2: ['09:00', '19:00'],
        3: ['09:00', '19:00'],
        4: ['09:00', '19:00'],
        5: ['09:00', '19:00'],
        6: ['09:00', '17:00'],
      }),
    },
  ];
  for (const u of units) {
    const { id, ...data } = u;
    await prisma.unit.upsert({
      where: { id },
      update: data,
      create: { id, timezone: 'America/Sao_Paulo', ...data },
    });
  }

  // --- Users ---------------------------------------------------------------
  const users = [
    { id: ids.userRicardo, name: 'Ricardo Almeida', email: 'ricardo@barbearia-exemplo.test' },
    { id: ids.userJuliana, name: 'Juliana Santos', email: 'juliana@barbearia-exemplo.test' },
    { id: ids.userCamila, name: 'Camila Ferreira', email: 'camila@barbearia-exemplo.test' },
    { id: ids.userThiago, name: 'Thiago Oliveira', email: 'thiago@barbearia-exemplo.test' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, email: u.email, passwordHash },
      create: { ...u, passwordHash },
    });
  }

  // --- Memberships + escopo por unidade ------------------------------------
  const memberships = [
    // Dono vê as duas unidades
    {
      id: ids.mRicardo,
      tenantId: ids.tenantExemplo,
      userId: ids.userRicardo,
      role: 'OWNER',
      unitIds: [ids.unitCentro, ids.unitPinheiros],
    },
    // Gerente só do Centro
    {
      id: ids.mJuliana,
      tenantId: ids.tenantExemplo,
      userId: ids.userJuliana,
      role: 'MANAGER',
      unitIds: [ids.unitCentro],
    },
    // Recepção em Pinheiros
    {
      id: ids.mCamila,
      tenantId: ids.tenantExemplo,
      userId: ids.userCamila,
      role: 'RECEPTION',
      unitIds: [ids.unitPinheiros],
    },
    // Barbeiro atende nas duas unidades (dias alternados)
    {
      id: ids.mThiago,
      tenantId: ids.tenantExemplo,
      userId: ids.userThiago,
      role: 'PROFESSIONAL',
      unitIds: [ids.unitCentro, ids.unitPinheiros],
    },
    // Juliana também é dona de um segundo negócio → exercita a seleção de tenant no login e o RLS cross-tenant
    {
      id: ids.mJulianaMoema,
      tenantId: ids.tenantMoema,
      userId: ids.userJuliana,
      role: 'OWNER',
      unitIds: [ids.unitMoema],
    },
  ] as const;
  for (const { unitIds, ...m } of memberships) {
    await prisma.membership.upsert({
      where: { id: m.id },
      update: { role: m.role, isActive: true },
      create: m,
    });
    await prisma.membershipUnit.deleteMany({ where: { membershipId: m.id } });
    await prisma.membershipUnit.createMany({
      data: unitIds.map((unitId) => ({ tenantId: m.tenantId, membershipId: m.id, unitId })),
    });
  }

  // --- Convite pendente (para a tela de equipe) -----------------------------
  // Token em claro (apenas dev, para testar GET /invitations/:token): "seed-convite-pedro"
  await prisma.invitation.upsert({
    where: { id: ids.invitePending },
    update: {},
    create: {
      id: ids.invitePending,
      tenantId: ids.tenantExemplo,
      email: 'pedro@barbearia-exemplo.test',
      role: 'PROFESSIONAL',
      tokenHash: sha256('seed-convite-pedro'),
      invitedById: ids.mRicardo,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      units: { create: [{ unitId: ids.unitPinheiros }] },
    },
  });

  const counts = {
    tenants: await prisma.tenant.count(),
    units: await prisma.unit.count(),
    users: await prisma.user.count(),
    memberships: await prisma.membership.count(),
    membershipUnits: await prisma.membershipUnit.count(),
    invitations: await prisma.invitation.count(),
  };
  console.log('Seed concluído:', counts);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
