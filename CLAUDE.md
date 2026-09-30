# Barber CRM System

SaaS multi-tenant de CRM e gestão para barbearias e salões de beleza (mercado brasileiro).

## Documentos de referência

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, estrutura do monorepo, princípios, domínio, fases
- [docs/RESEARCH.md](docs/RESEARCH.md) — base de conhecimento (projetos open source e concorrentes)
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — como os agentes especialistas colaboram
- [docs/adr/](docs/adr/) — decisões de arquitetura

## Stack

TypeScript strict · pnpm + Turborepo · React 19 + Vite + Tailwind v4 + shadcn/ui + TanStack Query/Router ·
NestJS 12 (Fastify) + Prisma · PostgreSQL 17 · BullMQ + Redis · Zod compartilhado · Vitest, Testcontainers, Playwright · GitHub Actions.

## Comandos

```bash
pnpm install
pnpm dev:infra            # docker compose (postgres, redis, mailpit)
pnpm dev                  # turbo: api + web
pnpm lint | pnpm typecheck | pnpm test | pnpm build
pnpm --filter @barber/api db:migrate  # prisma migrate dev
```

## Regras inegociáveis

1. `tenant_id` vem do contexto autenticado, **nunca** do request body/query. RLS ativo no Postgres.
2. Datas em `timestamptz` (UTC); conversão pelo `timezone` da unidade só nas bordas.
3. Dinheiro em **centavos inteiros**.
4. Contratos (schemas Zod) vivem em `packages/shared` e são usados no back e no front.
5. Conflito de agenda garantido por exclusion constraint no banco → API responde 409.
6. Efeitos externos (WhatsApp, e-mail, pagamentos) via fila, idempotentes.
7. Sem PII ou segredos em logs. LGPD: consentimento para marketing.
8. Código em inglês (identificadores); documentação, UI e mensagens de commit/PR em pt-BR.

## Convenções

- Conventional Commits (`feat(agenda): ...`), branches `feat/<escopo>-<desc>`, squash merge, PR com CI verde.
- Back-end: módulo por domínio em `apps/api/src/modules/<modulo>` (controller → service → repository).
- Front-end: feature-first em `apps/web/src/features/<feature>`; dados do servidor só via TanStack Query.
- Tabelas/colunas snake_case; modelos Prisma PascalCase.
- Toda feature entra com testes (unit + integração; E2E para fluxos críticos).

## Agentes especialistas (`.claude/agents/`)

| Agente                  | Quando usar                                          |
| ----------------------- | ---------------------------------------------------- |
| `tech-lead`             | Planejar feature, dividir tarefas, ADRs              |
| `product-analyst`       | User stories, critérios de aceite, regras de negócio |
| `ui-ux-designer`        | Design system, fluxos, wireframes, acessibilidade    |
| `database-engineer`     | Schema Prisma, migrations, índices, RLS, constraints |
| `backend-engineer`      | Módulos NestJS, regras de negócio, jobs              |
| `frontend-engineer`     | Telas React, componentes, agenda                     |
| `integrations-engineer` | WhatsApp, Pix/pagamentos, e-mail, webhooks           |
| `qa-engineer`           | Testes de integração/E2E, cenários de borda          |
| `devops-engineer`       | Docker, deploy, observabilidade, backups             |
| `git-cicd-engineer`     | Branches, commits, PRs, GitHub Actions, releases     |
| `code-reviewer`         | Revisão antes do PR (somente leitura)                |
| `security-reviewer`     | Segurança e LGPD (somente leitura)                   |

Fluxo padrão: ver [docs/WORKFLOW.md](docs/WORKFLOW.md).
