# MOVE FLOW

Sistema web de gerenciamento de projetos de consultoria — **FAUS Soluções Estratégicas**.

---

## Pré-requisitos

- Node.js 18.17+ ou 20+
- npm 9+
- Projeto Supabase criado com schema aplicado (`move_flow_schema.sql`)

---

## Configuração inicial

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd move-flow
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com os valores do seu projeto Supabase:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role (nunca expor no frontend) |
| `SUPABASE_PROJECT_ID` | Supabase Dashboard → Project Settings → General → Reference ID |

### 3. Gere os tipos TypeScript do banco

```bash
npx supabase login
npm run gen:types
```

> Isso atualiza `src/types/database.types.ts` com os tipos reais do seu schema.  
> Rode novamente sempre que o schema mudar.

### 4. Rode em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Estrutura de pastas

```
src/
├── app/                        # App Router do Next.js
│   ├── layout.tsx              # Root layout (fontes, metadata global)
│   ├── page.tsx                # Raiz — redireciona por perfil
│   ├── globals.css             # Estilos globais + Tailwind
│   ├── login/
│   │   └── page.tsx            # Página de login
│   ├── unauthorized/
│   │   └── page.tsx            # Página de acesso negado
│   ├── dashboard/              # Painel interno (admin + consultor)
│   │   ├── layout.tsx          # Layout com Sidebar + Header + AuthProvider
│   │   ├── page.tsx            # Dashboard home
│   │   ├── projetos/
│   │   ├── clientes/
│   │   ├── acoes/
│   │   ├── reunioes/
│   │   ├── documentos/
│   │   ├── kpis/
│   │   ├── timeline/
│   │   └── usuarios/
│   └── portal/                 # Portal do cliente
│       ├── layout.tsx          # Layout com PortalSidebar + Header
│       ├── page.tsx            # Portal home (visão do projeto)
│       ├── acoes/
│       ├── reunioes/
│       ├── documentos/
│       └── kpis/
│
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx       # Formulário de login (Client Component)
│   │   └── AuthProvider.tsx    # Hidrata Zustand store com o profile
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navegação lateral (dashboard)
│   │   ├── Header.tsx          # Cabeçalho com logout (dashboard)
│   │   ├── PortalSidebar.tsx   # Navegação lateral (portal cliente)
│   │   ├── PortalHeader.tsx    # Cabeçalho com logout (portal)
│   │   └── DashboardHome.tsx   # Conteúdo da home do dashboard
│   └── ui/
│       └── PlaceholderPage.tsx # Placeholder para módulos ainda não implementados
│
├── hooks/
│   └── useAuthStore.ts         # Zustand store: profile, role, seletores
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createClient() — uso em Client Components
│   │   ├── server.ts           # createClient() — uso em Server Components
│   │   ├── middleware.ts       # createMiddlewareClient() — uso no middleware
│   │   └── auth.ts             # getSessionWithProfile(), helpers de role
│   └── utils/
│       ├── index.ts            # cn(), labels, cores, formatadores
│       └── navigation.ts       # Nav items por perfil, rotas públicas
│
├── middleware.ts               # Proteção de rotas + redirecionamento por role
│
└── types/
    └── database.types.ts       # Tipos gerados do Supabase (atualizar com gen:types)
```

---

## Perfis e roteamento

| Perfil | Login redireciona para | Acesso negado a |
|---|---|---|
| `admin_faus` | `/dashboard` | `/portal` |
| `consultor_faus` | `/dashboard` | `/portal`, `/dashboard/clientes`, `/dashboard/usuarios` |
| `cliente` | `/portal` | `/dashboard` |

---

## Scripts disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção (após build)
npm run type-check   # Verifica tipos TypeScript sem compilar
npm run lint         # ESLint
npm run gen:types    # Gera tipos TypeScript do schema Supabase
```

---

## Deploy (Vercel)

1. Conecte o repositório GitHub ao projeto Vercel
2. Configure as variáveis de ambiente no painel da Vercel (mesmas do `.env.local`)
3. Push para `main` → deploy automático

> **Nunca** adicione `SUPABASE_SERVICE_ROLE_KEY` como `NEXT_PUBLIC_`. Ela deve ficar apenas no servidor.

---

## Documentação técnica

| Documento | Conteúdo |
|---|---|
| [`docs/SECURITY.md`](docs/SECURITY.md) | Princípios de segurança, padrões de RLS, decisões de governança e checklist |
| [`docs/PERMISSION_MATRIX.md`](docs/PERMISSION_MATRIX.md) | Matriz de permissões por perfil e módulo |
| [`docs/MOVE_REPORT.md`](docs/MOVE_REPORT.md) | Módulo de relatórios e briefing para IA |

---

## Próximas fases

| Fase | Escopo |
|---|---|
| Fase 2 | CRUD de Clientes e Projetos (com bloco estratégico obrigatório) |
| Fase 3 | Módulo de Ações com controle de visibilidade |
| Fase 4 | Reuniões e Documentos (com upload via Supabase Storage) |
| Fase 5 | KPIs e histórico de registros |
| Fase 6 | Dashboard com dados reais e Timeline automática |
| Fase 7 | Portal do Cliente com módulos completos |
