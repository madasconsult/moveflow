# MOVE REPORT

## 1. Visão geral

O MOVE REPORT é o módulo de geração de relatórios executivos do MOVE FLOW. Ele existe para transformar dados operacionais do projeto em documentos consultivos, padronizados e prontos para leitura gerencial.

Dentro do MOVE FLOW, o módulo atua como a camada de saída executiva do projeto. Ele consolida informações reais de ações, reuniões e contexto do projeto selecionado, respeitando permissões e o seletor global de Projeto Ativo.

Para a FAUS, o MOVE REPORT apoia a entrega consultiva ao cliente: organiza evidências do avanço, comunica riscos, destaca próximos passos e cria uma base evolutiva para relatórios semanais, mensais e executivos.

## 2. Versões estáveis

### v1.1.0-move-report-pdf-mvp

Primeira versão estável do módulo MOVE REPORT.

Entregou:

- Central de Relatórios em `/dashboard/relatorios`.
- Geração server-side de PDFs pela rota `/api/reports/[reportType]`.
- Três tipos iniciais de relatório:
  - Relatório Executivo do Projeto.
  - Relatório Semanal.
  - Relatório de Ações.
- Identidade visual FAUS nos PDFs.
- Assets institucionais em `public/brand/faus`.
- Carregamento robusto de logos via data URI base64.
- Proteção de acesso para perfis internos.

### v1.2.0-move-report-manual-comment

Segunda versão estável do módulo MOVE REPORT.

Entregou:

- Campo manual `Comentário Consultivo` na Central de Relatórios.
- Envio de `consultantComment` via `POST`.
- Seção `Análise Consultiva do Período` nos três PDFs.
- Preservação de `GET` para compatibilidade.
- Sanitização mínima do comentário.
- Preparação estrutural para uma futura fase com IA, sem implementar IA.

## 3. Tipos de relatório disponíveis

### Relatório Executivo do Projeto

Objetivo:

Apresentar uma visão gerencial consolidada do projeto, com foco em andamento, ações, riscos e próximos passos.

Principais seções:

- Capa institucional.
- Resumo do projeto.
- Análise Consultiva do Período, quando preenchida.
- Indicadores principais da carteira de ações.
- Principais ações concluídas.
- Principais ações em andamento.
- Principais ações atrasadas.
- Próximos passos.

Quando usar:

- Reuniões executivas.
- Atualizações gerenciais com cliente.
- Acompanhamento periódico da evolução do projeto.
- Base para futuros relatórios formais em PDF.

### Relatório Semanal

Objetivo:

Registrar a leitura operacional e consultiva de um período curto, normalmente semanal.

Principais seções:

- Capa institucional.
- Análise Consultiva do Período, quando preenchida.
- Ações concluídas no período.
- Ações criadas no período.
- Ações vencidas no período.
- Ações em andamento relevantes.
- Reuniões realizadas no período.
- Próximos passos.
- Pontos de atenção.

Quando usar:

- Fechamento semanal de acompanhamento.
- Registro de avanço após semana presencial/remota.
- Comunicação objetiva de execução e riscos.

### Relatório de Ações

Objetivo:

Apresentar a carteira de ações do projeto com foco em status, prazos, responsáveis e pendências.

Principais seções:

- Capa institucional.
- Visão geral quantitativa da carteira.
- Análise Consultiva do Período, quando preenchida.
- Ações por status.
- Ações vencidas.
- Ações próximas do vencimento.
- Tabela detalhada de ações.

Quando usar:

- Revisão de plano de ação.
- Rotinas de cobrança e priorização.
- Alinhamento interno FAUS.
- Alinhamento operacional com cliente.

## 4. Rotas

### `/dashboard/relatorios`

Página interna da Central de Relatórios.

Responsabilidades:

- Exibir o projeto ativo selecionado.
- Exibir filtros de período:
  - Data inicial.
  - Data final.
- Exibir o campo opcional `Comentário Consultivo`.
- Exibir os três cards de relatório.
- Disparar a geração de PDF.

A página respeita a seleção global de Projeto Ativo. Sem projeto ativo, mostra estado orientando a seleção de um projeto.

### `/api/reports/[reportType]`

Rota server-side responsável pela geração dos PDFs.

`reportType` aceitos:

- `executive`
- `weekly`
- `actions`

Métodos:

- `GET`: preservado por compatibilidade.
- `POST`: usado pela Central de Relatórios para enviar `consultantComment` com mais segurança do que query string.

