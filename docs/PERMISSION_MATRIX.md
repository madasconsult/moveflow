# Matriz de Permissões do MOVE FLOW

Este documento registra a matriz funcional de permissões do MOVE FLOW após a estabilização da Rodada 4H, marcada pela tag `v1.6.0-estavel-pos-permissoes-operacionais`.

Ele deve ser usado como referência antes de alterar UI, RLS, migrations, rotas server-side ou fluxos de negócio relacionados a perfis, papéis no projeto e módulos operacionais.

## 1. Visão Geral dos Perfis

### `admin_faus`

Perfil de governança total do sistema.

Responsabilidades principais:

- Gerenciar usuários.
- Criar e editar clientes.
- Criar e editar projetos.
- Alterar campos estruturais de projetos.
- Gerenciar equipe de suporte.
- Operar ações, Diário de Bordo, KPIs, diagnóstico, Rate FAUS, documentos, reuniões, FSPs e relatórios.
- Executar ações administrativas ou estruturais quando o módulo permitir.

Observação de governança:

- `admin_faus` é o único admin global.
- `gestor_faus` não deve ser tratado como admin global.

### `gestor_faus`

Perfil interno de visão ampla de carteira.

Responsabilidades principais:

- Acompanhar todos os projetos.
- Ler clientes, projetos e dados operacionais.
- Apoiar gestão da carteira sem receber permissões administrativas globais.

Limites:

- Não gerencia usuários.
- Não acessa `/dashboard/usuarios`.
- Não altera roles globais.
- Não recebe permissões exclusivas de `admin_faus`.
- Não possui escrita operacional ampla nesta matriz, salvo regra futura específica.

### `consultor_faus` como Consultor Principal

Papel de projeto definido por:

```text
projects.main_consultant_id = auth.uid()
```

Responsabilidades principais:

- Operar o projeto sob sua liderança.
- Criar projeto próprio conforme regra existente.
- Criar e editar ações do próprio projeto.
- Alterar status de ações do próprio projeto.
- Definir `visible_to_client` em ações do próprio projeto.
- Criar e editar Diário de Bordo do próprio projeto.
- Criar KPIs do próprio projeto.
- Registrar/apurar valores de KPI.
- Comentar ou registrar análises operacionais de KPI, quando o fluxo permitir.
- Criar e editar diagnóstico/Rate FAUS quando estiver no fluxo permitido.

Limites:

- Não gerencia usuários.
- Não altera gestor após criação do projeto.
- Não troca consultor principal após criação.
- Não governa campos estruturais globais.
- Não deve excluir/inativar KPI se isso for regra estrutural/admin.

### `consultor_faus` como Consultor Suporte

Papel de projeto definido por:

```text
project_members.role_in_project = 'support'
```

Responsabilidades principais:

- Visualizar projetos em que participa.
- Visualizar ações, equipe, Diário de Bordo, KPIs, diagnóstico e demais dados operacionais liberados por RLS/UI.
- Atuar operacionalmente apenas quando houver regra específica por módulo.

Limites:

- Nesta matriz, não recebe escrita ampla por ser suporte.
- Se não houver regra explícita de edição para suporte, o comportamento esperado é somente leitura.
- Especialidade de suporte é registrada em `project_members.specialty`.

### `cliente`

Perfil externo de portal.

Responsabilidades principais:

- Acompanhar informações liberadas no Portal do Cliente.
- Visualizar ações marcadas como visíveis ao cliente, quando pertencentes a projetos do seu `client_id`.

Limites:

- Cliente nunca escreve.
- Cliente não acessa dashboard interno.
- Cliente não vê dados internos sensíveis.
- Cliente só deve ver registros explicitamente liberados e pertencentes ao seu cliente/projeto.

## 2. Perfil, Papel e Permissão por Módulo

O MOVE FLOW separa três conceitos:

