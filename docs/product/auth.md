# Autenticação, Tenants, Unidades e Memberships

> Autor: `product-analyst` · Status: **proposta para validação do `tech-lead`** · Fase: MVP (primeira feature)
> Entidades de referência: `docs/ARCHITECTURE.md` (§4 Domínio) e `docs/RESEARCH.md` (§2 Entidades observadas).

## 1. Visão geral

Esta é a feature fundacional do produto: sem ela nenhuma outra existe. Ela cobre:

- **Cadastro do dono** da barbearia/salão (signup) — cria o `Tenant` (a empresa) e a primeira `Unit`.
- **Login** e sessão de usuários da equipe (dono, gerente, recepção, profissional).
- **Convite de membros** da equipe com papel (`role`) e unidade(s) de atuação.
- **Gestão de unidades** (filiais): nome, fuso horário, horário de funcionamento.
- **Troca de senha** (usuário autenticado) e **recuperação de senha** (usuário deslogado).

Público-alvo: usuários **internos** da barbearia (equipe). O cliente final (quem agenda um horário) **não
tem login neste MVP** — ele é cadastrado como `Client` pela equipe ou via agendamento online público, sem
conta própria. Autenticação de cliente final fica fora de escopo aqui (ver §2).

## 2. Escopo

### Dentro do MVP (esta feature)

- Signup com criação automática de `Tenant` + `Unit` padrão + `User` + `Membership(OWNER)`.
- Login com e-mail/senha, emissão de sessão (access token curto + refresh token rotativo, conforme ADR de
  stack) e logout.
- Convite por e-mail de novo membro com papel e unidade(s); aceite do convite (usuário novo ou já existente).
- CRUD de `Unit`: nome, fuso horário (IANA), horário de funcionamento (por dia da semana), status
  ativa/inativa.
- Gestão de `Membership`: listar membros, alterar papel, (des)ativar/remover membro, reenviar/cancelar
  convite pendente.
- Troca de senha autenticada e fluxo "esqueci minha senha" (token por e-mail, expiração).
- Regras de RBAC por papel (quem pode convidar, gerenciar unidades, etc.) descritas em §4.

### Fora de escopo (outras features/fases)

- Login/autoatendimento do **cliente final** (portal do cliente) — fase 3 (app do cliente).
- Login social/SSO (Google, etc.) e 2FA — não mencionados no `ARCHITECTURE.md`; avaliar depois se necessário.
- `Professional` enquanto entidade de agenda (cor, comissão padrão, `partner_type`, `WorkingHours` por
  profissional) — é uma feature separada ("profissionais e horários") que **referencia** o `User`/`Membership`
  criado aqui, mas não é modelada neste documento.
- Billing do próprio SaaS (planos, limites de unidades/usuários por plano, cobrança) — mencionado em
  `ARCHITECTURE.md` como preocupação futura ("billing do SaaS separado do billing dos tenants").
- Auditoria/log de segurança detalhado, bloqueio de conta por tentativas de login (ver nota em §6.8 — fica
  como requisito levantado, detalhamento é do `security-reviewer`/`tech-lead`).

## 3. Glossário

| Termo                | Definição                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant**           | A empresa cliente do SaaS (a rede de barbearias/salão). Isola todos os dados de negócio.                                                                                                                      |
| **Unit**             | Uma unidade física/filial do tenant. Tem fuso horário e horário de funcionamento próprios.                                                                                                                    |
| **User**             | Identidade de login **global** (e-mail + senha), independente de tenant. Uma mesma pessoa pode ter `Membership` em mais de um tenant (ex.: profissional freelancer que atende em duas barbearias diferentes). |
| **Membership**       | Vínculo entre um `User` e um `Tenant`, com um `role` e a lista de `Unit`(s) em que atua.                                                                                                                      |
| **role**             | `OWNER`, `MANAGER`, `RECEPTION` ou `PROFESSIONAL` (`packages/shared/src/enums.ts`, `MEMBERSHIP_ROLES`).                                                                                                       |
| **Convite (Invite)** | Registro temporário (e-mail + role + unidade(s) + token + validade) criado por quem convida; vira `Membership` quando aceito.                                                                                 |

