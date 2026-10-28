# ADR 0002 — Autenticação, sessão e invalidação em contexto multi-tenant

- **Status**: Aceita
- **Data**: 2026-10-28

## Contexto

A primeira feature do produto (`docs/product/auth.md`) precisa de um mecanismo de autenticação e sessão
que sirva simultaneamente:

- um `User` global (e-mail + senha) que pode ter `Membership` em **múltiplos tenants** ao mesmo tempo
  (ex.: profissional freelancer que atende em duas barbearias);
- RBAC por `Membership` (`OWNER`/`MANAGER`/`RECEPTION`/`PROFESSIONAL`), escopado por `Unit` via
  `MembershipUnit`;
- a regra de multi-tenancy já decidida em `docs/ARCHITECTURE.md` (§3.2) e na ADR 0001: `tenant_id` nunca
  vem do body/query, é derivado do contexto autenticado, e RLS do Postgres (`SET LOCAL app.tenant_id`) é a
  segunda barreira;
- uma política de invalidação de sessão específica por evento de segurança (logout, troca de senha,
  "esqueci minha senha", remoção de membership — ver `docs/product/auth.md` §6.2, §6.5, §6.7, §6.8 e a
  decisão 8 da §8), o que exige que o servidor consiga revogar sessões ativas sem esperar o cliente agir.

Era preciso decidir: (a) o formato da sessão (apenas JWT stateless vs. algum componente server-side), (b)
onde fica o `tenant_id` ativo quando um `User` tem múltiplos tenants, (c) como revogar uma sessão antes do
seu vencimento natural, e (d) se usar uma biblioteca pronta (ex. Better Auth) ou implementação própria.

## Decisão

**1. Par access token (JWT) + refresh token rotativo, sessão "ativa por tenant selecionado":**

- **Access token**: JWT assinado (RS256 ou HS256 com segredo forte — decisão de implementação do
  `backend-engineer`), validade **15 minutos**, enviado no header `Authorization: Bearer`. Claims: `sub`
  (user id), `tenant_id` e `membership_id` do tenant **atualmente selecionado**, `role`, lista de `unit_id`s
  do membership (vazia/ignorada para `OWNER`, que sempre tem acesso a todas as unidades do tenant), `sid`
  (session id, ver item 3). O JWT é **stateless** na validação de rota a rota — não há consulta ao banco em
  todo request — mas carrega `sid` para permitir revogação (item 3).
- **Refresh token**: opaco (256 bits aleatórios), entregue em **cookie httpOnly, Secure, SameSite=Strict**
  (nunca em JSON de resposta nem em `localStorage`, para reduzir superfície de XSS). Validade de 30 dias.
  **Rotativo**: a cada uso, o refresh token é invalidado e um novo é emitido (`POST /auth/refresh`);
  detecção de reuso de um refresh token já trocado revoga toda a sessão (`sid`) como medida de contenção
  (indício de token roubado/replay).
- **Sem Better Auth** (nem outra lib de auth "tudo em um") **— implementação própria em NestJS**, pelos
  motivos do item "Alternativas consideradas": o projeto já decidiu (ADR 0001) multi-tenancy via `tenant_id`
  - RLS com `SET LOCAL` por transação Prisma, e a sessão precisa carregar e popular esse contexto a cada
    request de um jeito acoplado ao `PrismaService`/interceptor do próprio monólito. Bibliotecas de auth
    genéricas modelam "um usuário, uma conta" ou multi-tenant via plugin; aqui o requisito central —
    `User` com N `Membership`s ativos simultaneamente e troca de tenant/unit sem novo login — é exatamente a
    parte que foge do caminho padrão dessas libs, então o controle fino compensa o código a mais.

**2. Seleção de tenant/unit ativo via `sid` (sessão), não embutida permanentemente no token:**

- No login (`POST /auth/login`), se o `User` tiver exatamente 1 `Membership` ativo, o backend já emite o
  par de tokens com esse tenant selecionado. Se tiver mais de um, o backend emite um **token intermediário**
  de validade curta (5 min, escopo único `select-tenant`) e o front mostra a tela de seleção (US-02); a
  confirmação (`POST /auth/select-tenant`) troca esse token pelo par access+refresh definitivo daquele
  tenant.
- Trocar de tenant depois de logado (ex.: alternar entre as duas barbearias onde atua) refaz esse mesmo
  fluxo (`POST /auth/select-tenant` com o refresh token válido), gerando um novo `sid`/par de tokens para o
  tenant escolhido — não existe "um JWT com array de tenants", porque RBAC e escopo de unidade (`role`,
  `unit_id`s) são por `Membership`, e misturar isso em um único JWT tornaria o payload variável e difícil de
  checar com um guard simples.

