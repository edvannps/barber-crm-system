-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "street" VARCHAR(200),
    "number" VARCHAR(20),
    "complement" VARCHAR(100),
    "neighborhood" VARCHAR(100),
    "city" VARCHAR(100),
    "state" CHAR(2),
    "zip_code" VARCHAR(9),
    "cnpj" CHAR(14),
    "business_hours" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_units" (
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,

    CONSTRAINT "membership_units_pkey" PRIMARY KEY ("membership_id","unit_id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_units" (
    "tenant_id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,

    CONSTRAINT "invitation_units_pkey" PRIMARY KEY ("invitation_id","unit_id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "user_agent" VARCHAR(255),
    "ip_truncated" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "units_tenant_id_id_key" ON "units"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_id_user_id_key" ON "memberships"("tenant_id", "id", "user_id");

-- CreateIndex
CREATE INDEX "membership_units_tenant_id_unit_id_idx" ON "membership_units"("tenant_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "invitations_status_expires_at_idx" ON "invitations"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tenant_id_id_key" ON "invitations"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "invitation_units_tenant_id_unit_id_idx" ON "invitation_units"("tenant_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_tenant_id_idx" ON "sessions"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_membership_id_idx" ON "sessions"("tenant_id", "membership_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_units" ADD CONSTRAINT "membership_units_tenant_id_membership_id_fkey" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_units" ADD CONSTRAINT "membership_units_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "units"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_invited_by_id_fkey" FOREIGN KEY ("tenant_id", "invited_by_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_units" ADD CONSTRAINT "invitation_units_tenant_id_invitation_id_fkey" FOREIGN KEY ("tenant_id", "invitation_id") REFERENCES "invitations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_units" ADD CONSTRAINT "invitation_units_tenant_id_unit_id_fkey" FOREIGN KEY ("tenant_id", "unit_id") REFERENCES "units"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_membership_id_user_id_fkey" FOREIGN KEY ("tenant_id", "membership_id", "user_id") REFERENCES "memberships"("tenant_id", "id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- PARTE MANUAL (database-engineer) — não gerada pelo Prisma.
-- CHECKs, índices funcionais/parciais, role da aplicação e Row-Level Security.
-- Estratégia completa documentada em docs/database.md.
-- Obs.: gen_random_uuid() é nativo no PG13+ e os ids são UUID v7 gerados pela aplicação
-- (@default(uuid(7))), então a extensão pgcrypto não é necessária.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Integridade: CHECK constraints
-- ---------------------------------------------------------------------------

-- role/status como texto + CHECK (decisão ADR 0002 / docs/plans/auth.md §3): evita ALTER TYPE por papel novo.
-- Valores espelham MEMBERSHIP_ROLES e INVITATION_STATUSES de packages/shared/src/enums.ts.
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_check"
  CHECK ("role" IN ('OWNER', 'MANAGER', 'RECEPTION', 'PROFESSIONAL'));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_check"
  CHECK ("role" IN ('OWNER', 'MANAGER', 'RECEPTION', 'PROFESSIONAL'));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_status_check"
  CHECK ("status" IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'));

-- E-mails sempre normalizados (o emailSchema do Zod já faz trim+lowercase; o banco garante).
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_lowercase_check" CHECK ("email" = lower("email"));

-- Hashes sempre sha-256 em hex minúsculo (64 chars) — evita gravar o token em claro por engano.
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_token_hash_format_check"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_hash_format_check"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_refresh_token_hash_format_check"
  CHECK ("refresh_token_hash" ~ '^[0-9a-f]{64}$');

-- Formato básico de campos da unidade (validação completa fica no Zod).
ALTER TABLE "units" ADD CONSTRAINT "units_business_hours_shape_check"
  CHECK (jsonb_typeof("business_hours") = 'array' AND jsonb_array_length("business_hours") = 7);
ALTER TABLE "units" ADD CONSTRAINT "units_cnpj_format_check" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9]{14}$');
ALTER TABLE "units" ADD CONSTRAINT "units_state_format_check" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$');

-- ---------------------------------------------------------------------------
-- 2. Índices manuais
-- ---------------------------------------------------------------------------

-- Unicidade de e-mail case-insensitive (obrigatória pelo plano). Redundante com users_email_key enquanto o
-- CHECK de lowercase existir, mas é a garantia definitiva e é o índice usado pela policy de lookup de login.
-- Tabelas vazias nesta migration: CREATE INDEX comum (sem CONCURRENTLY) não gera lock relevante.
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" (lower("email"));

-- No máximo 1 convite PENDING por (tenant, e-mail) → API responde 409 "use resend".
-- Atenção: convite vencido continua PENDING até o housekeeping/serviço marcá-lo como EXPIRED.
CREATE UNIQUE INDEX "invitations_tenant_id_email_pending_key"
  ON "invitations" ("tenant_id", "email") WHERE "status" = 'PENDING';

-- ---------------------------------------------------------------------------
-- 3. Funções auxiliares de contexto (lidas pelas policies)
-- ---------------------------------------------------------------------------
-- A aplicação popula, por transação: SELECT set_config('app.tenant_id', $1, true) (= SET LOCAL).
-- nullif(..., '') é necessário: depois que um GUC customizado é definido uma vez na conexão (pool), lê-lo
-- fora daquela transação devolve '' (não NULL), e ''::uuid lançaria erro em vez de simplesmente negar acesso.
-- STABLE + LANGUAGE sql → inlined pelo planner; "tenant_id = app_current_tenant_id()" usa índice normalmente.

CREATE FUNCTION app_setting(name text) RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting(name, true), '') $$;

CREATE FUNCTION app_current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

CREATE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- ---------------------------------------------------------------------------
-- 4. Role da aplicação (não-owner das tabelas → sujeita a RLS)
-- ---------------------------------------------------------------------------
-- barber_app é NOLOGIN: o usuário de conexão da API (definido por devops, com senha fora do repositório)
-- recebe "GRANT barber_app TO <login>". O role dono das tabelas (o que roda migrations/seed/jobs de
-- housekeeping) não tem FORCE ROW LEVEL SECURITY e portanto ignora RLS — por isso a API NUNCA deve
-- conectar com ele. Superusuário também ignora RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'barber_app') THEN
    CREATE ROLE barber_app NOLOGIN;
  END IF;
END
$$;

-- !!! REGRA PARA TODA MIGRATION FUTURA (achado Alta 2 do security-reviewer) !!!
-- NUNCA usar "ALTER DEFAULT PRIVILEGES ... GRANT ... TO barber_app". Default privileges fazem toda tabela nova
-- (de qualquer feature) nascer com DML liberado para a API e SEM RLS — se a migration esquecer a policy, os
-- dados vazam entre tenants em silêncio. Cada migration que cria tabela de negócio deve, na MESMA migration:
--   1) ALTER TABLE ... ENABLE ROW LEVEL SECURITY + CREATE POLICY (tenant_id = app_current_tenant_id());
--   2) GRANT explícito só dos privilégios necessários (em geral SELECT, INSERT, UPDATE — DELETE só se a
--      tabela não for soft delete), como feito abaixo.
-- Sem o GRANT, a API recebe "permission denied" (falha fechada e barulhenta) em vez de vazar dados.

GRANT USAGE ON SCHEMA public TO barber_app;

-- Soft delete (is_active / revoked_at / used_at / status): a API nunca apaga linha destas tabelas
-- (achado Média 3). Limpeza física de sessões/tokens expirados é job de housekeeping rodando como dono.
GRANT SELECT, INSERT, UPDATE ON "tenants", "units", "invitations", "password_reset_tokens" TO barber_app;

-- memberships: vínculo (tenant_id, user_id) é imutável para a API — só papel e status mudam.
GRANT SELECT, INSERT ON "memberships" TO barber_app;
GRANT UPDATE ("role", "is_active", "updated_at") ON "memberships" TO barber_app;

-- sessions: user_id/tenant_id/membership_id imutáveis após o INSERT. Sem isso, a policy tenant_sessions_revoke
-- (UPDATE de sessões do tenant corrente) permitiria a um membro "transferir" a própria sessão para a
-- membership de outro usuário do tenant (variante por UPDATE do achado Alta 1). Rotação de refresh e
-- revogação só precisam destas colunas.
GRANT SELECT, INSERT ON "sessions" TO barber_app;
GRANT UPDATE ("refresh_token_hash", "expires_at", "revoked_at") ON "sessions" TO barber_app;

-- membership_units/invitation_units: o escopo de unidades é recriado (DELETE + INSERT) quando muda — DELETE
-- real é esperado aqui.
GRANT SELECT, INSERT, UPDATE, DELETE ON "membership_units", "invitation_units" TO barber_app;

-- users: SEM SELECT em password_hash (achado Média 5). Grant de coluna é controle de banco: um
-- "include: { user: true }" ou RETURNING * do Prisma falha com "permission denied" em vez de vazar o hash.
-- INSERT/UPDATE de password_hash continuam permitidos (signup, troca/reset de senha); a leitura do hash para
-- o login é feita SÓ pela função SECURITY DEFINER auth_lookup_credentials (seção 6).
-- Consequência para o backend: create/update de User devem usar select/omit sem passwordHash (sugestão:
-- PrismaClient com omit global { user: { passwordHash: true } } na conexão da API).
GRANT SELECT ("id", "name", "email", "created_at", "updated_at") ON "users" TO barber_app;
GRANT INSERT, UPDATE ON "users" TO barber_app;

GRANT EXECUTE ON FUNCTION app_setting(text), app_current_tenant_id(), app_current_user_id() TO barber_app;

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security
-- ---------------------------------------------------------------------------
-- Policies PERMISSIVE de uma mesma tabela são combinadas com OR. Sem nenhum contexto setado, todas as
-- funções acima retornam NULL e nenhuma linha é visível (fail-closed).
-- Policies que consultam outra tabela (EXISTS) estão sujeitas ao RLS dessa outra tabela — isso é intencional
-- e é o que limita, por exemplo, users visíveis aos membros do tenant corrente.

ALTER TABLE "tenants"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "units"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_units"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitation_units"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;

-- 5.1 Dimensão tenant (app.tenant_id) ---------------------------------------

CREATE POLICY tenant_isolation ON "units"
  USING ("tenant_id" = app_current_tenant_id()) WITH CHECK ("tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation ON "memberships"
  USING ("tenant_id" = app_current_tenant_id()) WITH CHECK ("tenant_id" = app_current_tenant_id());
-- membership_units/invitation_units: tenant_id duplicado (não via join) → policy simples e indexável, e as
-- FKs compostas (tenant_id, membership_id|invitation_id|unit_id) garantem que o tenant_id duplicado é coerente.
CREATE POLICY tenant_isolation ON "membership_units"
  USING ("tenant_id" = app_current_tenant_id()) WITH CHECK ("tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation ON "invitations"
  USING ("tenant_id" = app_current_tenant_id()) WITH CHECK ("tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation ON "invitation_units"
  USING ("tenant_id" = app_current_tenant_id()) WITH CHECK ("tenant_id" = app_current_tenant_id());

-- tenants é a raiz (sem tenant_id), mas recebe RLS pelo próprio id: o plano só a excluía da policy
-- "tenant_id = ...". Signup/POST /tenants: a aplicação gera o id do tenant novo e faz
-- set_config('app.tenant_id', <novo id>, true) ANTES do INSERT.
CREATE POLICY tenant_self ON "tenants"
  USING ("id" = app_current_tenant_id()) WITH CHECK ("id" = app_current_tenant_id());

-- 5.2 Dimensão usuário (app.user_id) ----------------------------------------

CREATE POLICY user_self ON "users"
  USING ("id" = app_current_user_id()) WITH CHECK ("id" = app_current_user_id());
CREATE POLICY user_self ON "sessions"
  USING ("user_id" = app_current_user_id()) WITH CHECK ("user_id" = app_current_user_id());
CREATE POLICY user_self ON "password_reset_tokens"
  USING ("user_id" = app_current_user_id()) WITH CHECK ("user_id" = app_current_user_id());

-- Login / seleção de tenant (antes de haver app.tenant_id): o usuário enxerga as PRÓPRIAS memberships em
-- todos os tenants, os vínculos de unidade delas, as unidades vinculadas e o nome dos tenants. Só leitura.
CREATE POLICY user_own_memberships ON "memberships" FOR SELECT
  USING ("user_id" = app_current_user_id());
CREATE POLICY user_own_membership_units ON "membership_units" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "memberships" m
                 WHERE m."id" = "membership_units"."membership_id"
                   AND m."user_id" = app_current_user_id()));
CREATE POLICY user_own_units ON "units" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "membership_units" mu
                 JOIN "memberships" m ON m."id" = mu."membership_id"
                 WHERE mu."tenant_id" = "units"."tenant_id" AND mu."unit_id" = "units"."id"
                   AND m."user_id" = app_current_user_id()));
CREATE POLICY user_own_tenants ON "tenants" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "memberships" m
                 WHERE m."tenant_id" = "tenants"."id" AND m."user_id" = app_current_user_id()));