- Perfil de acesso ao sistema: define o tipo global de usuário, como `admin_faus`, `gestor_faus`, `consultor_faus` ou `cliente`.
- Papel no projeto: define a relação do usuário com um projeto específico, como Consultor Principal, Consultor Suporte ou Gestor do Projeto.
- Permissão por módulo: define o que o usuário pode ver, criar, editar, excluir ou inativar em cada área.

Essa separação é crítica porque um mesmo `consultor_faus` pode ser Consultor Principal em um projeto e Consultor Suporte em outro. Portanto, permissões operacionais devem considerar o contexto do projeto, não apenas o perfil global.

## 3. Matriz por Módulo

### Usuários

Quem vê:

- `admin_faus`.

Quem cria:

- `admin_faus`.

Quem edita:

- `admin_faus`.

Quem exclui/inativa:

- `admin_faus`, respeitando proteções específicas.

Governança:

- A tela `/dashboard/usuarios` é exclusiva de `admin_faus`.
- `gestor_faus` não acessa gestão de usuários.
- O Admin Original é protegido contra rebaixamento, desativação, vínculo a cliente e exclusão.

### Clientes

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` conforme regras de acesso e vínculos já existentes.

Quem cria:

- `admin_faus`.
- `consultor_faus`, conforme regra validada nas rodadas anteriores para criação própria.

Quem edita:

- `admin_faus`.
- Outros perfis somente se houver regra específica segura.

Quem exclui/inativa:

- Regra estrutural/admin, quando existir no módulo.

Governança:

- Cliente externo não acessa cadastro interno de clientes.
- `gestor_faus` lê carteira, mas não vira admin global.

### Projetos

Quem vê:

- `admin_faus`: todos.
- `gestor_faus`: todos.
- `consultor_faus` principal: projetos em que é principal.
- `consultor_faus` suporte: projetos em que participa.
- `cliente`: apenas projetos do seu `client_id`, pelo portal e regras existentes.

Quem cria:

- `admin_faus`.
- `consultor_faus`, criando projeto próprio como Consultor Principal.

Quem edita:

- `admin_faus` edita campos estruturais.
- `consultor_faus` principal opera o projeto nos módulos permitidos, mas não troca gestor nem consultor principal após criação.

Quem exclui/inativa:

- Regra estrutural/admin.

Governança:

- Tipo do projeto, filial responsável, gestor e consultor principal são campos de governança.
- `consultor_faus` pode informar gestor na criação quando a regra permitir.
- `gestor_faus` não cria projeto nesta matriz, salvo evolução futura com RLS e UI específicas.

### Equipe de Suporte

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.

Quem cria/adiciona suporte:

- `admin_faus`.

Quem edita:

- `admin_faus` altera especialidade do suporte.

Quem remove:

- `admin_faus` remove membros de suporte.

Governança:

- Máximo de 5 consultores de suporte por projeto na UI.
- Suporte usa `project_members.role_in_project = 'support'`.
- Especialidade usa `project_members.specialty`.
- Não alterar `lead`, `client_viewer`, `main_consultant_id` ou `project_manager_id` por esse fluxo.

### Ações

Quem vê:

- `admin_faus`: ações dos projetos acessíveis.
- `gestor_faus`: visão ampla.
- `consultor_faus` principal: ações do próprio projeto.
- `consultor_faus` suporte: ações dos projetos em que participa.
- `cliente`: apenas ações do próprio cliente/projeto com `visible_to_client = true`.

Quem cria:

- `admin_faus`.
- `consultor_faus` principal do projeto.

Quem edita:

- `admin_faus`.
- `consultor_faus` principal do projeto.

Quem exclui/inativa:

- Regra administrativa ou específica do módulo.
- Cliente nunca exclui.

Governança:

- `visible_to_client` é o campo que libera ação no Portal do Cliente.
- Cliente não altera status, prazo, responsável, progresso ou visibilidade.
- A experiência visual do portal deve se aproximar da visão interna sempre que possível, removendo apenas ações/campos/botões não permitidos.

### Diário de Bordo

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.

Quem cria:

- `admin_faus`.
- `consultor_faus` principal do projeto.

Quem edita:

- `admin_faus`.
- `consultor_faus` principal, desde que não transforme a edição em exclusão lógica.

Quem exclui/inativa:

- `admin_faus`.

Governança:

- Exclusão lógica por `deleted_at` é admin-only.
- Consultor Principal pode editar conteúdo operacional, mas não deve marcar `deleted_at`.
- Cliente não acessa Diário de Bordo nesta matriz.

### KPIs

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.
- Cliente somente se houver portal/regra específica para KPIs.

Quem cria:

- `admin_faus`.
- `consultor_faus` principal do projeto.

Quem edita:

- `admin_faus` edita dados estruturais.
- `consultor_faus` principal edita/apura dados operacionais permitidos.

Quem exclui/inativa:

- Governança `admin_faus`, salvo regra futura explícita.

Governança:

- Campos estruturais de KPI continuam sob governança admin.
- Unidade de medida, origem, tipo de leitura, classificação e estrutura do indicador devem permanecer protegidas.
- Apuração, comentários e análise operacional podem ser operados pelo Consultor Principal.
- RLS não controla coluna por coluna; quando necessário, usar UI e futuras triggers.

### Diagnóstico

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.
- Cliente somente se houver política de liberação específica.

Quem cria:

- `admin_faus`.
- `consultor_faus` principal, quando fizer sentido no fluxo atual.

Quem edita:

- `admin_faus`.
- `consultor_faus` principal enquanto o diagnóstico estiver em fluxo operacional permitido.

Quem exclui/inativa:

- `admin_faus`.

Governança:

- Diagnóstico é base consultiva e deve usar apenas dados reais.
- Cliente não escreve diagnóstico.
- Suporte visualiza salvo regra específica futura.

### Rate FAUS

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.

Quem cria:

- `admin_faus`.
- `consultor_faus` principal, quando o fluxo permitir criar o primeiro Rate/diagnóstico.

Quem edita:

- `admin_faus`.
- `consultor_faus` principal em fluxo operacional permitido.

Quem exclui/reseta:

- `admin_faus`.

Governança:

- Reset de Rate FAUS é ação sensível e deve permanecer admin-only.
- Não recalcular Rate de forma divergente das funções oficiais.
- Gestor acompanha carteira e evolução, mas não governa estrutura.

### Documentos

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.
- Cliente apenas documentos liberados no portal, se o módulo permitir.

Quem cria:

- Conforme regra existente do módulo interno.

Quem edita:

- Conforme regra existente do módulo interno.

Quem exclui/inativa:

- Conforme regra administrativa ou específica do módulo.

Governança:

- Não liberar documentos internos para cliente sem campo/regra explícita de visibilidade.
- Pastas/documentos com escrita admin-only devem permanecer protegidos até decisão específica.

### Reuniões

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.
- Cliente apenas reuniões liberadas no portal, se houver regra específica.

Quem cria:

- Conforme regra operacional existente.

Quem edita:

- Conforme regra operacional existente.

Quem exclui/inativa:

- Conforme regra administrativa ou específica do módulo.

Governança:

- Reuniões podem alimentar relatórios e briefing, portanto não devem ser expostas ao cliente sem regra clara.

### FSPs

Quem vê:

- `admin_faus`.
- `gestor_faus`.
- `consultor_faus` com acesso ao projeto.

Quem cria:

- Conforme regra operacional existente, especialmente quando derivado de ação ou KPI.

Quem edita:

- Conforme regra operacional existente.

Quem exclui/inativa:

- Regra administrativa ou específica do módulo.

Governança:

- FSP pode conter análise de causa, impacto e recomendação; tratar como dado consultivo sensível.
- Não inventar vínculo entre FSP, ação e KPI se não existir campo real.

### Portal do Cliente

Quem vê:

- `cliente`.

Quem cria:

- Ninguém pelo perfil cliente.

Quem edita:

- Ninguém pelo perfil cliente.

Quem exclui/inativa:

- Ninguém pelo perfil cliente.

Governança:

- Cliente nunca escreve.
- Cliente vê apenas dados do próprio `client_id`.
- Ações exigem `actions.visible_to_client = true`.
- O portal deve reaproveitar a melhor experiência visual do dashboard quando possível, sem expor campos internos nem ações de edição.

### Relatórios

Quem vê:

- Perfis internos autorizados pelo módulo, como `admin_faus`, `gestor_faus` e `consultor_faus`, conforme regra atual.

Quem cria/gera:

- Perfis internos autorizados.

Quem edita:

- Relatórios PDF não são editados no sistema nesta matriz.
- Comentário consultivo manual pode ser informado antes da geração, conforme regra do módulo.

Quem exclui/inativa:

- Não há histórico persistido de relatórios nesta matriz.

Governança:

- MOVE REPORT usa dados reais e deve respeitar permissões do usuário e projeto.
- Briefing para IA é manual, sem chamada externa, e tem regra específica documentada em `docs/MOVE_REPORT.md`.
- Não implementar IA integrada, histórico ou storage sem fase específica.

## 4. Regras Críticas

- Admin Original protegido: o usuário original do sistema não pode ser rebaixado, desativado, vinculado a cliente ou excluído.
- Cliente nunca escreve: qualquer escrita por `cliente` deve ser tratada como violação de governança.
- Gestor FAUS vê todos os projetos, mas não é admin global.
- Consultor Principal opera o projeto, mas não governa usuários nem estrutura global.
- Consultor Suporte visualiza e atua apenas quando houver regra específica.
- Campos estruturais de KPI seguem governança admin.
- RLS não controla coluna por coluna; quando necessário, combinar UI, policies específicas e futuras triggers.
- Dados liberados ao cliente precisam de campo/regra explícita de visibilidade.
- Não usar `service_role` no client.
- Não ampliar permissões por conveniência visual; primeiro documentar, depois implementar com RLS mínima.

## 5. Checkpoints de Estabilidade

### `v1.5.0-estavel-pre-permissoes-operacionais`

Checkpoint anterior à ampliação das permissões operacionais do Consultor Principal.

Uso recomendado:

- Comparar comportamento antes da Rodada 4H.
- Investigar regressões em permissões operacionais.
- Recuperar base pré-4H em caso de necessidade.

### `v1.6.0-estavel-pos-permissoes-operacionais`

Checkpoint posterior à Rodada 4H aplicada e validada.

Uso recomendado:

- Referência oficial da matriz operacional atual.
- Base para próximas rodadas de governança, filtros e portal.
- Ponto seguro antes de ampliar permissões de suporte ou módulos do cliente.

## 6. Pendências Futuras

- Blindagem por trigger para campos estruturais de KPI.
- Documentação técnica detalhada das RLS.
- Unificação completa de componentes de ações entre portal e dashboard, se ainda houver duplicidade.
- Portal do Cliente para demais módulos, preservando dados internos.
- Filtros globais por cliente, filial, tipo de projeto, gestor e consultor principal.
- Regras específicas para Consultor Suporte, incluindo quando pode editar ações atribuídas.
- Política formal para escrita operacional de `gestor_faus`, se vier a ser necessária.
- Revisão de permissões de documentos, reuniões e FSPs por tipo de exposição ao cliente.
- Testes automatizados de autorização por perfil e papel no projeto.

## 7. Checklist de Revisão Antes de Alterar Permissões

- A alteração depende de perfil global ou papel no projeto?
- A regra precisa de RLS, UI, trigger ou combinação dos três?
- Cliente continua sem escrita?
- `gestor_faus` continua sem virar admin global?
- Consultor Suporte está recebendo escrita apenas com regra explícita?
- Campos estruturais continuam protegidos?
- Existe risco de exposição entre clientes?
- A mudança precisa atualizar esta matriz?
