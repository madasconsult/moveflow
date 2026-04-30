# Importação de plano de ação

Rotina local para importar o arquivo CSV:

`data/imports/Plano_de_Acao_Dede_MOVE_FLOW_import_corrigido.csv`

## Contexto fixo da importação

- Cliente: `Dedé Autopeças`
- Projeto: `Dedé autopeças - Processos Logísticos, WMS e Layout`
- Responsável: `Manoel Malta Filho`

O script localiza cliente, projeto e responsável por nome exato antes de qualquer importação.
Se algum registro não for encontrado, a rotina aborta sem gravar dados.

## Dry-run seguro

Execute primeiro:

```bash
npm run import:actions:dry-run
```

O dry-run não grava no banco. Ele mostra:

- total de linhas lidas;
- total de ações válidas;
- total de ações que seriam importadas;
- total de ações ignoradas por duplicidade;
- total de ações com erro;
- resumo por status.

## Importação real

Depois de validar o dry-run:

```bash
npm run import:actions:apply
```

## Regras aplicadas

- Campo `Ação` vira `title` e `description` da ação.
- Campo `Prazo` vira `due_date`.
- Campo `Data de conclusão` vira `completion_date`, quando preenchido.
- Com `Data de conclusão`, o status técnico será `completed`.
- Sem `Data de conclusão`, o status técnico será `in_progress`, representando ação iniciada.
- Campo `Observações` e dados auxiliares da planilha são preservados em `notes`.
- Duplicidade é verificada por `project_id + title + due_date`.

## Segurança

Esta rotina é server-side/local e usa as variáveis já existentes do projeto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Não exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.

Se `SUPABASE_SERVICE_ROLE_KEY` estiver configurada com uma chave `anon` por engano, o script aborta antes de consultar o banco para evitar falso negativo por RLS.
