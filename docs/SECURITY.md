# MOVE FLOW — Segurança e Permissões

Este documento consolida os princípios de segurança, os padrões de RLS e as decisões de governança do MOVE FLOW após as Rodadas F, G1, G2 e G3 (junho de 2026).

Para a matriz detalhada de permissões por módulo, consulte [`docs/PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md).

---

## 1. Princípios de Segurança

- **RLS é a camada principal de proteção.** Toda tabela com dados de projeto tem Row Level Security habilitado no Supabase. Não existe tabela pública sem RLS.
- **Frontend nunca é fonte única de segurança.** Botões ocultos, selects desabilitados e filtros visuais são UX, não autorização. A validação real acontece em RLS e server actions.
- **Server actions e APIs validam role e escopo.** Toda rota de escrita chama `getSessionWithProfile()`, verifica `profile.role` e valida `project_id` antes de operar no banco.
- **Dados de projetos/clientes não podem vazar entre consultores.** Um `consultor_faus` ativo nunca deve ler ou escrever dados de projetos aos quais não pertence.
- **Toda tabela com dados de projeto respeita `project_id`.** Quando `project_id` é indireto (via FK em outra tabela), a policy usa JOIN até chegar ao `project_id` e aplica `is_project_member`.
- **Segredos ficam fora do repositório.** `.env.local` nunca é commitado. Chaves não aparecem em código. Logs não expõem dados sensíveis.

---

## 2. Perfis do Sistema

O MOVE FLOW usa quatro perfis definidos no enum `public.user_role`. O perfil é global por usuário; a posição no projeto (lead, suporte) refina permissões operacionais dentro de cada perfil.

### `admin_faus`

| Dimensão | Escopo |
|---|---|
| Leitura | Todos os projetos, todos os dados |
| Escrita | Todos os módulos, incluindo campos estruturais |
| Exclusão | Exclusivo para operações destrutivas (ex.: DELETE em `actions`) |
| Observação | Único perfil com acesso global de escrita; proteger atribuição |

### `gestor_faus`

| Dimensão | Escopo |
|---|---|
| Leitura | **Todos os projetos** — intencional (ver §3) |
| Escrita | Nenhuma tabela operacional |
| Exclusão | Nenhuma |
| Observação | Perfil de supervisão interna; não é admin global |

### `consultor_faus`

| Dimensão | Escopo |
|---|---|
| Leitura | Projetos onde `is_project_member()` retorna true |
| Escrita | Projetos onde participa (lead = escrita plena; suporte = conforme regra do módulo) |
| Exclusão | Não pode deletar `actions`; outros módulos conforme decisão específica |
| Observação | `is_project_member` cobre tanto `main_consultant_id` quanto `project_members` |

### `cliente`

| Dimensão | Escopo |
|---|---|
| Leitura | Apenas dados do próprio `client_id` com flag de visibilidade ativo |
| Escrita | Nenhuma |
| Exclusão | Nenhuma |
| Observação | Acessa apenas Portal (`/portal`); nunca o dashboard interno |

---

## 3. Decisão: `gestor_faus` — Visão Global Intencional

**Data da decisão:** 2026-06-09 (Rodada G3)

`gestor_faus` possui leitura de todos os projetos e clientes sem filtro de `is_project_member`. Esse comportamento é **intencional e deliberado**.

**Justificativa:**
- `gestor_faus` é o perfil de supervisão interna da FAUS, responsável por acompanhar a carteira completa de projetos.
- A visão ampla é uma funcionalidade do perfil, não uma falha de segurança.
- `gestor_faus` não tem nenhuma escrita — apenas SELECT em todas as tabelas.

**Restrições obrigatórias:**
- Conceder `gestor_faus` apenas a pessoas com função real de gestão/supervisão na FAUS.
- Não usar como perfil operacional comum ou como substituto de `consultor_faus`.
- Qualquer escrita futura para `gestor_faus` exige nova policy específica documentada.

**Impacto em RLS:** Todas as policies `*_gestor_faus_read` são SELECT-only, sem filtro de projeto. Não alterar sem nova decisão aprovada.

---

## 4. Decisão: DELETE em `actions` — Admin-only

**Data da decisão:** 2026-06-09 (Rodada G3)

Exclusão definitiva de ações é restrita a `admin_faus`.

**Justificativa:**
- Ação é evidência de gestão e rastreabilidade do projeto. Deve ser preservada como histórico auditável.
- `consultor_faus` pode editar, concluir, alterar status e responsáveis de ações nos projetos onde participa.
- Exclusão é ato irreversível; exige autoridade administrativa.

**Estado atual em RLS:**

| Operação | `admin_faus` | `consultor_faus` |
|---|---|---|
| SELECT | ✅ via `actions: admin acesso total` | ✅ via `actions: consultor le acoes dos seus projetos` |
| INSERT | ✅ via `actions: admin acesso total` | ✅ via `actions: consultor insere acoes dos seus projetos` |
| UPDATE | ✅ via `actions: admin acesso total` | ✅ via `actions: consultor atualiza acoes dos seus projetos` |
| DELETE | ✅ via `actions: admin acesso total` | ❌ Nenhuma policy |

**Não existe** server action `deleteAction` nem botão de exclusão de ação no frontend. A proteção é exclusivamente em RLS.

---

## 5. Padrão RLS para `consultor_faus`

### Tabela com `project_id` direto

```sql
create policy "tabela: consultor acessa seus projetos"
on public.minha_tabela
for all   -- ou select/insert/update separados, conforme necessidade
using (
  get_user_role() = 'consultor_faus'::public.user_role
  and public.is_project_member(minha_tabela.project_id)
)
with check (
  get_user_role() = 'consultor_faus'::public.user_role
  and public.is_project_member(minha_tabela.project_id)
);
```

### Tabela com `project_id` indireto (via FK em outra tabela)

```sql
create policy "tabela_filha: consultor acessa seus projetos"
on public.tabela_filha
for select
using (
  exists (
    select 1
    from public.tabela_pai tp
    join public.profiles p on p.id = auth.uid()
    where tp.id = tabela_filha.tabela_pai_id
      and p.is_active = true
      and (
        p.role = 'admin_faus'::public.user_role
        or (
          p.role = 'consultor_faus'::public.user_role
          and public.is_project_member(tp.project_id)
        )
      )
  )
);
```

### Exemplos reais de project_id indireto

| Tabela | Caminho até `project_id` |
|---|---|
| `action_steps` | `action_id → actions.project_id` |
| `action_assignees` | `action_id → actions.project_id` |
| `action_external_stakeholders` | `action_id → actions.project_id` |
| `kpi_target_periods` | `kpi_id → kpis.project_id` |
| `kpi_period_records` | `kpi_id → kpis.project_id` |
| `kpi_records` | `kpi_id → kpis.project_id` |
| `rate_assessment_versions` | `assessment_id → rate_assessments.project_id` |
| `rate_assessment_items` | `version_id → rate_assessment_versions → rate_assessments.project_id` |
| `diary_deliverables` | `diary_entry_id → diary_entries.project_id` |

### A função `is_project_member`

```sql
-- Retorna true se auth.uid() for main_consultant_id OU estiver em project_members
select is_project_member(project_id) from public.projects limit 1;
```

`is_project_member(p_project_id uuid)` cobre os dois caminhos de acesso de um consultor:
1. `projects.main_consultant_id = auth.uid()` (Consultor Principal)
2. `project_members.user_id = auth.uid()` (Consultor Suporte ou membro)

Sempre preferir `is_project_member` em vez de verificar apenas `main_consultant_id`.

### Evitar FOR ALL sem necessidade

Policies `FOR ALL` para `consultor_faus` concedem implicitamente DELETE. Use policies separadas por operação quando DELETE não deve ser permitido:

```sql
-- ❌ Evitar quando consultor não deve deletar
create policy "..." on public.tabela for all using (...);

-- ✅ Preferir quando operações têm escopos diferentes
create policy "... le" on public.tabela for select using (...);
create policy "... insere" on public.tabela for insert with check (...);
create policy "... atualiza" on public.tabela for update using (...) with check (...);
```

---

## 6. Padrão RLS para `cliente`

```sql
create policy "tabela: cliente le dados do proprio projeto"
on public.minha_tabela
for select
using (
  get_user_role() = 'cliente'::public.user_role
  and visible_to_client = true   -- quando aplicável
  and project_id in (
    select id from public.projects
    where client_id = get_user_client_id()
  )
);
```

**Regras:**
- `cliente` nunca tem INSERT, UPDATE ou DELETE.
- Só acessa dados do próprio `client_id`.
- Quando aplicável, só acessa registros com flag de visibilidade explícita (ex.: `visible_to_client = true`, `visibility = 'client_and_faus'`).
- Não confiar em filtros de UI para proteger dados do cliente — RLS deve ser suficiente.

---

## 7. Padrão RLS para `admin_faus`

```sql
create policy "tabela: admin acesso total"
on public.minha_tabela
for all
using (
  get_user_role() = 'admin_faus'::public.user_role
)
with check (
  get_user_role() = 'admin_faus'::public.user_role
);
```

**Regras:**
- `admin_faus` tem FOR ALL em todas as tabelas operacionais.
- Ações destrutivas (DELETE, UPDATE em massa) devem ser usadas com critério.
- O Admin Original do sistema é protegido por trigger/policy contra rebaixamento, desativação ou exclusão.
- Não usar `service_role` no client-side; admin opera via autenticação normal.

---

## 8. Cuidados com Migrations de RLS

Ao criar ou modificar policies de segurança:

1. **Sempre usar `DROP POLICY IF EXISTS` antes de recriar.** Policies não são idempotentes por padrão — `CREATE POLICY` falha se já existir com o mesmo nome.

2. **Não alterar dados de negócio em migrations de segurança.** Migrations de RLS devem conter apenas `DROP/CREATE POLICY`, `ALTER TABLE ENABLE ROW LEVEL SECURITY` e criação de índices de apoio. Nunca `UPDATE`, `DELETE` ou `INSERT` em tabelas de negócio.

3. **Aplicar migration no Supabase antes do push quando há dependência de schema/RLS.** A Vercel faz deploy automático após push na `main`. Se o código depende de uma tabela ou policy que ainda não existe no banco, o deploy pode quebrar. Sequência correta:
   ```
   apply_migration → validar banco → git commit → git push
   ```

4. **Validar policies no banco após aplicação.** Confirmar via `pg_policies` que as policies foram criadas com o conteúdo esperado antes de prosseguir.

5. **Não alterar migrations antigas sem justificativa.** Migrations são histórico imutável do schema. Correções de RLS criam novas migrations (`round_g1`, `round_g2`, etc.) — não editam as anteriores.

6. **Evitar `FOR ALL` para `consultor_faus` sem revisão.** `FOR ALL` inclui DELETE implicitamente. Se a intenção for somente leitura ou operação sem exclusão, separar em policies por operação.

7. **Testar impacto em todos os perfis antes de aplicar.** Para cada migration de RLS, verificar que:
   - `admin_faus` mantém acesso esperado
   - `gestor_faus` mantém leitura
   - `consultor_faus` fica restrito ao escopo correto
   - `cliente` não ganha acesso indevido

---

## 9. Checklist para Novas Funcionalidades

Antes de implementar qualquer nova tabela, módulo ou fluxo que envolva dados de projeto:

### RLS

- [ ] A tabela tem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`?
- [ ] Existe policy de SELECT para cada perfil que precisa ler?
- [ ] Existe policy de INSERT/UPDATE com `WITH CHECK` correto?
- [ ] Se consultor puder escrever, usa `is_project_member(project_id)`?
- [ ] O `project_id` é direto ou indireto? Se indireto, o JOIN até `project_id` está correto?
- [ ] `cliente` está limitado por `client_id` e, quando aplicável, por `visible_to_client`?
- [ ] `gestor_faus` tem apenas SELECT, sem escrita?
- [ ] Se existe DELETE, está explicitamente restrito a `admin_faus`?
- [ ] A policy usa `FOR ALL` para consultor? Se sim, isso inclui DELETE — está correto?

### Autenticação e Autorização

- [ ] O server action ou API chama `getSessionWithProfile()` antes de qualquer operação?
- [ ] O perfil (`profile.role`) é validado antes de escrever?
- [ ] O `project_id` informado pelo cliente é validado contra o banco (não apenas confiado)?
- [ ] Não existe caminho de escrita que aceite dados do frontend sem validação server-side?

### Dados Sensíveis

- [ ] Nenhuma chave, token ou segredo está hardcoded no código?
- [ ] `.env.local` continua fora do `.gitignore`... digo, do controle de versão?
- [ ] Logs não expõem dados de negócio sensíveis (KPIs, diagnósticos, participantes)?
- [ ] `tsconfig.tsbuildinfo` não será commitado?

### Testes

- [ ] `npm run type-check` passa?
- [ ] `npm run lint` passa?
- [ ] `npm run build` compila sem erros?
- [ ] As policies foram validadas via `pg_policies` no banco após aplicação?

---

## 10. Histórico das Rodadas de Segurança

### Rodada F — Auditoria Geral (2026-06-09)

Auditoria completa de RLS, server actions e APIs.

**Resultado:**
- Todas as 26 tabelas auditadas tinham RLS habilitado.
- Identificadas 8 vulnerabilidades de vazamento cross-project para `consultor_faus`: leitura irrestrita em `action_steps`, `fsps`, `project_diagnoses`, `diagnosis_indicators`, `kpi_target_periods`, `kpi_period_records`, `document_folders`, e escrita irrestrita em `fsps`.
- Identificadas 2 decisões de governança pendentes: `gestor_faus` global e DELETE de `actions` por consultor.
- APIs e server actions validadas: nenhuma falha crítica de autenticação/autorização encontrada.

### Rodada G1 — Correção Crítica (commit `98d1ac7`)

Migration: `20260609_round_g1_fix_critical_rls_scope.sql`

**Corrigido:**

| Policy | Problema | Correção |
|---|---|---|
| `action_steps_internal_read` | Sem `is_project_member` | JOIN `actions → project_id → is_project_member` |
| `fsps_internal_read` | Sem `is_project_member` | `is_project_member(project_id)` direto |
| `fsps_internal_write` | SELECT + escrita sem escopo | `is_project_member(project_id)` em USING + WITH CHECK |
| `project_diagnoses_internal_read` | Sem `is_project_member` | `is_project_member(project_id)` direto |
| `diagnosis_indicators_internal_read` | Sem `is_project_member` | `is_project_member(project_id)` direto |

### Rodada G2 — Correção Alta (commit `bc2b20f`)

Migration: `20260609_round_g2_fix_high_rls_scope.sql`

**Corrigido:**

| Policy | Problema | Correção |
|---|---|---|
| `kpi_target_periods_internal_read` | Sem `is_project_member` | JOIN `kpis → project_id → is_project_member` |
| `kpi_period_records_internal_read` | Sem `is_project_member` | JOIN `kpis → project_id → is_project_member` |
| `document_folders_internal_read` | Sem `is_project_member` | `is_project_member(project_id)` direto |

### Rodada G3 — Governança (commit `e336bdf`)

Migration: `20260609_round_g3_restrict_action_delete.sql`

**Decisões formalizadas:**
- `gestor_faus` mantém visão global intencional como perfil de supervisão.
- `consultor_faus` não pode deletar `actions` (evidência de gestão).
- Policy `actions: consultor acessa acoes dos seus projetos` (FOR ALL) substituída por SELECT, INSERT e UPDATE separados.

**Documentação atualizada:** `docs/PERMISSION_MATRIX.md` — §8 adicionada com decisões formalizadas.

---

## 11. Referências

- [`docs/PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md) — Matriz prática de permissões por perfil e módulo.
- [`docs/MOVE_REPORT.md`](./MOVE_REPORT.md) — Documentação do módulo de relatórios e briefing para IA.
- [`supabase/migrations/`](../supabase/migrations/) — Histórico completo de migrations aplicadas.
