# Plano técnico — Autenticação, Tenants, Unidades e Memberships

> Autor: `tech-lead` · Status: **pronto para execução** · Fase: MVP (primeira feature)
> Produto: `docs/product/auth.md` (stories e RBAC, seções 1–7; decisões do tech-lead na seção 8).
> Decisão estrutural de sessão/multi-tenant: `docs/adr/0002-autenticacao-sessao-multi-tenant.md`.

## 1. Objetivo e critérios de aceite (resumo)

Entregar o fluxo fundacional sem o qual nenhuma outra feature existe:

- Signup cria `Tenant` + `Unit` padrão + `User` + `Membership(OWNER)`, com sessão já ativa (US-01).
- `User` autenticado pode criar **outro** `Tenant` (ação "+ Criar nova barbearia", decisão 2 da §8 do
  `auth.md`) sem precisar de e-mail novo.
- Login por e-mail/senha, com seleção de tenant quando há múltiplos `Membership`s ativos, e logout (US-02).
- Convite de membro por e-mail com papel + unidade(s), aceite por pessoa nova ou já existente (US-03, US-04).
- Gestão de membros: listar, alterar papel/unidades, remover (soft), cancelar/reenviar convite — sempre
  mantendo ≥ 1 `OWNER` ativo (US-05).
- CRUD de `Unit` (nome, timezone, endereço, CNPJ opcional, horário de funcionamento), só `OWNER` cria/edita
  (US-06).
- Troca de senha autenticada e "esqueci minha senha" (US-07, US-08), com a política de invalidação de sessão
  da ADR 0002.

Critérios de aceite completos (Gherkin) já estão em `docs/product/auth.md` §6 — este plano não os repete,
apenas os mapeia para contrato e tarefas.

**Nota de ajuste técnico** (não altera `auth.md`, registrado aqui): a história US-05 descreve a tela de
equipe apenas sob a perspectiva do `OWNER`. Este plano assume que `GET /memberships` (listar equipe) é
permitido também ao `MANAGER` (consistente com ele poder convidar/gerenciar `RECEPTION`/`PROFESSIONAL`), mas
a resposta é filtrada: um `MANAGER` só vê membros com interseção de unidades com as suas, nunca vê dados de
`OWNER`s fora isso. `RECEPTION`/`PROFESSIONAL` não têm acesso a este endpoint (403).

## 2. Contrato

### 2.1 Schemas Zod novos em `packages/shared`

Mantidos junto de `enums.ts`/`money.ts` já existentes, em novos arquivos por domínio (`auth.ts`,
`memberships.ts`, `units.ts`) e reexportados em `index.ts`.

```ts
// packages/shared/src/enums.ts — adições
export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
```

```ts
// packages/shared/src/auth.ts
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
// mínimo 8 caracteres; política completa (maiúscula/número) fica para security-reviewer avaliar
// como débito consciente — ver §6 "Riscos".
export const passwordSchema = z.string().min(8).max(72); // 72 = limite prático de entrada do argon2id

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  businessName: z.string().trim().min(2).max(120),
});

export const createTenantSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const selectTenantSchema = z.object({
  selectTenantToken: z.string().min(1),
  tenantId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

export const acceptInvitationSchema = z.object({
  // obrigatórios só quando o e-mail convidado ainda não tem User (ver §2.2, POST /invitations/:token/accept)
  name: z.string().trim().min(2).max(120).optional(),
  password: passwordSchema.optional(),
});

export const authTokensResponseSchema = z.object({
  accessToken: z.string(),
  // refreshToken NÃO entra aqui — vai só em cookie httpOnly, nunca no corpo JSON.
  tenantId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: z.enum(MEMBERSHIP_ROLES),
});

export const tenantSelectionRequiredResponseSchema = z.object({
  selectTenantToken: z.string(),
  tenants: z.array(
    z.object({
      tenantId: z.string().uuid(),
      tenantName: z.string(),
      role: z.enum(MEMBERSHIP_ROLES),
    }),
  ),
});
```