**3. Registro de sessão (`sid`) server-side para permitir revogação — tabela `Session`, não denylist de
JWT:**

- Cada login/seleção de tenant bem-sucedida cria uma linha em `Session` (`id` = `sid`, `user_id`,
  `tenant_id`, `membership_id`, hash do refresh token atual, `created_at`, `expires_at`,
  `revoked_at` nullable, metadados leves de auditoria: IP e user-agent truncados — nunca o refresh token em
  texto plano).
- Segunda barreira: apesar de `User`, `Session` e `PasswordResetToken` serem tabelas globais (sem
  `tenant_id`), elas recebem política de RLS própria por `app.user_id` (mesmo padrão `SET LOCAL` já usado
  para `app.tenant_id`), para que um service que esqueça o filtro `WHERE user_id = ...` não vaze sessão/hash
  de token de outro usuário — detalhe de policy em `docs/plans/auth.md` §3.
- O access token carrega `sid`, mas **não é verificado contra o banco em todo request** (ficaria stateful e
  caro); em vez disso, cada refresh (`POST /auth/refresh`, a cada ~15 min de uso contínuo) confere se a
  `Session` ainda está `revoked_at IS NULL`. Isso é o motivo do "risco aceito" abaixo.
- `logout` marca a própria `Session` como revogada. `POST /auth/change-password` revoga todas as `Session`
  do `user_id` **exceto** a atual. `POST /auth/reset-password` (fluxo "esqueci senha") revoga **todas** as
  `Session` do `user_id`, sem exceção. Remover/desativar um `Membership` revoga todas as `Session` daquele
  `user_id` **com aquele `tenant_id`** (outras sessões do mesmo usuário em outros tenants continuam válidas).
- Escolhida uma **tabela de sessões** (não um JWT com `jti` em denylist no Redis) porque o projeto já tem
  Postgres como fonte de verdade transacional e esta tabela também guarda metadados úteis de auditoria
  básica (`docs/product/auth.md` §5.6) sem introduzir Redis como dependência adicional só para isto — Redis
  já existe no projeto (BullMQ), mas para filas, não como banco de sessão.

**4. Senha: argon2id.** Custo de memória/iterações como constante versionável (`backend-engineer` ajusta
conforme hardware de produção); nunca bcrypt/scrypt puro — argon2id é o vencedor atual da Password Hashing
Competition e já é a escolha registrada em `docs/ARCHITECTURE.md` §1.

**5. Tokens de convite e de redefinição de senha não usam JWT.** São strings aleatórias de 256 bits,
armazenadas com hash SHA-256 no banco (`Invitation.token_hash`, `PasswordResetToken.token_hash`), uso único,
conforme já registrado em `docs/product/auth.md` §8.7 — mantido aqui por serem parte do mesmo mecanismo de
sessão/credencial.

**6. Risco aceito (com exceção) — access token com claims desatualizadas por até 15 minutos.** Entre uma
mudança administrativa (troca de papel, mudança de unidades do membership) e o próximo refresh do token
afetado, o access token em uso continua validando requests com o `role`/`unit_id`s antigos (o acesso é só
revogado de fato — `401` forçado — nos casos de revogação explícita do item 3: logout, troca/reset de senha,
remoção de membership; uma simples alteração de papel/unidades **não** revoga a sessão, só expira naturalmente
em até 15 min). Para o MVP, essa janela é aceitável frente ao custo de verificar o banco em toda rota
autenticada — mas só nas rotas de leitura de alto volume (agenda, dashboard etc.). **Exceção**: nas rotas
administrativas de baixo volume que criam/alteram/removem convites, memberships ou unidades (ver
`docs/plans/auth.md` §2.2), o guard de RBAC consulta `Membership.isActive`/`role` atual no banco antes de
autorizar, fechando a janela exatamente onde a claim desatualizada teria mais impacto (ex.: um `MANAGER`
removido continuar removendo outros membros por até 15 min); o custo é desprezível dado o baixo volume
dessas rotas.

## Alternativas consideradas

- **Better Auth (ou outra lib de auth "tudo em um" para o ecossistema JS)**: reduziria código de
  boilerplate (hashing, refresh rotation, cookies), mas seu modelo de organização/multi-tenant não casa
  diretamente com `Membership` escopado por `Unit` + RLS via `SET LOCAL app.tenant_id` por transação Prisma;
  adaptar exigiria contornar boa parte do plugin de qualquer forma. Também adicionaria uma dependência nova
  e sua manutenção/atualização de segurança fora do nosso controle direto, para resolver um problema
  (login + refresh + hash de senha) que não é grande o suficiente para justificar o acoplamento, dado que o
  projeto já tem NestJS (guards, interceptors, DI) como ferramenta nativa para isso.