-- 5.3 Cruzamentos tenant × usuário (necessários para as telas de equipe) ----

-- GET /memberships precisa de nome/e-mail dos membros do tenant corrente. A subquery em memberships passa
-- pelo RLS de memberships, logo só expõe users com membership no tenant de app.tenant_id.
-- password_hash não é legível por barber_app em nenhuma linha (grant de coluna da seção 4).
CREATE POLICY tenant_members ON "users" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "memberships" m
                 WHERE m."user_id" = "users"."id" AND m."tenant_id" = app_current_tenant_id()));

-- DELETE/PATCH /memberships/:id revoga sessões do membro afetado (outro user_id) dentro do tenant corrente.
-- UPDATE com WHERE exige também visibilidade via SELECT, por isso as duas policies.
CREATE POLICY tenant_sessions_read ON "sessions" FOR SELECT
  USING ("tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_sessions_revoke ON "sessions" FOR UPDATE
  USING ("tenant_id" = app_current_tenant_id()) WITH CHECK ("tenant_id" = app_current_tenant_id());

-- 5.4 Lookups públicos pré-autenticação (achado de segurança 3 do plano) ----
--
-- Por que não "FOR SELECT USING (true)" nem uma policy sem contexto: uma policy é avaliada linha a linha e
-- NÃO enxerga o WHERE da query. Uma policy que não dependa de nada da sessão só pode olhar colunas da
-- própria linha (ex.: status = 'PENDING'), o que exporia TODOS os convites pendentes/tokens a qualquer query
-- sem filtro — exatamente o bug que o RLS deveria conter. "Garantir que a aplicação sempre faça
-- WHERE token_hash = $1" é a primeira barreira, não a segunda.
--
-- Decisão: a "capacidade" de leitura é o próprio hash do token secreto, passado como GUC de transação:
--     SELECT set_config('app.invitation_token_hash', $1, true);   -- $1 = sha256(token) em hex
--     SELECT ... FROM invitations WHERE token_hash = $1 LIMIT 1;
-- A policy torna visível NO MÁXIMO a linha cujo token_hash é igual ao da GUC (token_hash é UNIQUE), mesmo que
-- o service esqueça o WHERE. Só SELECT: UPDATE/DELETE continuam exigindo app.tenant_id/app.user_id. Após o
-- lookup, a aplicação seta app.tenant_id = invitation.tenant_id (ou app.user_id = token.user_id) — valor
-- vindo de linha do banco casada por token secreto, nunca do body — e segue pelas policies normais
-- (marcar convite ACCEPTED, criar membership, ler nomes de unidades/tenant, marcar token usado, trocar senha).
-- Sem a GUC (NULL), a comparação é NULL → nenhuma linha.
CREATE POLICY token_lookup ON "invitations" FOR SELECT
  USING ("token_hash" = app_setting('app.invitation_token_hash'));
CREATE POLICY token_lookup ON "password_reset_tokens" FOR SELECT
  USING ("token_hash" = app_setting('app.reset_token_hash'));
-- Mesmo problema existe em POST /auth/refresh (só há o cookie, sem user_id ainda): mesmo padrão.
CREATE POLICY token_lookup ON "sessions" FOR SELECT
  USING ("refresh_token_hash" = app_setting('app.refresh_token_hash'));
-- Lookup de User por e-mail (login, forgot-password, signup, aceite de convite) NÃO tem policy: a policy
-- email_lookup (GUC app.lookup_email) foi removida e substituída pelas funções SECURITY DEFINER da seção 6.
-- O e-mail não é segredo (qualquer um pode tentar um e-mail), então como "capacidade" ele não protegia nada
-- além do limite de 1 linha; as funções devolvem o mínimo (id e, só no login, o hash).

-- ---------------------------------------------------------------------------
-- 6. Funções SECURITY DEFINER de autenticação (achado Média 5)
-- ---------------------------------------------------------------------------
-- Rodam com o privilégio do dono das tabelas (ignoram RLS e o grant de coluna), por isso:
--   - search_path fixo (pg_catalog, pg_temp) + nomes qualificados com "public." → sem sequestro de search_path;
--   - REVOKE EXECUTE de PUBLIC (o padrão do Postgres é qualquer role poder executar) e GRANT só a barber_app;
--   - devolvem no máximo 1 linha, casada pelo índice único users_email_lower_idx.
-- Depois do lookup, a aplicação faz set_config('app.user_id', <user_id devolvido>, true) e segue pelas
-- policies normais (user_self, user_own_*).

-- POST /auth/login: única forma de barber_app ler password_hash.
CREATE FUNCTION auth_lookup_credentials(p_email text)
  RETURNS TABLE (user_id uuid, password_hash text)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
    SELECT u."id", u."password_hash" FROM public."users" u
    WHERE lower(u."email") = lower(p_email)
    LIMIT 1
  $$;

-- forgot-password, signup ("e-mail em uso"), aceite de convite (usuário já existe?): só o id, nunca o hash.
CREATE FUNCTION auth_find_user_id_by_email(p_email text)
  RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $$
    SELECT u."id" FROM public."users" u
    WHERE lower(u."email") = lower(p_email)
    LIMIT 1
  $$;

REVOKE EXECUTE ON FUNCTION auth_lookup_credentials(text), auth_find_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_credentials(text), auth_find_user_id_by_email(text) TO barber_app;