```ts
// packages/shared/src/memberships.ts
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBERSHIP_ROLES),
  unitIds: z.array(z.string().uuid()).min(1), // OWNER não é convidável por este endpoint se role === 'OWNER'
  // sem o próprio ator ser OWNER (checado no service, não no schema)
});

export const updateMembershipSchema = z
  .object({
    role: z.enum(MEMBERSHIP_ROLES).optional(),
    unitIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((v) => v.role !== undefined || v.unitIds !== undefined, 'Nada para atualizar');

export const membershipResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  unitIds: z.array(z.string().uuid()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export const invitationResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.enum(MEMBERSHIP_ROLES),
  unitIds: z.array(z.string().uuid()),
  status: z.enum(INVITATION_STATUSES),
  expiresAt: z.string().datetime(),
});
```

```ts
// packages/shared/src/units.ts
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
      state: z.string().length(2),
      zipCode: z.string().regex(/^\d{5}-?\d{3}$/),
    })
    .optional(), // opcional no payload da Unit do signup (preenchida depois); obrigatório na UI de gestão
  cnpj: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  businessHours: z.array(weekdayHoursSchema).length(7),
});

export const updateUnitSchema = createUnitSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const unitResponseSchema = createUnitSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  isActive: z.boolean(),
});
```

> Donos destes arquivos (`WORKFLOW.md`): `backend-engineer` escreve/mantém `packages/shared`;
> `frontend-engineer` e `tech-lead` revisam.

### 2.2 Endpoints

Todos sob prefixo `/api/v1`. "Auth" = guard de JWT válido; "RBAC" = guard de papel aplicado depois do auth
guard; `tenant_id`/`membership_id` sempre vêm do `sid`/claims do token (nunca de param/body), conforme ADR
0002 e regra 1 do `CLAUDE.md`.

Nas rotas administrativas de baixo volume que criam/alteram/removem convites, memberships ou unidades
(endpoints 10–12, 16–17 e 19–21 abaixo), o guard RBAC não confia só no `role`/`unit_id`s do claim: confere
`Membership.isActive` e `role` atuais do ator no banco antes de autorizar (exceção à janela de 15 min aceita
na ADR 0002, item 6) — custo desprezível dado o baixo volume dessas rotas. As demais rotas autenticadas
(leituras deste módulo e rotas de alto volume fora dele, como agenda/dashboard) continuam só com o claim do
JWT.