- **JWT 100% stateless, sem tabela de sessão (denylist em Redis por `jti`, TTL = tempo restante do token)**:
  mais simples e sem tabela nova, mas exige Redis como fonte de verdade de revogação (hoje só usado para
  filas) e não guarda nenhum metadado de sessão para auditoria/"ver meus dispositivos logados" (fora de
  escopo do MVP, mas que a tabela `Session` já deixa pronto para o backlog). Descartada porque o custo
  operacional de uma tabela Postgres é baixo e o projeto já paga esse custo para outras entidades.
- **Sessão 100% server-side (cookie com apenas um `session_id` opaco, sem JWT nenhum)**: simplifica
  revogação (sempre consulta o banco), mas adiciona uma consulta a mais em **todo** request autenticado,
  inclusive os de leitura mais frequentes (agenda, dashboard) — o JWT de 15 min existe justamente para
  evitar isso na maioria das requisições, pagando o preço do risco aceito do item 6.
- **JWT único contendo todos os tenants/memberships do usuário** (sem tela de seleção/troca): evitaria o
  fluxo de duas etapas no login com múltiplos vínculos, mas tornaria o payload do token variável em tamanho
  (um `PROFESSIONAL` freelancer pode crescer para N tenants) e obrigaria todo guard a primeiro descobrir
  "qual desses tenants é o atual" por outro meio (header extra, path param) — o que reabriria a porta para
  um `tenant_id` vindo de fora do token, violando a regra inegociável 1 do `CLAUDE.md`.

## Consequências

- Toda rota autenticada do `apps/api` precisa de um guard comum (`common/guards/jwt-auth.guard.ts` ou
  similar) que decodifica o JWT, popula um `RequestContext` (`user_id`, `tenant_id`, `membership_id`,
  `role`, `unit_id`s) e aciona `SET LOCAL app.tenant_id` na transação Prisma da request — nenhum
  controller/service lê `tenant_id` de outro lugar.
- É necessária a entidade `Session` no schema (ver `docs/plans/auth.md`), com um job (BullMQ, cron) de
  limpeza periódica de sessões expiradas/revogadas antigas (housekeeping, não crítico ao fluxo).
- O fluxo de login com múltiplos tenants exige dois endpoints em sequência (`/auth/login` +
  `/auth/select-tenant`) em vez de um único — custo de UX aceito, documentado em `docs/product/auth.md`
  §6.2.
- Qualquer mudança de papel/escopo de unidade só é garantida a valer em até 15 minutos nas rotas de leitura
  de alto volume (risco aceito, item 6); nas rotas administrativas listadas no item 6 (exceção), a garantia é
  imediata porque o guard confere o `Membership` no banco — isso deve ficar documentado também para o
  `qa-engineer` validar como comportamento esperado em cada caso, não bug.
- `User`, `Session` e `PasswordResetToken` (tabelas globais, sem `tenant_id`) ganham política de RLS própria
  por `app.user_id`, como segunda barreira equivalente à de `app.tenant_id` — não dependem só do filtro
  aplicado no service.
- Nenhuma dependência nova além do já previsto em `docs/ARCHITECTURE.md` (`argon2` como lib de hashing;
  `@nestjs/jwt` ou geração manual de JWT já cobertos pelo ecossistema Nest).

## O que mudaria esta decisão

- Necessidade real de "ver e encerrar sessões/dispositivos ativos" como feature de produto no MVP (hoje é
  só efeito colateral da tabela `Session`, não uma tela) — reforçaria a escolha atual, não a contradiria.
- Volume de usuários/tenants que torne a consulta de revogação no refresh um gargalo mensurável — motivaria
  mover a verificação de `Session` para Redis com TTL, mantendo a mesma semântica.
- Requisito de SSO/login social — exigiria revisar se vale a pena introduzir uma lib de auth com suporte a
  provedores OAuth prontos; hoje está fora de escopo (`docs/product/auth.md` §2).
- Evidência de que o risco aceito do item 6 é inaceitável na prática (ex.: incidente de segurança onde 15
  min de claim desatualizada importou) — motivaria reduzir o TTL do access token ou adicionar verificação
  de revogação a cada request para rotas sensíveis específicas.