## 4. Papéis e permissões (RBAC)

| Ação                                                         |   OWNER    |   MANAGER    | RECEPTION | PROFESSIONAL |
| ------------------------------------------------------------ | :--------: | :----------: | :-------: | :----------: |
| Fazer login / trocar a própria senha                         |     ✅     |      ✅      |    ✅     |      ✅      |
| Ver/editar a própria unidade (horário de funcionamento etc.) | ✅ (todas) | ✅ (as suas) |    ❌     |      ❌      |
| Criar/editar/inativar `Unit`                                 |     ✅     |     ❌ ¹     |    ❌     |      ❌      |
| Convidar `MANAGER`, `RECEPTION` ou `PROFESSIONAL`            |     ✅     |     ✅ ²     |    ❌     |      ❌      |
| Convidar outro `OWNER`                                       |     ✅     |      ❌      |    ❌     |      ❌      |
| Alterar papel de um membro existente                         |     ✅     |     ✅ ²     |    ❌     |      ❌      |
| Remover/desativar membro                                     |     ✅     |     ✅ ²     |    ❌     |      ❌      |
| Remover/rebaixar o **último** `OWNER` do tenant              |     ❌     |      ❌      |    ❌     |      ❌      |

¹ Aberto para validação do `tech-lead`: ver pergunta em §7 sobre `MANAGER` poder criar unidades (cenário de
rede em expansão) — proposta inicial é **não** permitir no MVP, só `OWNER`.
² `MANAGER` só convida/gerencia `RECEPTION` e `PROFESSIONAL`, e só em unidades às quais ele mesmo tem acesso
(não pode convidar para uma unidade em que não atua).

Regra transversal: **todo tenant precisa ter pelo menos 1 `OWNER` ativo em todo momento.**

## 5. Regras de negócio transversais

1. **E-mail é identificador global do `User`**, único no sistema (case-insensitive). Um mesmo e-mail nunca
   gera dois `User`; convites para um e-mail já existente **anexam** um novo `Membership` ao `User` existente
   (ver fluxo de convite, §6.3).
2. **Tenant sempre nasce com exatamente 1 `Unit` padrão** no signup (nome = nome da barbearia informado,
   timezone padrão `America/Sao_Paulo`, horário de funcionamento padrão a definir com `ui-ux-designer`/
   `tech-lead` — sugestão: seg–sáb 09:00–19:00, domingo fechado).
3. Um `Membership` tem 1 `role` e 1+ `Unit`(s) associadas, exceto `OWNER`, que sempre enxerga/atua em
   **todas** as unidades do tenant (inclusive as criadas depois do convite).
4. Convite tem **validade de 7 dias** (sugestão — confirmar com `tech-lead`) a partir do envio; reenviar
   convite gera novo token e nova validade, invalidando o anterior.
5. Senha: regras mínimas de complexidade (sugestão: 8+ caracteres) ficam a cargo do `tech-lead`/
   `security-reviewer`; armazenamento seguro é requisito não-funcional, não decisão de produto.
6. Toda ação administrativa sensível (convite, alteração de papel, remoção de membro, desativação de
   unidade) deve ficar registrada para fins de auditoria básica (quem fez, quando) — detalhamento técnico
   fica com `tech-lead`/`database-engineer`.
7. LGPD: o e-mail do convidado é dado pessoal mínimo necessário à operação (constituição de vínculo
   trabalhista/contratual), não depende de consentimento de marketing.

## 6. User stories e critérios de aceite

### 6.1 Epic: Cadastro inicial (signup cria tenant + unit)

**US-01** — Como **visitante que vai abrir uma barbearia no sistema**, quero **me cadastrar informando meus
dados e o nome do meu negócio**, para **começar a usar o CRM imediatamente, já com minha primeira unidade
criada**.