| #   | Método/Rota                       | Auth                                                | Request                  | Response (2xx)                                                                                                  | Principais erros                                                                                                        |
| --- | --------------------------------- | --------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /auth/signup`               | pública                                             | `signupSchema`           | `authTokensResponseSchema` (+ cookie refresh)                                                                   | 409 e-mail em uso · 400 validação                                                                                       |
| 2   | `POST /tenants`                   | autenticado (qualquer `User`)                       | `createTenantSchema`     | `authTokensResponseSchema` (tokens do **novo** tenant)                                                          | 400 validação                                                                                                           |
| 3   | `POST /auth/login`                | pública                                             | `loginSchema`            | `authTokensResponseSchema` **ou** `tenantSelectionRequiredResponseSchema` **ou** `{ noActiveMembership: true }` | 401 credenciais inválidas (mensagem genérica, sem indicar qual campo)                                                   |
| 4   | `POST /auth/select-tenant`        | token intermediário `select-tenant`                 | `selectTenantSchema`     | `authTokensResponseSchema` (+ cookie refresh)                                                                   | 400/401 token expirado/inválido · 403 membership/unit inativos                                                          |
| 5   | `POST /auth/refresh`              | cookie refresh                                      | — (lê cookie)            | `{ accessToken }` (+ cookie refresh rotacionado)                                                                | 401 refresh inválido/expirado/revogado                                                                                  |
| 6   | `POST /auth/logout`               | autenticado                                         | —                        | 204 (+ limpa cookie)                                                                                            | —                                                                                                                       |
| 7   | `POST /auth/change-password`      | autenticado                                         | `changePasswordSchema`   | 204                                                                                                             | 400 senha atual incorreta · 422 senha fraca                                                                             |
| 8   | `POST /auth/forgot-password`      | pública                                             | `forgotPasswordSchema`   | 202 (sempre, mesma mensagem genérica)                                                                           | — (nunca revela se e-mail existe)                                                                                       |
| 9   | `POST /auth/reset-password`       | pública                                             | `resetPasswordSchema`    | 204                                                                                                             | 400 token inválido/expirado/já usado                                                                                    |
| 10  | `POST /invitations`               | autenticado · RBAC `OWNER,MANAGER`                  | `inviteMemberSchema`     | `invitationResponseSchema` (201)                                                                                | 403 fora de escopo de unidade/role · 409 já é membro · 409 convite pendente existente (usar `resend`) · 400 sem unidade |
| 11  | `POST /invitations/:id/resend`    | autenticado · RBAC `OWNER,MANAGER`                  | —                        | `invitationResponseSchema`                                                                                      | 403 · 404 · 409 já aceito/cancelado                                                                                     |
| 12  | `DELETE /invitations/:id`         | autenticado · RBAC `OWNER,MANAGER`                  | —                        | 204                                                                                                             | 403 · 404                                                                                                               |
| 13  | `GET /invitations/:token`         | pública (consulta por token, para a tela de aceite) | —                        | `{ email, tenantName, role, unitNames, requiresLogin }`                                                         | 404/410 expirado/usado/cancelado                                                                                        |
| 14  | `POST /invitations/:token/accept` | pública ou autenticada (ver nota)                   | `acceptInvitationSchema` | `authTokensResponseSchema`                                                                                      | 400/404/410 token inválido · 401 e-mail já é `User` e não autenticado · 403 autenticado com e-mail diferente do convite |
| 15  | `GET /memberships`                | autenticado · RBAC `OWNER,MANAGER`                  | query opcional `unitId`  | `{ members: membershipResponseSchema[], pendingInvitations: invitationResponseSchema[] }`                       | 403                                                                                                                     |
| 16  | `PATCH /memberships/:id`          | autenticado · RBAC `OWNER,MANAGER`                  | `updateMembershipSchema` | `membershipResponseSchema`                                                                                      | 403 fora de escopo/alvo é `OWNER` e ator é `MANAGER` · 409 removeria o último `OWNER` ativo                             |
| 17  | `DELETE /memberships/:id`         | autenticado · RBAC `OWNER,MANAGER`                  | —                        | 204 (soft: `isActive=false` + revoga sessões)                                                                   | 403 · 409 último `OWNER`                                                                                                |
| 18  | `GET /units`                      | autenticado (qualquer role)                         | —                        | `unitResponseSchema[]` (filtrado ao escopo do membership; `OWNER` vê todas)                                     | —                                                                                                                       |
| 19  | `POST /units`                     | autenticado · RBAC `OWNER`                          | `createUnitSchema`       | `unitResponseSchema` (201)                                                                                      | 403 · 400 validação                                                                                                     |
| 20  | `PATCH /units/:id`                | autenticado · RBAC `OWNER`                          | `updateUnitSchema`       | `unitResponseSchema`                                                                                            | 403 · 404 · 400                                                                                                         |
| 21  | `DELETE /units/:id`               | autenticado · RBAC `OWNER`                          | —                        | 204 (soft: `isActive=false`)                                                                                    | 403 · 404                                                                                                               |

Nota sobre o endpoint 14: quando o e-mail do convite já pertence a um `User` existente, o front primeiro
direciona para `/auth/login` (endpoint 3) e só então chama o accept **com** o `Authorization: Bearer` dessa
sessão; o backend valida que o e-mail do token de login bate com o e-mail do convite antes de criar o
`Membership`. Quando o e-mail é novo, o accept cria `User`+`Membership` em uma transação e já devolve tokens
autenticados (equivalente ao signup, mas sem criar `Tenant`/`Unit` novos).

## 3. Mudanças de banco

Entidades novas em `apps/api/prisma/schema.prisma` (dono: `database-engineer`; convenção: tabelas/colunas
snake_case via `@@map`/`@map`, modelos PascalCase). Visão de campos — `database-engineer` ajusta tipos
exatos/índices adicionais:

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  name         String
  email        String   @unique // unicidade real é case-insensitive — índice funcional em migration SQL manual
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz

  memberships         Membership[]
  sessions            Session[]
  passwordResetTokens PasswordResetToken[]

  @@map("users")
}

model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  units       Unit[]
  memberships Membership[]
  invitations Invitation[]

  @@map("tenants")
}

model Unit {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  name          String
  timezone      String
  street        String?
  number        String?
  complement    String?
  neighborhood  String?
  city          String?
  state         String?  @db.Char(2)
  zipCode       String?  @map("zip_code")
  cnpj          String?  @db.Char(14)
  businessHours Json     @map("business_hours") // array de 7 posições {weekday, closed, opensAt, closesAt}
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant           Tenant             @relation(fields: [tenantId], references: [id])
  membershipUnits  MembershipUnit[]
  invitationUnits  InvitationUnit[]

  @@index([tenantId])
  @@map("units")
}

model Membership {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  role      String   // MEMBERSHIP_ROLES — ver nota abaixo sobre enum Postgres
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant Tenant           @relation(fields: [tenantId], references: [id])
  user   User             @relation(fields: [userId], references: [id])
  units  MembershipUnit[]

  @@unique([tenantId, userId])
  @@index([userId])
  @@map("memberships")
}

model MembershipUnit {
  membershipId String @map("membership_id") @db.Uuid
  unitId       String @map("unit_id") @db.Uuid

  membership Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  unit       Unit       @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@id([membershipId, unitId])
  @@map("membership_units")
}

model Invitation {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  email       String
  role        String   // MEMBERSHIP_ROLES
  tokenHash   String   @unique @map("token_hash") // sha-256 do token enviado por e-mail
  status      String   @default("PENDING") // INVITATION_STATUSES
  invitedById String   @map("invited_by_id") @db.Uuid // membership_id de quem convidou
  expiresAt   DateTime @map("expires_at") @db.Timestamptz
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant Tenant            @relation(fields: [tenantId], references: [id])
  units  InvitationUnit[]

  @@index([tenantId, email])
  @@map("invitations")
}

model InvitationUnit {
  invitationId String @map("invitation_id") @db.Uuid
  unitId       String @map("unit_id") @db.Uuid

  invitation Invitation @relation(fields: [invitationId], references: [id], onDelete: Cascade)
  unit       Unit       @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@id([invitationId, unitId])
  @@map("invitation_units")
}

model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz
  usedAt    DateTime? @map("used_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("password_reset_tokens")
}

model Session {
  id               String    @id @default(uuid()) @db.Uuid // = "sid" no JWT
  userId           String    @map("user_id") @db.Uuid
  tenantId         String    @map("tenant_id") @db.Uuid
  membershipId     String    @map("membership_id") @db.Uuid
  refreshTokenHash String    @map("refresh_token_hash") // sha-256 do refresh token atual (rotativo)
  userAgent        String?   @map("user_agent") @db.VarChar(255)
  ipTruncated      String?   @map("ip_truncated") @db.VarChar(45) // último octeto/hexteto zerado — sem PII fina em log
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  expiresAt        DateTime  @map("expires_at") @db.Timestamptz
  revokedAt        DateTime? @map("revoked_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id])

  @@index([userId, tenantId])
  @@index([refreshTokenHash])
  @@map("sessions")
}
```

