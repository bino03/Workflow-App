import { useEffect, useState } from 'react';
import { BranchesOutlined } from '@ant-design/icons';
import { ErrorHandler } from '@/errors/errorHandler';
import { getBranches } from '@/services/branchService';
import type { BranchList } from '@/types/branch';
import { SIDEBAR_ROW, SidebarGroup } from './SidebarGroup';

/**
 * BRANCHES na lateral (proposta C do ADR 0036): os branches locais do projeto, só para ver (o dono decidiu: mudar de
 * branch com terminais abertos é perigoso), com o atual marcado. Sem `↑n`: isso obrigava a correr o git.
 * `refreshKey` muda com os terminais (o branch de um painel mudou → relê).
 */
export function BranchesGroup({ path, refreshKey }: { path: string; refreshKey: string }) {
  const [list, setList] = useState<BranchList | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBranches(path)
      .then((result) => !cancelled && setList(result))
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setList(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey]);

  if (!list || list.branches.length === 0) return null;
  return (
    <SidebarGroup id="branches" title="BRANCHES" count={list.branches.length}>
      {list.branches.map((branch) => {
        const current = branch === list.current;
        return (
          <div key={branch} data-branch={branch} aria-current={current ? 'true' : undefined} title={current ? `${branch} (atual)` : branch} className={`${SIDEBAR_ROW} cursor-default`}>
            <span className="flex-1 min-w-0 truncate font-mono text-[12px]">{branch}</span>
            {current && <BranchesOutlined className="flex-none text-accent text-[11px]" aria-label="branch atual" />}
          </div>
        );
      })}
    </SidebarGroup>
  );
}