```gherkin
Funcionalidade: Signup cria tenant, unit padrão e membership OWNER

  Cenário: Primeiro acesso bem-sucedido
    Dado que não existe nenhum usuário com o e-mail "ana@barbearia.com"
    Quando "Ana" se cadastra informando nome "Ana Souza", e-mail "ana@barbearia.com",
      senha válida e nome do negócio "Barbearia do Ana"
    Então um novo Tenant "Barbearia do Ana" é criado
    E uma Unit padrão é criada vinculada a esse Tenant, com timezone "America/Sao_Paulo"
      e horário de funcionamento padrão
    E um User é criado com e-mail "ana@barbearia.com"
    E um Membership com role "OWNER" é criado vinculando esse User a esse Tenant,
      com acesso a todas as unidades
    E Ana recebe uma sessão autenticada (está logada) ao final do cadastro

  Cenário: E-mail duplicado no signup
    Dado que já existe um User com e-mail "ana@barbearia.com"
    Quando alguém tenta se cadastrar (criar um novo Tenant) usando o e-mail "ana@barbearia.com"
    Então o sistema rejeita o cadastro com uma mensagem indicando que o e-mail já está em uso
    E nenhum Tenant, Unit ou Membership novo é criado
    E o sistema sugere fazer login ou recuperar a senha

  Cenário: Campos obrigatórios ausentes
    Quando alguém tenta se cadastrar sem informar nome do negócio
    Então o sistema rejeita o cadastro e indica quais campos são obrigatórios
    E nenhum dado é persistido
```

> **Observação de produto**: diferente do convite (§6.3), o signup **sempre** exige e-mail inédito — ele cria
> um novo `Tenant`. Uma pessoa que já é `User` (porque é `PROFESSIONAL` convidado em outro tenant) e quer
> abrir **sua própria** barbearia precisa de um fluxo de "criar novo negócio com minha conta existente"
> — ver pergunta em aberto §7.

### 6.2 Epic: Login e sessão

**US-02** — Como **membro da equipe (qualquer papel)**, quero **fazer login com e-mail e senha**, para
**acessar o painel da(s) barbearia(s) em que trabalho**.

```gherkin
Funcionalidade: Login

  Cenário: Login bem-sucedido com um único vínculo
    Dado que "Carlos" tem um User ativo e um único Membership (Tenant "Barbearia do Ana", role "RECEPTION",
      Unit "Unidade Centro")
    Quando Carlos faz login com e-mail e senha corretos
    Então ele recebe uma sessão autenticada
    E é direcionado diretamente ao painel do Tenant "Barbearia do Ana", Unit "Unidade Centro"

  Cenário: Login de usuário com vínculos em mais de um tenant
    Dado que "Marcos" (profissional freelancer) tem Membership ativo em "Barbearia do Ana" e em
      "Studio Capilar"
    Quando Marcos faz login com e-mail e senha corretos
    Então ele vê uma tela de seleção de tenant/unidade antes de entrar no painel

  Cenário: Senha incorreta
    Dado que "Carlos" tem um User ativo
    Quando Carlos tenta logar com a senha errada
    Então o sistema recusa o login com mensagem genérica ("e-mail ou senha inválidos")
    E não informa se o e-mail existe ou não (evitar enumeração de usuários)

  Cenário: Login sem nenhuma unidade/vínculo ativo
    Dado que "Pedro" tem um User válido, mas todos os seus Memberships estão desativados
      (ex.: foi removido da equipe de todas as barbearias em que atuava)
    Quando Pedro faz login com e-mail e senha corretos
    Então a autenticação de credenciais é aceita
    E Pedro vê uma mensagem informando que não tem acesso a nenhuma barbearia no momento
    E é orientado a pedir um novo convite ao responsável, ou a cadastrar seu próprio negócio (ir ao signup)
    E nenhum painel de dados de negócio é exibido

  Cenário: Login em unidade desativada
    Dado que "Carlos" só tem Membership na Unit "Unidade Centro"
    E essa Unit foi desativada pelo OWNER
    Quando Carlos faz login
    Então o sistema informa que a unidade está temporariamente inativa
    E não concede acesso ao painel de operação daquela unidade
    E orienta Carlos a contatar o responsável da barbearia

  Cenário: Logout
    Dado que Carlos está com sessão ativa
    Quando Carlos solicita logout
    Então sua sessão (access e refresh token) é invalidada
    E uma nova tentativa de uso do token antigo é recusada
```