Notas para o `database-engineer`:

- **`role` como `String` em vez de `enum` nativo do Postgres**: igual ao já implícito pelo uso de
  `MEMBERSHIP_ROLES` só em `packages/shared`, mantém a validação na borda (Zod) e evita migration de ALTER
  TYPE a cada novo papel; adicionar `CHECK (role IN (...))` na migration SQL manual como segunda barreira.
  Mesmo padrão para `Invitation.status`.
- **Unicidade de e-mail case-insensitive**: migration SQL manual com
  `CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));` e remover o `@unique` simples do
  Prisma (ou manter como está e tratar na aplicação — decisão de implementação do `database-engineer`,
  mas o índice funcional é obrigatório, não só validação de app).
- **RLS**: `Tenant` não tem `tenant_id` (é a própria raiz); `Unit`, `Membership`, `MembershipUnit` (via
  join), `Invitation`, `InvitationUnit` (via join) têm `tenant_id` direto ou indireto e entram na política
  de RLS por `app.tenant_id`, igual ao restante do domínio (`ARCHITECTURE.md` §3.2). `User`, `Session` e
  `PasswordResetToken` são **globais** (por `user_id`, não por tenant) e por isso não entram na política de
  `app.tenant_id` — mas recebem política própria de RLS por `app.user_id` (mesmo padrão `SET LOCAL` já usado
  para `app.tenant_id`, populado pelo guard a partir do claim `sub`), como segunda barreira contra um service
  que esqueça o filtro `WHERE user_id = ...` na query; a lógica de aplicação (sempre filtrada por `user_id`
  do token) continua sendo a primeira barreira, igual já era.
