import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { createProjectTask, deleteProjectTask, getProjectTasks, updateProjectTask } from '@/services/projectTaskService';
import type { ProjectTask } from '@/types/projectTask';

const byCreation = (tasks: ProjectTask[]) => [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/**
 * As tarefas do projeto ativo (ADR 0037), relidas quando o projeto muda. Cada escrita devolve a tarefa e entra na
 * lista sem novo pedido; um erro notifica (`ErrorHandler.handle`) e a escrita devolve `null`/`false`.
 */
export function useProjectTasks(projectPath: string | null) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath) return;
    let cancelled = false;
    getProjectTasks(projectPath)
      .then((list) => {
        if (cancelled) return;
        setTasks(list);
        setLoadedFor(projectPath);
      })
      .catch((e: unknown) => {
        if (!cancelled) ErrorHandler.handle(e);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const upsert = useCallback((task: ProjectTask) => {
    setTasks((current) => byCreation([...current.filter((t) => t.id !== task.id), task]));
  }, []);

  const add = useCallback(
    async (text: string): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        upsert(await createProjectTask(projectPath, text));
        return true;
      } catch (e) {
        ErrorHandler.handle(e);
        return false;
      }
    },
    [projectPath, upsert],
  );

  const setDone = useCallback(
    async (id: string, done: boolean) => {
      try {
        upsert(await updateProjectTask(id, { done }));
      } catch (e) {
        ErrorHandler.handle(e);
      }
    },
    [upsert],
  );

  /** Apaga e devolve a tarefa apagada (para o "Desfazer"), ou `null` se falhou. */
  const remove = useCallback(async (id: string): Promise<ProjectTask | null> => {
    try {
      const removed = await deleteProjectTask(id);
      setTasks((current) => current.filter((t) => t.id !== id));
      return removed;
    } catch (e) {
      ErrorHandler.handle(e);
      return null;
    }
  }, []);

  const restore = useCallback(
    async (task: ProjectTask) => {
      try {
        const { id, createdAt, done, doneAt } = task;
        upsert(await createProjectTask(task.projectPath, task.text, { id, createdAt, done, doneAt }));
      } catch (e) {
        ErrorHandler.handle(e);
      }
    },
    [upsert],
  );

  // Até a lista do projeto novo chegar, nada da do anterior aparece.
  const current = projectPath && loadedFor === projectPath ? tasks : [];
  return { tasks: current, loaded: loadedFor === projectPath, add, setDone, remove, restore };
}
