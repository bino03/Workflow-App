import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import {
  deleteDeploy,
  deleteProjectInfo,
  getProjectInfos,
  registerDeploy as registerDeployRequest,
  saveProjectInfo,
} from '@/services/projectInfoService';
import type { DeployInput, ProjectInfo, ProjectInfoInput } from '@/types/projectInfo';

/**
 * As fichas dos projetos (ADR 0028), buscadas uma vez. Cada escrita devolve a ficha nova e entra na lista sem
 * esperar por um refresh. As escritas notificam o erro (`ErrorHandler.handle`) e devolvem `null` em caso de falha.
 */
export function useProjectInfos() {
  const [infos, setInfos] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getProjectInfos()
      .then((list) => {
        if (cancelled) return;
        setInfos(list);
        setError(null);
      })
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (cancelled) return;
        setError(ErrorHandler.getMessage(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  const replace = useCallback((changed: ProjectInfo) => {
    setInfos((current) => [...current.filter((info) => info.projectPath !== changed.projectPath), changed]);
    return changed;
  }, []);

  const save = useCallback(
    async (projectPath: string, info: ProjectInfoInput): Promise<ProjectInfo | null> => {
      try {
        return replace(await saveProjectInfo(projectPath, info));
      } catch (e) {
        ErrorHandler.handle(e);
        return null;
      }
    },
    [replace],
  );

  const remove = useCallback(async (projectPath: string): Promise<boolean> => {
    try {
      await deleteProjectInfo(projectPath);
      setInfos((current) => current.filter((info) => info.projectPath !== projectPath));
      return true;
    } catch (e) {
      ErrorHandler.handle(e);
      return false;
    }
  }, []);

  const registerDeploy = useCallback(
    async (projectPath: string, environmentId: string, deploy: DeployInput): Promise<ProjectInfo | null> => {
      try {
        return replace(await registerDeployRequest(projectPath, environmentId, deploy));
      } catch (e) {
        ErrorHandler.handle(e);
        return null;
      }
    },
    [replace],
  );

  const removeDeploy = useCallback(
    async (projectPath: string, environmentId: string, deployId: string): Promise<ProjectInfo | null> => {
      try {
        return replace(await deleteDeploy(projectPath, environmentId, deployId));
      } catch (e) {
        ErrorHandler.handle(e);
        return null;
      }
    },
    [replace],
  );

  return { infos, loading, error, refresh, save, remove, registerDeploy, removeDeploy };
}