Dados esperados no `POST`:

- `projectId`: ID do projeto.
- `startDate`: data inicial do período.
- `endDate`: data final do período.
- `consultantComment`: comentário consultivo opcional.

Parâmetros esperados no `GET`:

- `projectId`
- `startDate`
- `endDate`
- `consultantComment`, opcional e preservado apenas por compatibilidade.

Validações da rota:

- Usuário autenticado.
- Perfil ativo.
- Perfil com acesso ao módulo.
- `reportType` válido.
- `projectId` informado.
- Usuário com acesso ao projeto.

Comportamento quando não há dados:

- O PDF continua sendo gerado.
- Seções sem dados exibem mensagens elegantes de vazio.
- Dados reais não são substituídos por mocks.

## 5. Componentes principais

### `ReportCenterClient.tsx`

Componente cliente da Central de Relatórios.

Responsabilidades:

- Controlar data inicial e data final.
- Controlar o campo `Comentário Consultivo`.
- Renderizar cards dos relatórios.
- Enviar requisição `POST` para a API de relatórios.
- Baixar o PDF gerado.
- Exibir feedback de sucesso ou erro.

### `ReportLayout.tsx`

Define a estrutura visual compartilhada dos PDFs.

Responsabilidades:

- Capa institucional.
- Páginas internas.
- Cabeçalho.
- Rodapé.
- Seções.
- Cards de métricas.
- Estados vazios.
- Seção `Análise Consultiva do Período`.

### `ReportTheme.ts`

Centraliza a identidade visual dos PDFs.

Responsabilidades:

- Paleta FAUS.
- Estilos da capa.
- Estilos de páginas internas.
- Estilos de tabelas.
- Estilos de cards.
- Estilos da análise consultiva.

### `ExecutiveProjectReport.tsx`

Renderiza o Relatório Executivo do Projeto.

Responsabilidades:

- Resumo do projeto.
- Análise consultiva, quando houver.
- Métricas executivas.
- Principais ações por categoria.
- Próximos passos.

### `WeeklyProjectReport.tsx`

Renderiza o Relatório Semanal.

Responsabilidades:

- Análise consultiva, quando houver.
- Ações concluídas no período.
- Ações criadas no período.
- Ações vencidas no período.
- Ações em andamento.
- Reuniões realizadas.
- Próximos passos.
- Pontos de atenção.

### `ActionsReport.tsx`

Renderiza o Relatório de Ações.

Responsabilidades:

- Métricas gerais da carteira.
- Análise consultiva, quando houver.
- Ações por status.
- Ações vencidas.
- Ações próximas do vencimento.
- Tabela detalhada.

### `types.ts`

Define os tipos usados pelos relatórios.

Inclui:

- `ReportType`
- `ReportAssets`
- `ReportProject`
- `ReportAction`
- `ReportMeeting`
- `ReportPeriod`
- `ReportData`

### `utils.ts`

Agrupa utilitários de formatação e cálculo.

Inclui:

- Formatação de datas.
- Rótulo do período.
- Verificação de intervalo.
- Cálculo de ações vencidas.
- Agrupamento de ações por status.
- Sanitização do comentário consultivo.
- Limite de `1800` caracteres para `consultantComment`.

### `src/lib/reports.ts`

Camada server-side de apoio aos relatórios.

Responsabilidades:

- Definir tipos de relatório aceitos.
- Validar perfis que podem acessar relatórios.
- Normalizar período.
- Validar acesso ao projeto.
- Buscar dados reais do projeto, cliente, ações, responsáveis e reuniões.

### `src/lib/reports/assets.ts`

Utilitário server-side para assets da marca.

Responsabilidades:

- Ler arquivos de `public/brand/faus`.
- Converter logos para data URI base64.
- Evitar `fetch` para a própria aplicação.
- Falhar de forma segura se o arquivo não existir.
- Permitir geração do PDF mesmo sem logo.

## 6. Identidade visual FAUS

Assets:

- `public/brand/faus/faus-logo-white.png`
- `public/brand/faus/faus-logo-black.png`
- `public/brand/faus/faus-logo-orange.png`
- `public/brand/faus/faus-logo-neon.png`
- `public/brand/faus/faus-color-palette.jpg`

Uso recomendado:

- Logo branca em capas e fundos escuros.
- Logo preta em páginas claras.
- Logo neon apenas como detalhe/acento, sem exagero.
- Logo laranja apenas quando fizer sentido como destaque.

Paleta:

- Verde/turquesa neon: `#0AFAB9`
- Laranja: `#DB6100`
- Branco: `#FFFFFF`
- Preto: `#000000`
- Cinza escuro para textos: `#2B2B2B`
- Cinzas claros para fundos e divisores, como `#F3F4F6`

Regras visuais:

- O relatório deve parecer institucional, executivo e consultivo.
- A paleta deve ser usada com moderação.
- Não exagerar no verde neon.
- Não exagerar no laranja.
- Não sacrificar legibilidade por estética.
- Tabelas devem ser claras, com conteúdo quebrando corretamente.

## 7. Comentário Consultivo

Nome visual:

- `Comentário Consultivo`

Nome técnico:

- `consultantComment`

Seção no PDF:

- `Análise Consultiva do Período`

Regras:

- Campo opcional.
- Enviado via `POST` para `/api/reports/[reportType]`.
- Limite de `1800` caracteres.
- Aplica `trim`.
- Normaliza quebras de linha excessivas.
- Se vazio, a seção não aparece no PDF.
- Não é salvo em banco.
- Não é enviado para IA nesta fase.

Objetivo:

Permitir que o consultor registre uma leitura humana do período antes da geração do PDF. Essa estrutura prepara terreno para a Fase 3 com IA, mas a Fase 2 permanece completamente manual.

## 8. Permissões

Perfis com acesso:

- `admin_faus`
- `consultor_faus`
- `consultor`, suportado defensivamente no código caso exista divergência de role

Perfis sem acesso:

- `cliente`

Regras:

- O item de menu aparece apenas para perfis internos permitidos.
- A página `/dashboard/relatorios` valida acesso no servidor.
- A rota `/api/reports/[reportType]` também valida acesso.
- A geração valida se o usuário tem acesso ao projeto informado.
- A proteção não depende apenas da interface.

## 9. Dados usados

Dados consultados de forma geral:

- `projects`
- `clients`
- `actions`
- `profiles`
- `meetings`, quando disponível

Regras:

- Não inventar dados.
- Não usar mocks.
- Não expor dados fora do projeto acessível ao usuário.
- Se não houver ações ou reuniões, renderizar seção vazia elegante.
- Não salvar PDF gerado nesta fase.

## 10. Regras de segurança e governança

Regras obrigatórias para evolução:

- Não enviar secrets para PDF.
- Não expor `.env`, `.env.local` ou variáveis de ambiente.
- Não alterar RLS sem tarefa específica.
- Não alterar permissões sem validação explícita.
- Não salvar PDFs em storage sem fase específica.
- Não implementar IA sem revisão de prompt, dados enviados e privacidade.
- Não usar service role no frontend.
- Não gerar relatórios com dados de projetos não acessíveis ao usuário.
- Não incluir anexos ou uploads sem desenho de segurança.

## 11. Checklist de teste

Antes de considerar uma alteração no MOVE REPORT pronta:

- `/dashboard/relatorios` abre corretamente.
- `admin_faus` acessa.
- `consultor_faus` acessa.
- `cliente` não acessa.
- Projeto ativo é respeitado.
- Relatório Executivo gera PDF.
- Relatório Semanal gera PDF.
- Relatório de Ações gera PDF.
- Logos FAUS aparecem.
- PDF com `Comentário Consultivo` vazio gera normalmente.
- PDF com `Comentário Consultivo` preenchido mostra a seção `Análise Consultiva do Período`.
- Texto longo não quebra o layout do PDF.
- Dados reais continuam aparecendo.
- Seções vazias continuam elegantes.
- `npm run build` passa.
- `npm run lint` passa.
- `npm run type-check` passa.
- `tsconfig.tsbuildinfo` não entra no commit.

## 12. Roadmap

### Fase 3: Melhorar Comentário com IA

Usar IA para apoiar o consultor na redação do comentário, mantendo revisão humana antes de gerar o PDF.

### Fase 4: Análise Executiva com IA

Gerar análise executiva mais profunda a partir dos dados do projeto, com governança clara de prompts, privacidade e rastreabilidade.

### Fase 5: Histórico de relatórios

Registrar relatórios gerados, período, usuário, tipo e metadados relevantes.

### Fase 6: Storage de PDFs

Salvar PDFs em storage de forma segura, com permissões e política de retenção.

### Fase 7: Inclusão de KPIs, FSPs, Rate FAUS e Diário de Bordo

Expandir os relatórios para incluir indicadores, análises de causa, evolução do Rate FAUS e registros do Diário de Bordo.
