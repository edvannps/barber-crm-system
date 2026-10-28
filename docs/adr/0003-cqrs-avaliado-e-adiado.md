# ADR 0003 — CQRS avaliado e adiado

- **Status**: Aceita
- **Data**: 2026-10-28

## Contexto

Ao planejar a retomada da implementação, foi proposto adotar CQRS (separação de modelo
de escrita e modelo de leitura) justificado pela futura interface mobile para clientes
e pelo envio de lembretes/alertas de agendamento via WhatsApp.

## Decisão

Não adotar CQRS neste momento. Mantém-se o princípio 1 da `docs/ARCHITECTURE.md`:
**monólito modular**, módulos NestJS como bounded contexts, comunicação entre módulos
via services exportados ou eventos internos.

Um mobile e um painel web podem consumir a mesma API (REST + contratos Zod de
`packages/shared`) sem precisar de modelos de leitura e escrita separados. CQRS
resolve um problema que este projeto ainda não tem: carga de leitura muito assimétrica
da de escrita, necessidade de escalar leitura e escrita de forma independente, ou
modelo de leitura desnormalizado para relatórios pesados.

Dentro de um módulo, nada impede separar métodos de "comando" e de "consulta" no
mesmo service (ex.: `AppointmentCommandService` / `AppointmentQueryService`) quando
isso ajudar a legibilidade — isso é estilo de código, não a arquitetura CQRS com
stores e projeções separadas.

## Alternativas consideradas

- **CQRS completo + Event Sourcing**: dá auditoria completa e permite escalar leitura
  e escrita de forma independente, mas custa consistência eventual, infraestrutura de
  projeções e um modelo mental mais caro de depurar. Nenhum requisito atual pede isso —
  a auditoria de agendamento já é coberta por `AppointmentEvent` (seção 4 do
  ARCHITECTURE.md) sem precisar de event sourcing completo.
- **CQRS "light"** (métodos de leitura e escrita separados, mesmo banco, sem store
  duplicado): viável e de baixo custo, mas também não é necessário hoje — a separação
  de responsabilidade já vem do monólito modular.
- **Monólito modular sem CQRS** (escolhida): mais simples, meno peças para operar,
  compatível com o volume esperado de um CRM de barbearia em MVP.

## Consequências

- Menos complexidade operacional e cognitiva para seguir com o MVP.
- Um modelo (schema Prisma) serve leitura e escrita; otimizações de leitura (índices,
  queries específicas) ficam a cargo do `database-engineer` conforme a necessidade aparece.
- Interface mobile e lembretes WhatsApp seguem a arquitetura já decidida (API comum,
  fila BullMQ + outbox para efeitos assíncronos) — nenhuma mudança estrutural necessária
  por causa delas.

## O que mudaria esta decisão

- Evidência medida de gargalo de leitura (ex.: dashboard financeiro ou relatório
  agregando muitas linhas, competindo com escrita de agenda em horário de pico).
- Necessidade real de escalar leitura e escrita em infraestruturas diferentes.
- Requisito de auditoria completa via event sourcing que `AppointmentEvent` não cubra.

Qualquer um desses motiva reabrir esta ADR, não revertê-la por antecipação.
