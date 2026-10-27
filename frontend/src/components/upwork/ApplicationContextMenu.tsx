import { Dropdown, type MenuProps } from 'antd';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { EXIT_STATUSES, NEXT_STATUS, STATUS_TAG, canArchive } from '@/components/upwork/upworkFormat';
import { useApplicationActions } from '@/hooks/useApplicationActions';
import type { ApplicationStatus, ApplicationView } from '@/types/upwork';

type MenuItems = NonNullable<MenuProps['items']>;

type ApplicationContextMenuProps = {
  application: ApplicationView;
  /** O cartão da lista: o botão direito (ou a tecla de menu) sobre ele abre o menu. */
  children: ReactElement;
  onChanged: (application: ApplicationView) => void;
  onRemoved: (id: string) => void;
  /** Novo projeto: o modal do acordo vive na página. */
  onCreateProject: (id: string) => void;
};

/**
 * Menu de contexto de uma candidatura na lista: o passo seguinte do estado (e as saídas), Novo projeto quando ganha,
 * copiar a carta, abrir o anúncio, arquivar ou apagar. Age sobre esta candidatura sem a abrir.
 */
export function ApplicationContextMenu({ application, children, onChanged, onRemoved, onCreateProject }: ApplicationContextMenuProps) {
  const navigate = useNavigate();
  const actions = useApplicationActions({ onChanged, onRemoved });
  const items = menuItems(application);
  if (items.length === 0) return children;

  const onClick: MenuProps['onClick'] = ({ key }) => {
    const [action, status] = key.split(':');
    switch (action) {
      case 'status':
        actions.changeStatus(application, status as ApplicationStatus);
        break;
      case 'project':
        onCreateProject(application.id);
        break;
      case 'creation':
        void navigate('/new-project');
        break;
      case 'open-project':
        if (application.projectPath) actions.openProject(application.projectPath);
        break;
      case 'copy':
        if (application.package?.coverLetter) void actions.copyLetter(application.package.coverLetter);
        break;
      case 'post':
        // Um link do dono, aberto por ele num separador novo: a app continua sem ler a Upwork (ADR 0022).
        if (application.url) window.open(application.url, '_blank', 'noopener,noreferrer');
        break;
      case 'archive':
        actions.archive(application);
        break;
      case 'delete':
        actions.remove(application);
        break;
    }
  };

  return (
    <Dropdown trigger={['contextMenu']} menu={{ items, onClick }}>
      {children}
    </Dropdown>
  );
}

function menuItems(application: ApplicationView): MenuItems {
  const groups: MenuItems[] = [];
  if (!application.archived) {
    const next = NEXT_STATUS[application.status];
    const exits = EXIT_STATUSES[application.status] ?? [];
    groups.push(next ? [statusItem(next)] : []);
    groups.push(exits.map(statusItem));
    const project: MenuItems = [];
    if (application.status === 'won' && application.projectPath === null) project.push({ key: 'project', label: 'Novo projeto' });
    if (application.creationGuidedId && application.projectPath === null) project.push({ key: 'creation', label: 'Ver criação' });
    if (application.projectPath) project.push({ key: 'open-project', label: 'Abrir projeto' });
    groups.push(project);
  }
  groups.push([
    ...(application.package?.coverLetter ? [{ key: 'copy', label: 'Copiar carta' }] : []),
    ...(application.url ? [{ key: 'post', label: 'Abrir anúncio' }] : []),
  ]);
  if (!application.archived && canArchive(application)) groups.push([{ key: 'archive', label: 'Arquivar' }]);
  if (application.archived) groups.push([{ key: 'delete', label: 'Apagar', danger: true }]);

  // Uma linha entre grupos, nunca no início, no fim ou duas seguidas.
  return groups
    .filter((group) => group.length > 0)
    .flatMap((group, index) => (index === 0 ? group : [{ type: 'divider' as const }, ...group]));
}

function statusItem(status: ApplicationStatus) {
  return { key: `status:${status}`, label: `Marcar como ${STATUS_TAG[status].label}` };
}
