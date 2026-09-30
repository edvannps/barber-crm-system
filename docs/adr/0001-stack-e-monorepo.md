# ADR 0001 — Stack base e monorepo

- **Status**: Proposta
- **Data**: 2026-09-30

## Contexto

Precisamos de uma base TypeScript de ponta a ponta com React, Tailwind e PostgreSQL, capaz de crescer
de MVP para SaaS multi-tenant, e que permita que agentes especialistas trabalhem em áreas bem delimitadas.

## Decisão

- Monorepo **pnpm workspaces + Turborepo** com `apps/web`, `apps/api`, `packages/shared`, `packages/config`.
- Front: **React 19 + Vite**, Tailwind v4, shadcn/ui, TanStack Query/Router, React Hook Form + Zod.
- Back: **NestJS 12 com adapter Fastify**, **Prisma**, BullMQ + Redis.
- Banco: **PostgreSQL 17**, multi-tenancy por `tenant_id` + RLS.
- Contratos: **Zod** em `packages/shared`.

## Alternativas consideradas

- **Next.js full-stack**: menos peças, mas mistura painel e API; NestJS dá fronteiras de módulo mais claras
  para um domínio grande (agenda, financeiro, assinaturas). Next.js continua opção para a página pública (fase 2).
- **Fastify/Hono puro**: mais leve, porém exigiria definir do zero a estrutura de módulos, DI e guards.
- **Drizzle ORM**: mais próximo do SQL e bom com RLS; Prisma escolhido pela maturidade de migrations e DX.
  Constraints avançadas (exclusion, RLS) ficam em SQL manual nas migrations.
- **Schema por tenant**: isolamento maior, mas migrations e operação muito mais caras. Reavaliar só para clientes enterprise.

## Consequências

- Tipos e validação compartilhados entre front e back.
- Prisma exige SQL manual para `EXCLUDE` e políticas RLS — documentado no agente `database-engineer`.
- Necessário cuidar do contexto de tenant por transação (`SET LOCAL app.tenant_id`) com Prisma.

## Versões fixadas (30/09/2026)

- **TypeScript 6.x** em vez do 7 (versão nativa em Go): o `typescript-eslint` ainda não suporta TS 7.
  Reavaliar quando houver suporte (https://github.com/typescript-eslint/typescript-eslint/issues/10940).
- **Prisma 7.10.0** (última estável): a tag `latest` no npm aponta para a release candidate 8.0.0-rc.
- Módulos em **ESM** em todo o monorepo (`"type": "module"`, `NodeNext`); imports relativos usam extensão `.js`.
- Testes da API usam `unplugin-swc` para emitir metadata de decorators (necessária para a DI do NestJS).
