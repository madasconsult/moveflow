import type { UserRole } from '@/types/database.types'

export interface NavItem {
  label: string
  href: string
  icon: string       // nome do ícone Lucide
  roles: UserRole[]  // quais perfis veem este item
  badge?: string     // badge opcional (ex: "Em breve")
}

// Navegação do painel interno (admin + consultor)
export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    icon:  'LayoutDashboard',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Clientes',
    href:  '/dashboard/clientes',
    icon:  'Building2',
    roles: ['admin_faus'],
  },
  {
    label: 'Projetos',
    href:  '/dashboard/projetos',
    icon:  'FolderKanban',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Ações',
    href:  '/dashboard/acoes',
    icon:  'CheckSquare',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Reuniões',
    href:  '/dashboard/reunioes',
    icon:  'CalendarDays',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Diário de Bordo',
    href:  '/dashboard/diario-de-bordo',
    icon:  'FileText',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Relatórios',
    href:  '/dashboard/relatorios',
    icon:  'FileText',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Documentos',
    href:  '/dashboard/documentos',
    icon:  'FileText',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'KPIs',
    href:  '/dashboard/kpis',
    icon:  'TrendingUp',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'FSPs',
    href:  '/dashboard/fsps',
    icon:  'SearchCheck',
    roles: ['admin_faus', 'consultor_faus'],
  },
  {
    label: 'Timeline',
    href:  '/dashboard/timeline',
    icon:  'History',
    roles: ['admin_faus', 'consultor_faus'],
  },
]

// Navegação admin — itens exclusivos
export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Usuários',
    href:  '/dashboard/usuarios',
    icon:  'Users',
    roles: ['admin_faus'],
  },
]

// Navegação do portal do cliente
export const PORTAL_NAV_ITEMS: NavItem[] = [
  {
    label: 'Meu Projeto',
    href:  '/portal',
    icon:  'LayoutDashboard',
    roles: ['cliente'],
  },
  {
    label: 'Ações',
    href:  '/portal/acoes',
    icon:  'CheckSquare',
    roles: ['cliente'],
  },
  {
    label: 'Reuniões',
    href:  '/portal/reunioes',
    icon:  'CalendarDays',
    roles: ['cliente'],
  },
  {
    label: 'Documentos',
    href:  '/portal/documentos',
    icon:  'FileText',
    roles: ['cliente'],
  },
  {
    label: 'Indicadores',
    href:  '/portal/kpis',
    icon:  'TrendingUp',
    roles: ['cliente'],
  },
]

// Filtra itens de nav pelo role do usuário
export function getNavItemsForRole(
  items: NavItem[],
  role: UserRole
): NavItem[] {
  return items.filter(item => item.roles.includes(role))
}

// Rotas que não requerem autenticação
export const PUBLIC_ROUTES = ['/login', '/unauthorized']

// Rotas exclusivas do portal cliente — redireciona outros perfis
export const PORTAL_ROUTES = ['/portal']

// Rotas exclusivas do painel interno — redireciona cliente
export const DASHBOARD_ROUTES = ['/dashboard']