### 6.3 Epic: Convite de membros

**US-03** — Como **OWNER ou MANAGER**, quero **convidar uma pessoa da equipe por e-mail, definindo seu papel
e a(s) unidade(s) em que vai atuar**, para **dar acesso ao sistema sem que ela precise se cadastrar do
zero**.

```gherkin
Funcionalidade: Convidar membro

  Cenário: Convite de uma pessoa nova no sistema
    Dado que "Ana" (OWNER) está autenticada no Tenant "Barbearia do Ana"
    E não existe nenhum User com e-mail "joao@email.com"
    Quando Ana convida "joao@email.com" com role "PROFESSIONAL" para a Unit "Unidade Centro"
    Então um convite pendente é criado com validade de 7 dias
    E um e-mail é enviado a "joao@email.com" com um link único de aceite
    E nenhum User nem Membership é criado ainda (só existirão após o aceite)

  Cenário: Convite de pessoa que já é User em outro tenant
    Dado que "joao@email.com" já é User (tem Membership como PROFESSIONAL em "Studio Capilar")
    Quando Ana convida "joao@email.com" com role "PROFESSIONAL" para a Unit "Unidade Centro" de
      "Barbearia do Ana"
    Então um convite pendente é criado associado ao User existente de João
    E João recebe e-mail de convite podendo aceitar com a senha que já possui (não precisa criar nova senha)

  Cenário: E-mail já é membro ativo do mesmo tenant
    Dado que "joao@email.com" já tem Membership ativo em "Barbearia do Ana"
    Quando Ana tenta convidar "joao@email.com" novamente para o mesmo Tenant
    Então o sistema rejeita o convite informando que a pessoa já é membro
    E sugere editar o papel/unidades do membro existente em vez de reconvidar

  Cenário: Convite duplicado pendente
    Dado que já existe um convite pendente (não expirado) para "joao@email.com" em "Barbearia do Ana"
    Quando Ana convida "joao@email.com" novamente antes do aceite
    Então o sistema não cria um segundo convite
    E oferece a opção "reenviar convite", que gera novo token e nova validade de 7 dias,
      invalidando o link anterior

  Cenário: RECEPTION tenta convidar alguém
    Dado que "Carlos" está autenticado com role "RECEPTION"
    Quando Carlos tenta acessar a função de convidar membros
    Então o sistema nega a ação por falta de permissão (RBAC)

  Cenário: MANAGER tenta convidar um OWNER
    Dado que "Beatriz" está autenticada com role "MANAGER" em "Barbearia do Ana"
    Quando Beatriz tenta convidar alguém com role "OWNER"
    Então o sistema nega a ação por falta de permissão
    E informa que só um OWNER pode convidar outro OWNER

  Cenário: MANAGER convida para unidade em que não atua
    Dado que "Beatriz" (MANAGER) só tem acesso à Unit "Unidade Centro"
    E o Tenant também tem a Unit "Unidade Zona Sul"
    Quando Beatriz tenta convidar alguém para a Unit "Unidade Zona Sul"
    Então o sistema nega a ação por falta de permissão sobre aquela unidade

  Cenário: Convite sem unidade selecionada
    Dado que Ana (OWNER) está convidando um novo membro com role "RECEPTION" ou "PROFESSIONAL"
    Quando Ana tenta enviar o convite sem selecionar nenhuma Unit
    Então o sistema rejeita e exige ao menos 1 unidade
```

### 6.4 Epic: Aceite de convite

**US-04** — Como **pessoa convidada**, quero **aceitar o convite recebido por e-mail**, para **passar a ter
acesso ao painel da barbearia com o papel e a(s) unidade(s) definidos**.

