# Arquitetura — Barber CRM System

> SaaS multi-tenant de CRM e gestão para barbearias e salões de beleza.
> Status: **proposta inicial** — decisões marcadas como _ADR aberta_ ainda podem mudar.

## 1. Stack

| Camada          | Escolha                                                                    | Motivo                                                                |
| --------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Linguagem       | **TypeScript** (strict) em todo o repo                                     | Tipos compartilhados front ↔ back                                     |
| Monorepo        | **pnpm workspaces + Turborepo**                                            | Cache de build/test, pacotes compartilhados                           |
| Front-end       | **React 19 + Vite**                                                        | SPA rápida; painel é área logada (SEO irrelevante)                    |
| Estilo / UI     | **Tailwind CSS v4 + shadcn/ui** (Radix)                                    | Componentes acessíveis que ficam no nosso código                      |
| Estado servidor | **TanStack Query**                                                         | Cache, invalidação, otimismo na agenda                                |
| Roteamento      | **TanStack Router** (tipado)                                               | Rotas e search params tipados                                         |
| Formulários     | **React Hook Form + Zod**                                                  | Mesmos schemas Zod do back-end                                        |
| Back-end        | **NestJS 12 (adapter Fastify)**                                            | Módulos por domínio, DI, guards — estrutura clara para vários agentes |
| ORM             | **Prisma**                                                                 | Migrations, DX, tipagem; SQL cru para constraints avançadas           |
| Banco           | **PostgreSQL 17**                                                          | `tstzrange` + exclusion constraints, RLS, JSONB                       |
| Filas / jobs    | **BullMQ + Redis**                                                         | Lembretes WhatsApp/SMS, e-mails, rotinas agendadas                    |
| Contratos       | **Zod** em `packages/shared` + OpenAPI (Swagger)                           | Fonte única de validação                                              |
| Auth            | JWT curto + refresh token rotativo (cookie httpOnly), senhas **argon2**    | _ADR aberta_: avaliar Better Auth                                     |
| Testes          | **Vitest**, Supertest, **Testcontainers** (Postgres real), **Playwright**  | Pirâmide unit → integração → E2E                                      |
| Qualidade       | ESLint (flat config) + Prettier, Husky + lint-staged, commitlint           | Padrão de código e commits                                            |
| Infra local     | **Docker Compose** (postgres, redis, mailpit)                              | Ambiente reprodutível                                                 |
| CI/CD           | **GitHub Actions**                                                         | Lint, typecheck, test, build, deploy                                  |
| Observabilidade | Pino (logs JSON), Sentry, OpenTelemetry (fase 2)                           |                                                                       |
| Deploy          | _ADR aberta_: Railway/Render/Fly.io no início → AWS (ECS + RDS) ao escalar |                                                                       |

**Sugestões futuras:** app mobile do cliente com React Native/Expo reaproveitando `packages/shared`;
página pública de agendamento com Next.js/Astro se SEO por barbearia virar requisito.

## 2. Estrutura do monorepo

```
barber-crm-system/
├── apps/
│   ├── web/                    # Painel (React + Vite)
│   │   └── src/
│   │       ├── app/            # providers, router, layout
│   │       ├── features/       # por domínio: agenda/, clientes/, servicos/, caixa/...
│   │       │   └── <feature>/  # components/, hooks/, api.ts, routes.tsx
│   │       ├── components/ui/  # shadcn/ui
│   │       └── lib/            # api client, utils, formatters (BRL, datas)
│   ├── booking/                # (fase 2) página pública de agendamento
│   └── api/                    # NestJS
│       ├── src/
│       │   ├── modules/        # auth, tenants, units, staff, services, clients,
│       │   │                   # appointments, availability, sales, cash-register,
│       │   │                   # commissions, subscriptions, notifications, payments
│       │   │   └── <module>/   # *.controller.ts, *.service.ts, *.repository.ts, dto/, *.spec.ts
│       │   ├── common/         # guards, interceptors, filtros, tenant context
│       │   ├── jobs/           # processors BullMQ
│       │   └── main.ts
│       ├── prisma/             # schema.prisma, migrations/, seed.ts
│       └── test/               # testes de integração/e2e da API
├── packages/
│   ├── shared/                 # schemas Zod, tipos, enums, constantes de domínio
│   ├── scheduling/             # motor de slots/disponibilidade (funções puras, usado no back e no front)
│   ├── config/                 # tsconfig, eslint, prettier base
│   └── ui/                     # (opcional) componentes compartilhados entre web e booking
├── infra/
│   ├── docker/                 # Dockerfiles
│   └── compose/                # docker-compose.yml de dev
├── docs/
│   ├── ARCHITECTURE.md
│   ├── RESEARCH.md             # base de conhecimento (repositórios de referência)
│   ├── WORKFLOW.md             # como os agentes trabalham
│   └── adr/                    # Architecture Decision Records
├── .github/workflows/          # CI/CD
├── .claude/agents/             # agentes especialistas
├── CLAUDE.md
├── turbo.json
└── pnpm-workspace.yaml
```