- **RLS e lookups públicos por token** (`GET /invitations/:token`, `POST /invitations/:token/accept` e
  `POST /auth/reset-password` — endpoints 13, 14 e 9 do §2.2): essas queries iniciais rodam **antes** de
  existir qualquer `tenant_id`/`user_id` de contexto (ainda não há sessão), então não podem usar
  `SET LOCAL app.tenant_id`/`app.user_id` (não há valor a popular) nem desligar RLS globalmente para
  contornar isso. Em vez disso, `Invitation` e `PasswordResetToken` ganham uma policy adicional, permissiva
  **só para `SELECT` por igualdade exata de `token_hash`** (o índice `@unique` já cobre essa busca); qualquer
  outra operação (`UPDATE`/`DELETE`, ou `SELECT` sem o `token_hash` exato) continua exigindo a policy normal
  por `tenant_id`/`user_id`. O `database-engineer` escreve essa policy explicitamente na migration SQL
  manual — não é uma omissão a ser "resolvida" desabilitando RLS na sessão.
- **Índices**: além dos listados, considerar `@@index([status, expiresAt])` em `Invitation` para a
  housekeeping de convites expirados, e `@@index([expiresAt])` em `Session`/`PasswordResetToken` para o job
  de limpeza (tarefa 2 abaixo).
- **Seed** (`apps/api/prisma/seed.ts`): criar ao menos um tenant de exemplo com `OWNER`, `MANAGER`,
  `RECEPTION`, `PROFESSIONAL` e 2 `Unit`s para os demais módulos (agenda, serviços) já terem dado de teste.

## 4. Tarefas por agente (ordem e dependências)

Ordem geral: **shared → banco → back (auth → tenants/memberships/units) → integrações/front em paralelo →
testes → revisão → PR**, conforme `docs/WORKFLOW.md`.

1. **`backend-engineer`** — `packages/shared`: adicionar `INVITATION_STATUSES` em `enums.ts` e os arquivos
   `auth.ts`, `memberships.ts`, `units.ts` do §2.1, reexportados em `index.ts`; testes unitários dos schemas
   (parse válido/inválido). _Sem dependências — primeira tarefa._
2. **`database-engineer`** — `apps/api/prisma/schema.prisma`: modelos do §3 + migration (`db:migrate`) +
   migration SQL manual para RLS/índice de e-mail/CHECK de enum + `seed.ts`. _Depende da tarefa 1 só para
   saber os nomes de enum; pode começar em paralelo olhando este plano._
3. **`backend-engineer`** — módulo `apps/api/src/modules/auth`: `AuthController`/`AuthService`, guard JWT
   (`common/guards/jwt-auth.guard.ts`), guard de "membership fresca" para as rotas administrativas listadas
   em §2.2 (confere `Membership.isActive`/`role` no banco — exceção da ADR 0002 item 6), interceptor de
   `SET LOCAL app.tenant_id`/`app.user_id` por request, hashing argon2id, emissão/validação de JWT e refresh
   token, tabela `Session`, **e rate limiting com `@nestjs/throttler` em `POST /auth/login`,
   `POST /auth/forgot-password` e `POST /auth/refresh`** — requisito obrigatório desta tarefa (mitigação de
   credential stuffing, OWASP A07), não um item que pode ficar para depois (ver §5 "Riscos") (endpoints 1,
   3–9 do §2.2). _Depende de 1 e 2._
