import { useState } from 'react';
import { DownOutlined, LogoutOutlined, SettingOutlined, UserOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { Dropdown, type MenuProps } from 'antd';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { AccountsDrawer } from '@/components/accounts/AccountsDrawer';
import { Wordmark } from '@/components/common/Wordmark';
import { TitleBarQuota } from '@/components/usage/TitleBarQuota';
import { UsageLimitModal } from '@/components/usage/UsageLimitModal';
import { AccountsProvider } from '@/contexts/AccountsContext';
import { KeybindingsProvider } from '@/contexts/KeybindingsContext';
import { StatusBarProvider } from '@/contexts/StatusBarContext';
import { useStatusBarContent } from '@/hooks/useStatusBar';
import { UsageProvider } from '@/contexts/UsageContext';
import { useAccounts } from '@/hooks/useAccounts';
import { useAuth } from '@/hooks/useAuth';
import { useBackendHealth, type BackendHealth } from '@/hooks/useBackendHealth';
import { useConfirm } from '@/hooks/useConfirm';
import { useShortcuts } from '@/hooks/useShortcuts';

// Única fonte de verdade da navegação persistente (app-shell-and-auth.md §2). Desde a moldura tipo IDE
// (ADR 0036) tudo à esquerda, logo a seguir à marca: os sítios e, no fim, as duas ações (a Upwork antes do
// Novo projeto — uma candidatura ganha acaba lá, spec upwork).
const NAV_ITEMS = [
  { to: '/terminals', label: 'Terminais' },
  { to: '/projects', label: 'Projetos' },
  { to: '/library', label: 'Biblioteca' },
  { to: '/upwork', label: 'Upwork' },
  { to: '/new-project', label: 'Novo projeto' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-2.5 text-[12.5px] font-medium no-underline transition-colors ${
    isActive ? 'text-text-1 shadow-[inset_0_-2px_0_var(--wfa-color-accent)]' : 'text-text-3 hover:text-text-1'
  }`;

const HEALTH_LABEL: Record<BackendHealth, string> = {
  checking: 'A ligar ao backend…',
  online: 'Backend ligado',
  offline: 'Sem ligação ao backend',
};

const HEALTH_DOT: Record<BackendHealth, string> = {
  checking: 'bg-text-3',
  online: 'bg-success',
  offline: 'bg-error',
};

const NAV_SHORTCUTS: Record<string, string> = { goTerminals: '/terminals', goProjects: '/projects', goLibrary: '/library' };

/** "Ir para Terminais/Projetos/Biblioteca" (ADR 0016): no layout, para funcionarem em qualquer página. */
function NavigationShortcuts() {
  const navigate = useNavigate();
  useShortcuts((actionId) => {
    const to = NAV_SHORTCUTS[actionId];
    if (!to) return false;
    void navigate(to);
    return true;
  });
  return null;
}

export function AppLayout() {
  return (
    <KeybindingsProvider>
      <UsageProvider>
        <AccountsProvider>
          <NavigationShortcuts />
          <StatusBarProvider>
            <AppShell />
          </StatusBarProvider>
          <UsageLimitModal />
        </AccountsProvider>
      </UsageProvider>
    </KeybindingsProvider>
  );
}

function AppShell() {
  const { logout, username } = useAuth();
  const confirm = useConfirm();
  const health = useBackendHealth();
  const { active } = useAccounts();
  const navigate = useNavigate();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const pageStatus = useStatusBarContent();

  const userMenu: MenuProps['items'] = [
    {
      key: 'accounts',
      icon: <UserSwitchOutlined />,
      label: active ? `Conta: ${active.label}` : 'Conta',
      onClick: () => setAccountsOpen(true),
    },
    { key: 'settings', icon: <SettingOutlined />, label: 'Definições', onClick: () => void navigate('/settings') },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Terminar sessão',
      onClick: () =>
        confirm({
          title: 'Terminar sessão?',
          actionLabel: 'Sair',
          danger: false,
          message: 'Os terminais continuam a correr no backend.',
          onConfirm: logout,
        }),
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Barra de título de 32 px (ADR 0036): marca numa célula com a largura da lateral · navegação · quota · utilizador. */}
      <header className="h-[var(--wfa-titlebar-height)] flex-none flex items-stretch border-b border-border">
        <Link
          to="/terminals"
          aria-label="Workflow — Terminais"
          className="w-[var(--wfa-sidebar-width)] flex-none flex items-center px-[var(--wfa-page-gutter)] bg-surface-1 border-r border-border no-underline"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Navegação principal" className="flex gap-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <TitleBarQuota />
        <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            aria-label="Menu de utilizador"
            className="flex items-center gap-2 px-3 bg-transparent border-0 border-l border-solid border-border cursor-pointer text-text-3 hover:bg-surface-2"
          >
            <span className="w-5 h-5 rounded-full bg-surface-3 border border-border-strong flex items-center justify-center text-text-2 text-[11px]">
              <UserOutlined />
            </span>
            {username && (
              <span className="max-w-[140px] truncate text-[12.5px] font-medium text-text-1" data-username>
                {username}
              </span>
            )}
            <DownOutlined className="text-[9px]" />
          </button>
        </Dropdown>
      </header>

      {/* O scroll-padding desconta o PageHeader fixo nos saltos (scrollIntoView) das páginas. */}
      <main className="flex-1 min-h-0 overflow-auto scroll-pt-[var(--wfa-header-height)]">
        <Outlet />
      </main>

      <footer className="h-[var(--wfa-statusbar-height)] flex-none flex items-center gap-4 px-3 border-t border-border font-mono text-[11px] text-text-3">
        <span className="flex items-center gap-1.5" role="status">
          <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT[health]}`} />
          {HEALTH_LABEL[health]}
        </span>
        {/* Uma página com conteúdo próprio traz o seu espaçador (as dicas ficam junto da versão). */}
        {pageStatus ?? <div className="flex-1" />}
        <span className="font-mono">v{__APP_VERSION__}</span>
      </footer>
      <AccountsDrawer open={accountsOpen} onClose={() => setAccountsOpen(false)} />
    </div>
  );
}