```gherkin
Funcionalidade: Aceitar convite

  Cenário: Aceite por pessoa nova (cria senha)
    Dado que "joao@email.com" recebeu um convite válido (não expirado, não usado) para "Barbearia do Ana"
    E não existe User prévio com esse e-mail
    Quando João abre o link do convite e define uma senha
    Então um novo User é criado para "joao@email.com"
    E um Membership com o role e unidade(s) definidos no convite é criado, vinculando o novo User
    E o convite passa para o status "aceito" e não pode mais ser usado
    E João é autenticado automaticamente no painel

  Cenário: Aceite por pessoa que já é User (login para confirmar)
    Dado que "joao@email.com" já é User (tem Membership em outro tenant)
    E recebeu um convite válido para "Barbearia do Ana"
    Quando João abre o link do convite
    Então o sistema pede que ele faça login com sua senha existente para confirmar identidade
    E, após login bem-sucedido, um novo Membership é criado vinculando o User existente ao novo Tenant
    E o convite passa para o status "aceito"

  Cenário: Convite expirado
    Dado que um convite para "joao@email.com" foi enviado há mais de 7 dias e não foi aceito
    Quando João tenta abrir o link do convite
    Então o sistema informa que o convite expirou
    E nenhum User/Membership é criado
    E orienta João a pedir um novo convite a quem o convidou

  Cenário: Convite já utilizado
    Dado que um convite para "joao@email.com" já foi aceito anteriormente
    Quando alguém tenta reutilizar o mesmo link de convite
    Então o sistema informa que o convite já foi usado e não é mais válido

  Cenário: Convite revogado pelo convidante antes do aceite
    Dado que Ana (OWNER) cancelou um convite pendente para "joao@email.com"
    Quando João tenta abrir o link do convite cancelado
    Então o sistema informa que o convite não é mais válido
```

### 6.5 Epic: Gestão de membros (papéis e remoção)

**US-05** — Como **OWNER**, quero **ver todos os membros da minha barbearia, alterar seus papéis/unidades ou
removê-los**, para **manter a equipe e os acessos atualizados**.

```gherkin
Funcionalidade: Gerenciar membros existentes

  Cenário: Listar membros
    Dado que Ana (OWNER) está autenticada em "Barbearia do Ana"
    Quando ela acessa a tela de equipe
    Então vê todos os Memberships do Tenant com nome, e-mail, role, unidade(s) e status
      (ativo / convite pendente)

  Cenário: Alterar o papel de um membro
    Dado que "Beatriz" tem Membership com role "RECEPTION"
    Quando Ana (OWNER) altera o papel de Beatriz para "MANAGER"
    Então o Membership de Beatriz passa a ter role "MANAGER"
    E, no próximo acesso de Beatriz (ou em tempo real, a depender da sessão), as novas permissões passam
      a valer

  Cenário: Remover membro
    Dado que "Beatriz" tem Membership ativo em "Barbearia do Ana"
    Quando Ana (OWNER) remove Beatriz da equipe
    Então o Membership de Beatriz é desativado (não apagado, por rastreabilidade)
    E sessões ativas de Beatriz para esse Tenant são invalidadas
    E Beatriz não consegue mais acessar dados de "Barbearia do Ana"

  Cenário: Tentar remover o último OWNER
    Dado que "Ana" é a única pessoa com role "OWNER" ativo em "Barbearia do Ana"
    Quando alguém tenta remover o Membership de Ana ou rebaixar seu papel
    Então o sistema recusa a ação
    E informa que o tenant precisa ter sempre ao menos 1 OWNER ativo

  Cenário: MANAGER tenta remover ou rebaixar um OWNER
    Dado que "Beatriz" (MANAGER) está vendo a lista de membros, incluindo Ana (OWNER)
    Quando Beatriz tenta remover ou alterar o papel de Ana
    Então o sistema nega a ação por falta de permissão

  Cenário: Cancelar convite pendente
    Dado que existe um convite pendente (ainda não aceito) para "joao@email.com"
    Quando Ana (OWNER) cancela esse convite na tela de equipe
    Então o convite é invalidado
    E o link enviado por e-mail deixa de funcionar
```

### 6.6 Epic: Gestão de unidades

**US-06** — Como **OWNER**, quero **cadastrar e editar as unidades (filiais) da minha barbearia, com nome,
fuso horário e horário de funcionamento**, para **organizar a operação de cada endereço físico
separadamente**.

