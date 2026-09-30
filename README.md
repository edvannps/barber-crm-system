# Barber CRM System

SaaS multi-tenant de CRM e gestão para barbearias e salões de beleza.

## Stack

TypeScript · React 19 + Vite + Tailwind v4 · NestJS (Fastify) + Prisma · PostgreSQL 17 · Redis/BullMQ · pnpm + Turborepo

## Estrutura

| Pasta                 | Conteúdo                                          |
| --------------------- | ------------------------------------------------- |
| `apps/web`            | Painel (React)                                    |
| `apps/api`            | API (NestJS)                                      |
| `packages/shared`     | Contratos Zod, enums e utilitários compartilhados |
| `packages/scheduling` | Motor de disponibilidade/slots (funções puras)    |
| `packages/config`     | Configurações base de TypeScript                  |
| `infra/compose`       | Postgres, Redis e Mailpit para desenvolvimento    |

## Começando

Requisitos: Node 22+, pnpm 10, Docker.

```bash
cp .env.example .env
pnpm install
pnpm dev:infra   # sobe postgres, redis e mailpit
pnpm dev         # api em :3333, web em :5173
```

Outros comandos: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Base de conhecimento](docs/RESEARCH.md)
- [Workflow com agentes](docs/WORKFLOW.md)
- [ADRs](docs/adr/)