## 3. Princípios de arquitetura

1. **Monólito modular** no back-end: cada módulo Nest é um bounded context
   (Agenda, Clientes, Financeiro...). Comunicação entre módulos via services
   exportados ou eventos internos — nunca acessando tabelas de outro módulo diretamente.
2. **Multi-tenancy**: schema compartilhado com coluna `tenant_id` em toda tabela de negócio
   - **Row-Level Security** do Postgres como segunda barreira. O `tenant_id` vem do token,
     é setado por request (`SET LOCAL app.tenant_id`) e nunca aceito do body.
3. **Tempo**: tudo em `timestamptz` (UTC) no banco; cada unidade tem `timezone`
   (padrão `America/Sao_Paulo`); conversão só nas bordas (API/UI).
4. **Agenda sem conflito garantida pelo banco**: `EXCLUDE USING gist (professional_id WITH =, period WITH &&)`
   em agendamentos ativos (extensão `btree_gist`). A aplicação calcula slots; o banco é a verdade final.
5. **Dinheiro em inteiros** (centavos, `integer`/`bigint`) — nunca `float`.
6. **Contratos compartilhados**: schemas Zod em `packages/shared` validam na API e nos formulários.
7. **Efeitos colaterais assíncronos** (WhatsApp, e-mail, webhooks de pagamento) via fila, com retry e idempotência.
   Eventos de domínio (`AppointmentCompleted`, `OrderClosed`) passam por **outbox** → BullMQ.
   Webhooks de entrada são gravados em `inbound_webhooks` e processados de forma assíncrona.
8. **Valores congelados**: preço, duração e % de comissão são copiados para itens de agendamento/comanda.
9. **Máquina de estados** explícita para agendamento, com `appointment_events` (auditoria); nunca apagar — soft-cancel.
10. **Integrações atrás de interfaces**: `MessagingProvider`, `PaymentGateway`, `FiscalProvider`.
11. **LGPD**: dados pessoais mínimos, consentimento para marketing, exportação/anonimização de cliente, logs sem PII.

## 4. Domínio (visão inicial)

```
Tenant (empresa) ─┬─ Unit (unidade/filial, timezone, horário de funcionamento)
                  ├─ User (login) ── Membership (papel: owner/admin/receptionist/professional)
                  ├─ Professional (partner_type: CLT/autônomo/salão-parceiro) ── WorkingHours, AvailabilityOverride, TimeOff,
                  │                 ProfessionalService (preço/duração/comissão próprios)
                  ├─ ServiceCategory ── Service (duração, preço)
                  ├─ Client (consentimentos, tags, histórico)
                  ├─ Appointment ── AppointmentItem (serviços, valores congelados), AppointmentEvent (auditoria)
                  │                 status: SCHEDULED → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED | CANCELLED | NO_SHOW
                  ├─ Product ── StockMovement
                  ├─ Sale (comanda) ── SaleItem ── Payment (pix/cartão/dinheiro)
                  ├─ CashRegister (caixa: abertura/fechamento) ── CashMovement
                  ├─ Commission (por item vendido/serviço)
                  ├─ SubscriptionPlan ── PlanBenefit ── ClientSubscription ── BenefitUsage (clube de assinatura)
                  ├─ ClientPackage (pacote de sessões), Waitlist, Review/NPS
                  └─ Notification / MessageTemplate
```

O detalhamento de campos fica com o agente `database-engineer` em `apps/api/prisma/schema.prisma`
e é refinado a partir de `docs/RESEARCH.md`.

## 5. Escopo por fases (proposta)

- **MVP**: auth + tenants/unidades, profissionais e horários, serviços, clientes,
  agenda (dia/semana, arrastar, bloqueios), agendamento online público simples,
  lembrete WhatsApp/e-mail, comanda + caixa básico, comissões simples, dashboard básico.
- **Fase 2**: clube de assinatura (recorrência via Pix/cartão), estoque de produtos,
  fidelidade, pagamentos online (Pix) no agendamento, relatórios avançados, lista de espera.
- **Fase 3**: NFS-e, app do cliente, marketing (campanhas/aniversário), multi-unidade avançado, BI.