```gherkin
Funcionalidade: Gerenciar unidades

  Cenário: Criar uma nova unidade
    Dado que Ana (OWNER) está autenticada em "Barbearia do Ana", que já tem a Unit padrão "Unidade Centro"
    Quando Ana cadastra uma nova Unit "Unidade Zona Sul" com timezone "America/Sao_Paulo" e horário de
      funcionamento de terça a domingo, 09:00–20:00
    Então a Unit "Unidade Zona Sul" é criada e vinculada ao Tenant "Barbearia do Ana"
    E Ana (OWNER) automaticamente tem acesso a ela, sem precisar de convite adicional

  Cenário: Editar horário de funcionamento
    Dado que a Unit "Unidade Centro" funciona de segunda a sábado, 09:00–19:00
    Quando Ana atualiza o horário de domingo para "fechado" e o de sábado para 09:00–14:00
    Então as alterações são salvas e refletidas na Unit

  Cenário: Fuso horário diferente entre unidades do mesmo tenant
    Dado que "Barbearia do Ana" tem a Unit "Unidade SP" com timezone "America/Sao_Paulo"
    Quando Ana cadastra a Unit "Unidade Manaus" com timezone "America/Manaus"
    Então cada unidade mantém seu próprio fuso horário, independente uma da outra

  Cenário: Desativar uma unidade
    Dado que a Unit "Unidade Zona Sul" está ativa
    Quando Ana desativa essa unidade
    Então a Unit passa para status inativo
    E membros cujo único vínculo é com essa unidade perdem acesso operacional a ela (ver cenário de
      login em unidade desativada, §6.2)
    E a unidade deixa de aparecer como opção em novos convites

  Cenário: RECEPTION ou PROFESSIONAL tenta editar unidade
    Dado que "Carlos" está autenticado com role "RECEPTION" ou "PROFESSIONAL"
    Quando Carlos tenta criar, editar ou desativar uma Unit
    Então o sistema nega a ação por falta de permissão

  Cenário: Campos obrigatórios da unidade
    Quando Ana tenta criar/editar uma unidade sem informar nome ou timezone
    Então o sistema rejeita e indica os campos obrigatórios
```

### 6.7 Epic: Troca de senha (autenticado)

**US-07** — Como **usuário autenticado**, quero **trocar minha senha informando a senha atual**, para
**manter minha conta segura**.

```gherkin
Funcionalidade: Trocar senha (usuário logado)

  Cenário: Troca de senha bem-sucedida
    Dado que "Carlos" está autenticado
    Quando ele informa a senha atual correta e uma nova senha válida
    Então a senha é atualizada
    E as demais sessões ativas de Carlos (em outros dispositivos) são invalidadas,
      exceto a sessão atual

  Cenário: Senha atual incorreta
    Dado que "Carlos" está autenticado
    Quando ele tenta trocar a senha informando a senha atual errada
    Então o sistema recusa a troca e informa que a senha atual está incorreta
    E a senha permanece inalterada

  Cenário: Nova senha não atende aos critérios mínimos
    Dado que "Carlos" está autenticado
    Quando ele tenta definir uma nova senha mais curta que o mínimo exigido
    Então o sistema recusa e indica os critérios de senha
```

### 6.8 Epic: Recuperação de senha ("esqueci minha senha")

**US-08** — Como **usuário que esqueceu a senha**, quero **solicitar a redefinição por e-mail**, para
**recuperar o acesso à minha conta sem depender de suporte**.