4. **`backend-engineer`** — módulo `tenants` (endpoint 2: `POST /tenants`, reaproveitando o serviço interno
   de criação usado no signup). _Depende de 3 (reaproveita a emissão de tokens)._
5. **`backend-engineer`** — módulo `memberships` (convites + gestão de membros, endpoints 10–17), incluindo
   guard de RBAC por papel/escopo de unidade e a regra "nunca remover o último `OWNER` ativo". _Depende de 3._
6. **`backend-engineer`** — módulo `units` (CRUD, endpoints 18–21), incluindo validação de timezone IANA.
   _Depende de 2; pode rodar em paralelo com 4 e 5._
7. **`integrations-engineer`** — processor BullMQ para e-mail de convite (endpoint 10/11) e de redefinição
   de senha (endpoint 8), usando mailpit em dev; idempotência por `jobId` = hash do token. _Depende de 3 e
   5 (precisa dos eventos/dados que disparam o envio)._
8. **`ui-ux-designer`** — fluxo/wireframe de signup, login + seleção de tenant, tela de equipe (convites e
   membros), gestão de unidades, trocar senha, esqueci senha. _Sem dependência de back — pode rodar em
   paralelo com 2–7, a partir deste plano e de `docs/product/auth.md` §6._
9. **`frontend-engineer`** — telas em `apps/web/src/features/auth`, `.../team`, `.../units`, consumindo os
   schemas de `packages/shared` e TanStack Query; pode iniciar com mocks assim que a tarefa 1 estiver pronta,
   e trocar para a API real conforme 3–6 forem ficando prontos. _Depende de 1 (contrato) e 8 (fluxo); mocks
   liberam início antes de 3–6 terminarem._
10. **`qa-engineer`** — testes de integração (Testcontainers + Supertest) cobrindo os cenários Gherkin de
    `docs/product/auth.md` §6 (todos os epics), e E2E Playwright do caminho crítico: signup → logout → login
    → convite → aceite → login do convidado. _Depende de 3–6 e 9._
11. **`code-reviewer`** + **`security-reviewer`** — revisão do diff completo antes do PR: atenção especial a
    RLS efetivo (testar tentativa de acesso cross-tenant; policy por `app.user_id` em `User`/`Session`/
    `PasswordResetToken`; policy de lookup público por `token_hash` — todas em §3), ausência de refresh token
    em respostas JSON, mensagens genéricas em login/forgot-password (anti-enumeração), o guard de
    "membership fresca" nas rotas administrativas (§2.2, ADR 0002 item 6), e a presença efetiva do rate
    limiting (`@nestjs/throttler`) em `POST /auth/login`, `POST /auth/forgot-password` e `POST /auth/refresh`
    — requisito obrigatório da tarefa 3 (§5), não um item que pode faltar. _Depende de 1–10._
12. **`git-cicd-engineer`** — branch `feat/auth-tenants-memberships`, commits por etapa (Conventional
    Commits), PR com CI verde. _Depende de 11._

## 5. Riscos e débitos conscientes (para acompanhar, não bloqueiam o MVP)

- **Claims desatualizadas por até 15 min** após mudança de papel/unidade sem revogação explícita — aceito na
  ADR 0002, item 6.
- **Rate limiting** de `POST /auth/login`, `POST /auth/forgot-password` e `POST /auth/refresh` é requisito
  obrigatório da tarefa 3 (`@nestjs/throttler`, ver §4) — não é débito de fase 2: é superfície clássica de
  credential stuffing (OWASP A07) e entra pronto neste PR, sem exceção.
- **Política de senha** é só "mínimo 8 caracteres" no MVP (`passwordSchema`); regras adicionais (classes de
  caractere, lista de senhas vazadas via HaveIBeenPwned API) ficam como melhoria futura, não bloqueiam.
- **Bloqueio de conta por tentativas de login** citado em `docs/product/auth.md` §2 como fora de escopo
  detalhado — mantido fora deste plano; rate limiting (acima) é a mitigação mínima do MVP.
- **`GET /memberships` para `MANAGER`**: assunção registrada em §1 deste plano (produto não detalhou) —
  revisar com `product-analyst` se o comportamento observado em uso real não corresponder à expectativa.
