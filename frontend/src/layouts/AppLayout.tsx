import { useState } from 'react';
import { DownOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { Dropdown, type MenuProps } from 'antd';
import { Link, NavLink, Outlet } from 'react-router';
import { Wordmark } from '@/components/common/Wordmark';
import { SettingsDrawer } from '@/components/settings/SettingsDrawer';
import { useAuth } from '@/hooks/useAuth';
import { useBackendHealth, type BackendHealth } from '@/hooks/useBackendHealth';
import { useConfirm } from '@/hooks/useConfirm';

// Única fonte de verdade da navegação persistente (app-shell-and-auth.md §2).
const NAV_ITEMS = [
  { to: '/terminals', label: 'Terminais' },
  { to: '/library', label: 'Biblioteca' },
];

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

export function AppLayout() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const health = useBackendHealth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const userMenu: MenuProps['items'] = [
    { key: 'settings', icon: <SettingOutlined />, label: 'Definições', onClick: () => setSettingsOpen(true) },
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
      <header className="h-12 flex-none flex items-center gap-7 pl-5 pr-4 border-b border-border">
        <Link to="/terminals" aria-label="Workflow — Terminais" className="flex">
          <Wordmark />
        </Link>
        <nav className="flex self-stretch gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-3 text-[13.5px] font-medium no-underline transition-colors ${
                  isActive ? 'text-text-1 shadow-[inset_0_-2px_0_var(--wfa-color-accent)]' : 'text-text-2 hover:text-text-1'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            aria-label="Menu de utilizador"
            className="flex items-center gap-1.5 bg-transparent border-0 cursor-pointer text-text-3 p-0"
          >
            <span className="w-[26px] h-[26px] rounded-full bg-surface-3 border border-border-strong flex items-center justify-center text-text-1 text-[12px]">
              <UserOutlined />
            </span>
            <DownOutlined className="text-[10px]" />
          </button>
        </Dropdown>
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>

      <footer className="h-[26px] flex-none flex items-center gap-4 px-4 border-t border-border text-[11.5px] text-text-3">
        <span className="flex items-center gap-1.5" role="status">
          <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT[health]}`} />
          {HEALTH_LABEL[health]}
        </span>
        <div className="flex-1" />
        <span className="font-mono">v{__APP_VERSION__}</span>
      </footer>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