```gherkin
Funcionalidade: Recuperar senha

  Cenário: Solicitação de redefinição para e-mail existente
    Dado que existe um User com e-mail "ana@barbearia.com"
    Quando alguém solicita redefinição de senha para "ana@barbearia.com"
    Então um e-mail com link de redefinição (token de validade curta, sugestão 1 hora) é enviado
    E o sistema responde com uma mensagem genérica de sucesso

  Cenário: Solicitação de redefinição para e-mail inexistente
    Quando alguém solicita redefinição de senha para um e-mail que não existe no sistema
    Então o sistema responde com a mesma mensagem genérica de sucesso
    E nenhum e-mail é enviado
    (evita confirmar/negar existência de conta — proteção contra enumeração de usuários)

  Cenário: Redefinição com token válido
    Dado que "ana@barbearia.com" possui um token de redefinição válido e não utilizado
    Quando ela acessa o link e define uma nova senha válida
    Então a senha é atualizada
    E o token é invalidado (uso único)
    E todas as sessões ativas anteriores de Ana são invalidadas

  Cenário: Token expirado
    Dado que o token de redefinição de Ana foi emitido há mais tempo que sua validade
    Quando ela tenta usá-lo para redefinir a senha
    Então o sistema informa que o link expirou
    E orienta a solicitar um novo

  Cenário: Token já utilizado
    Dado que um token de redefinição já foi usado para trocar a senha
    Quando alguém tenta reutilizá-lo
    Então o sistema recusa, informando que o link não é mais válido
```

> **Nota para `security-reviewer`/`tech-lead`**: recomenda-se limitar a taxa de solicitações de redefinição e
> de tentativas de login por e-mail/IP (anti-brute-force), mas a definição de limites/bloqueio de conta é
> decisão técnica, não detalhada neste documento de produto.

## 7. Perguntas em aberto para o `tech-lead`

1. **Nomenclatura de papéis na UI**: `ARCHITECTURE.md` (§4) descreve os papéis como
   "owner/admin/receptionist/professional", mas `packages/shared/src/enums.ts` define
   `OWNER | MANAGER | RECEPTION | PROFESSIONAL`. Este documento seguiu o enum (fonte de verdade de código).
   Confirmar os rótulos em pt-BR exibidos na UI (sugestão: Dono, Gerente, Recepção, Profissional).
2. **Pessoa com conta existente quer abrir seu próprio negócio**: hoje o signup exige e-mail inédito
   (US-01). Precisamos de um fluxo "criar novo tenant com minha conta atual" para quem já é `User` (ex.:
   profissional freelancer que decide abrir sua própria barbearia)? Proponho tratar como uma ação
   separada ("+ Criar nova barbearia") disponível a qualquer `User` autenticado, fora do fluxo de signup
   público — mas isso é uma decisão de produto que impacta o contrato da API.
3. **Escopo de unidades do `MANAGER`**: confirmar se `MANAGER` deve poder ser restrito a unidades
   específicas (gerente de filial) desde o MVP, ou se no MVP todo `MANAGER` enxerga todas as unidades do
   tenant (simplificação). Este documento assumiu que `MANAGER` pode ser escopado por unidade(s), como
   `RECEPTION`/`PROFESSIONAL`.
4. **`MANAGER` pode criar/editar unidades?** Proposta inicial: não, só `OWNER`, no MVP. Validar se isso
   atende o caso de redes maiores.
5. **Transferência de propriedade (`OWNER`)**: este documento não cobre um fluxo explícito de "transferir a
   titularidade do tenant" — hoje só cobre "convidar outro OWNER" e "impedir remover o último OWNER". Deve
   existir um fluxo dedicado de transferência (ex.: ao vender a barbearia)? Se sim, é uma story adicional.
6. **Horário de funcionamento padrão da Unit criada no signup**: sugeri seg–sáb 09:00–19:00, domingo
   fechado. Confirmar com `ui-ux-designer`/conhecimento de mercado se faz mais sentido já abrir o
   formulário de horário no próprio signup em vez de usar um padrão.
7. **Validade de convite (7 dias) e de token de redefinição de senha (1 hora)**: valores sugeridos, não
   confirmados — ajustar conforme política de segurança definida pelo `tech-lead`/`security-reviewer`.
8. **Sessões simultâneas**: ao trocar a senha ou redefinir via "esqueci minha senha", assumi que as demais
   sessões/refresh tokens são invalidados. Confirmar se esse é o comportamento desejado (vs. manter sessões
   ativas).
