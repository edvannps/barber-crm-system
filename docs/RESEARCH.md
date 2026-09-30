# Base de conhecimento — projetos similares

> Pesquisa realizada em 30/09/2026. Estrelas aproximadas no momento da consulta.
> Itens marcados _(não verificado)_ precisam de confirmação antes de serem usados como referência.

**Nota:** a Cal.com fechou o código em abril/2026; o repositório `calcom/cal.com` virou **`calcom/cal.diy`**
(MIT, sem código enterprise). Fonte: https://cal.com/blog/cal-com-goes-closed-source-why

## 1. Repositórios de referência

| # | Repositório | Stack | ⭐ | O que aprender |
|---|---|---|---|---|
| 1 | [calcom/cal.diy](https://github.com/calcom/cal.diy) (ex-Cal.com) | Next.js, tRPC, React, Tailwind, Prisma, Postgres, Turborepo | ~48.8k | Melhor referência de agenda: `Schedule` → `Availability` (`days Int[]`, `startTime/endTime @db.Time`, `date` para exceções), `timeZone` por schedule/usuário, `OutOfOfficeEntry`, `Membership(role)`, `Host(isFixed, priority, weight)` para round-robin, `Payment` desacoplado. Módulos `slots`, `availability`, `busyTimes`, `workflows`, `webhooks` em `packages/features/`. Monorepo parecido com o nosso. |
| 2 | [twentyhq/twenty](https://github.com/twentyhq/twenty) | NestJS, BullMQ, Postgres, Redis, React, Nx | ~57.7k | CRM moderno com NestJS: módulos, filas BullMQ, workspaces. Historicamente schema-por-workspace _(não verificado na versão atual)_ — útil para avaliar o custo dessa estratégia. |
| 3 | [alextselegidis/easyappointments](https://github.com/alextselegidis/easyappointments) | PHP, CodeIgniter, MySQL | ~4.4k | Modelo clássico: services, categories, providers, services_providers (N:N), working plan semanal, `working_plan_exceptions`, `blocked_periods`, webhooks. Lição: exceções em JSON na tabela de settings foi erro corrigido depois — use tabelas próprias. |
| 4 | [LibreBooking/librebooking](https://github.com/LibreBooking/librebooking) | PHP, MySQL | ~817 | Reserva de **recursos** (cadeira/sala), quotas, créditos, RBAC. Ideia: modelar cadeira/sala separada do profissional. |
| 5 | [clawnify/OpenSalon](https://github.com/clawnify/OpenSalon) | Preact, Tailwind v4, shadcn/ui, Hono, SQLite, Zod | ~49 | Domínio de salão enxuto: `appointment_services` (vários serviços por atendimento), `blocked_slots`, `appointment_notes`, calendário do dia com colunas por profissional, status booked → confirmed → completed. |
| 6 | [opensourcepos/opensourcepos](https://github.com/opensourcepos/opensourcepos) | PHP, CodeIgniter, MySQL | ~4.4k | PDV: vendas, kits, estoque, caixa, despesas, gift cards, recompensas. Referência para comanda e caixa. |
| 7 | [getlago/lago](https://github.com/getlago/lago) | API-first, AGPLv3 | ~10.6k | Cobrança recorrente: plans, subscriptions, charges, wallets/créditos, idempotência por `transaction_id`. Inspiração para clube de assinatura. |
| 8 | [EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api) | Node, TS, Express, Prisma | ~9.7k | Gateway WhatsApp popular no Brasil (Baileys não oficial + Cloud API). Apache 2.0 com restrições de marca. |
| 9 | [jkminhaj/booking-server](https://github.com/jkminhaj/booking-server) | Express 5, Prisma, Postgres, Stripe | baixo | Multi-tenant com `businessId` no JWT; reserva em transação `SERIALIZABLE` com retry; precedência override profissional > override empresa > semanal; buffer como `[start, end+buffer)`; PAID só via webhook assinado. |
| 10 | [ribato22/nexcal](https://github.com/ribato22/nexcal) | Next.js, Prisma, Postgres, Auth.js | ~7 | Sinal (down-payment) com payment guard, link único para o cliente reagendar/cancelar, gateway agnóstico. |
| 11 | [SabagOded/barber-booking-system](https://github.com/SabagOded/barber-booking-system) | Next.js, Prisma, Turso, Vitest | baixo | Regras de agenda em pacote de domínio compartilhado UI/servidor; regras em horário local, instantes em UTC; 252 testes incluindo corridas de reserva concorrente. |
| 12 | [smancer-dev/multi-tenant-booking-saas](https://github.com/smancer-dev/multi-tenant-booking-saas) | NestJS, Prisma, React/Vite, Postgres, BullMQ | 0 | Esqueleto muito próximo do nosso stack: módulos tenants/staff/services/appointments/notifications, lembretes via BullMQ. |
| 13 | [oMiguelwnl/Barber](https://github.com/oMiguelwnl/Barber) · [ViGF/fsw-barber](https://github.com/ViGF/fsw-barber) (FSW Barber) | Next.js, Prisma, shadcn, NextAuth | baixo | Projeto didático brasileiro; referência de UX mobile-first. Modelo de dados simplista demais para produção. |
| 14 | [AbdullahBakir97/Barber-Salon](https://github.com/AbdullahBakir97/Barber-Salon) | Django, DRF, Vue | _(não verificado)_ | Reviews, galeria, produtos, i18n. Secundário. |

Itens 1–8 são projetos maduros; 9–14 são pequenos e servem para ideias pontuais, não como base de código.

## 2. Entidades de domínio observadas

Todas as tabelas de negócio levam `tenant_id`.

- **Tenant**: `slug` (página pública), `legal_name`, `cnpj`, `saas_plan_id`, `status`, `timezone` padrão.
- **Unit (unidade)**: endereço, `timezone` (o Brasil tem 4 fusos), horário de funcionamento, `cnpj` próprio opcional (NFS-e por filial).
- **User + Membership**: usuário global ligado ao tenant por `Membership(role: OWNER|MANAGER|RECEPTION|PROFESSIONAL)`, com escopo por unidade opcional.
- **Professional**: `user_id?` (nem todo profissional faz login), `display_name`, `color` (coluna na agenda), `commission_default_pct`,
  `partner_type` (CLT, autônomo, **salão-parceiro – Lei 13.352/2016**), `cnpj/mei`, `pix_key`.
- **ServiceCategory → Service**: `duration_min`, `price_cents`, `buffer_after_min`, `online_booking_enabled`, `requires_deposit`.
  **ProfessionalService** (N:N) com preço/duração/comissão próprios.
- **WorkingHours**: `professional_id`, `unit_id`, `weekday`, `start_time`, `end_time` (`time`, horário local).
- **AvailabilityOverride**: `date`, `start/end` ou `closed`. Precedência: profissional > unidade > semanal.
- **TimeOff/Block**: `starts_at`, `ends_at` (`timestamptz`), `reason` — almoço, folga, férias, feriado.
- **Client**: `name`, `phone_e164` (chave prática no Brasil), `cpf?`, `email?`, `birth_date`, `tags`,
  `whatsapp_opt_in`, `marketing_consent` (LGPD), `source`. Unique `(tenant_id, phone_e164)`.
- **Appointment**: `unit_id`, `professional_id`, `client_id`, `starts_at`, `ends_at`, `status`
  (`SCHEDULED | CONFIRMED | CHECKED_IN | IN_SERVICE | COMPLETED | CANCELLED | NO_SHOW`), `origin` (online/balcão/WhatsApp), `cancel_reason`.
  - **AppointmentItem**: serviços com preço/duração **congelados**.
  - **AppointmentEvent**: log de auditoria.
- **ClientPackage**: pacote de N sessões, saldo, validade, consumo.
- **SubscriptionPlan → PlanBenefit → ClientSubscription → BenefitUsage** (clube de assinatura, modelo Trinks:
  limites por item, recorrência mensal, multa de cancelamento, contrato de adesão).
- **CommissionRule / CommissionEntry**: % ou valor fixo, desconta ou não taxa de cartão; gerada ao fechar comanda; vales e fechamento de período.
- **Product / StockMovement**: `sku`, custo, preço, estoque mínimo, validade; consumo fracionado (ml/g) por serviço (diferencial Belasis).
- **Order (comanda) → OrderItem** (serviço, produto, pacote, assinatura) → **Payment**
  (`PIX|CARD_CREDIT|CARD_DEBIT|CASH|VOUCHER|SUBSCRIPTION`, `gateway`, `external_id`, `fee_cents`) + **CashRegisterSession** (abertura, sangria, suprimento, fechamento).
- **FiscalInvoice (NFS-e)**: no salão-parceiro, uma nota por cota-parte.
- **Review/NPS**, **Waitlist**, **Notification/MessageLog** + **NotificationRule** (ex.: 24h e 2h antes, retorno após N dias).

## 3. Mercado brasileiro

Concorrentes: [Trinks](https://negocios.trinks.com/solucoes/) · [AppBarber](https://www.appbarber.com.br/funcionalidades/) ·
[Avec](https://negocios.avec.app/) · [Belasis](https://www.belasis.com.br/)

Funcionalidades comuns: agenda online e link público (Instagram/Google), lista de espera, lembretes WhatsApp/push/e-mail/SMS,
mensagens de retorno e aniversário, comanda, caixa, contas a pagar/receber, taxa de cartão, comissão com vales,
split automático (Trinks + Stone/pagar.me), clube de assinatura, pacotes, fidelidade, cupons, NFS-e (inclusive salão-parceiro),
estoque com validade/fracionamento, NPS, campanhas, app do profissional, multiunidade/franquia, relatórios.

## 4. Lições técnicas

### Conflitos de agenda — três camadas
1. **UI**: cálculo de slots só para exibição.
2. **Servidor**: revalida dentro da transação (servidor é autoritativo).
3. **Banco**: exclusion constraint é a garantia final:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
     EXCLUDE USING gist (tenant_id WITH =, professional_id WITH =,
       tstzrange(starts_at, blocked_until, '[)') WITH &&)
     WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
   ```
   `blocked_until` = fim + buffer. Erro `23P01` → HTTP 409. `[)` permite 10:00–10:30 seguido de 10:30–11:00.
   Bloqueios × reservas: constraint equivalente ou verificação na mesma transação.
   Ref.: https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT

### Cálculo de slots
Horário semanal → aplica overrides → subtrai bloqueios, folgas e agendamentos ativos (com buffer) → discretiza em passos de 10–15 min
onde cabe a duração total → aplica antecedência mínima e janela máxima. "Qualquer profissional": união dos slots e atribuição
por prioridade/carga. Implementar como **função pura** em `packages/scheduling`, testada exaustivamente e usada no front e no back.

### Fuso horário
Instantes em `timestamptz`; horários de trabalho em `time` local + timezone IANA da unidade. Nunca offsets fixos
(4 fusos no Brasil; horário de verão pode voltar).

### Multi-tenancy
Schema por tenant complica migrations e pool com milhares de pequenos tenants. Adotado: `tenant_id` + **RLS**
(`SET LOCAL app.tenant_id` por transação) + filtro automático na aplicação (Prisma Client Extension). Índices começando por `tenant_id`.
Exemplo de RLS com Prisma: https://github.com/prisma/prisma-client-extensions _(não verificado)_.

### Notificações
BullMQ com jobs atrasados criados junto do agendamento; guardar `job_id` para cancelar/reagendar; `message_log` idempotente
por (appointment, template); sweeper periódico reconcilia jobs perdidos.

### WhatsApp
Cloud API oficial cobra por template entregue (desde jul/2025): Marketing sempre cobrado; Utility grátis dentro da janela de 24h
([pricing](https://developers.facebook.com/docs/whatsapp/pricing)). Lembretes = templates **utility**. Evolution/Baileys é barato,
mas não oficial e sujeito a banimento. Abstração `MessagingProvider` com Cloud API como padrão.

### Pagamentos / Pix
**Asaas**: assinaturas PIX/BOLETO/CREDIT_CARD, webhooks, **split**, Pix Automático ([docs](https://docs.asaas.com/docs/assinaturas)) —
encaixa em clube de assinatura e split de comissão. **Mercado Pago**: forte em Pix e maquininha. Stripe menos adequado a split/boleto no Brasil.
Status PAID **só via webhook** assinado e idempotente. Interface `PaymentGateway` agnóstica; subconta por tenant (Asaas) ou OAuth (MP).

## 5. Recomendações incorporadas à arquitetura
1. `packages/scheduling` (motor de slots puro) e `packages/shared` (contratos Zod).
2. Um módulo NestJS por bounded context; comunicação por eventos de domínio
   (`AppointmentCompleted` → comanda; `OrderClosed` → comissões + baixa de estoque) com **outbox** → BullMQ.
3. RLS desde o dia 1 + testes automatizados de vazamento entre tenants.
4. Preço, duração e % de comissão **congelados** nos itens de agendamento e comanda.
5. Status como **máquina de estados** explícita + `appointment_events`; nunca apagar agendamento (soft-cancel).
6. Integrações atrás de interfaces (`MessagingProvider`, `PaymentGateway`, `FiscalProvider`); webhooks em `inbound_webhooks`, processados de forma assíncrona e idempotente.
7. Billing do próprio SaaS separado do billing dos tenants para seus clientes.
8. Considerar **salão-parceiro (Lei 13.352/2016)** no modelo de profissional/comissão desde o início.