9. **Endereço e CNPJ da unidade**: `docs/RESEARCH.md` menciona `Unit` com endereço e CNPJ próprio opcional
   (para NFS-e por filial). Como NFS-e é fase 3, este documento não exigiu esses campos no MVP — confirmar
   se endereço ao menos deve entrar já (útil para o cliente final identificar a unidade no agendamento
   online, que é parte do MVP segundo `ARCHITECTURE.md` §5).

## 8. Decisões do `tech-lead`

> Resolvendo as 9 perguntas de §7. Detalhamento técnico completo em `docs/plans/auth.md`; decisão
> estrutural de sessão/multi-tenant registrada em `docs/adr/0002-autenticacao-sessao-multi-tenant.md`.

1. **Nomenclatura**: confirmado — o enum (`OWNER`, `MANAGER`, `RECEPTION`, `PROFESSIONAL`) é a fonte de
   verdade; rótulos pt-BR na UI: **Dono**, **Gerente**, **Recepção**, **Profissional**. Corrigi a
   redação antiga ("owner/admin/receptionist/professional") em `docs/ARCHITECTURE.md` §4 para não
   divergir do enum.
2. **Conta existente + novo negócio**: aceito. Adicionamos `POST /tenants` (autenticado, qualquer `User`
   logado, não exige e-mail novo) que cria um novo `Tenant` + `Unit` padrão + `Membership(OWNER)` para o
   usuário atual — ação "+ Criar nova barbearia", fora do fluxo de signup público. Entra no MVP desta
   feature porque reaproveita o mesmo serviço interno do signup (baixo custo).
3. **Escopo de unidades do `MANAGER`**: confirmado — `MANAGER` é escopável por unidade(s) desde o MVP,
   igual a `RECEPTION`/`PROFESSIONAL` (tabela `MembershipUnit`). `OWNER` continua enxergando todas as
   unidades sem precisar de linhas nessa tabela (regra de aplicação, não linha de dado).
4. **`MANAGER` criar unidades**: mantida a proposta — **não** no MVP, só `OWNER`. Reavaliar como débito
   consciente se surgir demanda real de rede grande (o modelo de dados já suporta estender isso depois
   sem migration estrutural).
5. **Transferência de `OWNER`**: sem fluxo dedicado no MVP. É coberta pela combinação de endpoints já
   existentes: `OWNER` promove outro membro a `OWNER` (`PATCH /memberships/:id`) e, em seguida, pode se
   auto-rebaixar/sair (mesma rota), desde que não seja o último `OWNER` ativo. Um wizard guiado de
   "transferir titularidade" fica como item de backlog de fase 2, não bloqueia o MVP.
6. **Horário padrão da Unit no signup**: confirmado o padrão sugerido (seg–sáb 09:00–19:00, domingo
   fechado), criado automaticamente sem perguntar no formulário de signup — reduz fricção no cadastro.
   Fica imediatamente editável em "gestão de unidades" (US-06) logo após o signup.
7. **Validade de convite e token de redefinição**: confirmados os valores sugeridos — **convite: 7
   dias**, **redefinição de senha: 1 hora**. Ambos os tokens são aleatórios (256 bits), de uso único, e
   armazenados **apenas com hash** (sha-256) no banco — nunca em texto plano.
8. **Invalidação de sessões**: confirmado o comportamento proposto, formalizado na ADR 0002 — logout
   revoga a sessão atual; troca de senha revoga as demais sessões (mantém a atual); redefinição via
   "esqueci minha senha" revoga **todas** as sessões; remoção/desativação de um `Membership` revoga as
   sessões daquele usuário **naquele tenant**. Risco aceito: o access token (JWT, 15 min) pode ficar até
   15 min com claims desatualizadas após uma mudança administrativa — ver `docs/plans/auth.md` (riscos).
9. **Endereço e CNPJ da unidade**: endereço **entra no MVP** como campos da `Unit` (necessário para o
   cliente final identificar a unidade no agendamento online, que já é MVP). `cnpj` entra como coluna
   opcional desde já (evita migration depois), mas sem validação de uso fiscal — NFS-e continua fase 3.
   Esses campos ficam na tela de "gestão de unidades" (US-06), não no formulário de signup.
