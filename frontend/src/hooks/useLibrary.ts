import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { getSkills, getStacks, getThemes } from '@/services/libraryService';
import type { LibraryList, SkillEntry, StackEntry, ThemeEntry } from '@/types/library';

type LibraryData = {
  stacks: LibraryList<StackEntry>;
  themes: LibraryList<ThemeEntry>;
  skills: LibraryList<SkillEntry>;
};

const EMPTY: LibraryData = {
  stacks: { entries: [], invalid: [] },
  themes: { entries: [], invalid: [] },
  skills: { entries: [], invalid: [] },
};

async function fetchLibrary(): Promise<LibraryData> {
  const [stacks, themes, skills] = await Promise.all([getStacks(), getThemes(), getSkills()]);
  return { stacks, themes, skills };
}

/** Hook local da Biblioteca (ADR 0007): as três listas carregam juntas para as contagens das tabs. */
export function useLibrary() {
  const [data, setData] = useState<LibraryData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Os setState só correm quando a promessa resolve — nunca no corpo do efeito.
  useEffect(() => {
    let cancelled = false;
    fetchLibrary()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((e: unknown) => {
        // A página mostra o erro no sítio da tabela. Reclamado mesmo num efeito já cancelado (o
        // StrictMode corre-o duas vezes) — senão o interceptor notifica por cima do erro inline.
        ErrorHandler.handle(e, { showNotification: false });
        if (cancelled) return;
        setError(ErrorHandler.getMessage(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((current) => current + 1);
  }, []);

  return { ...data, loading, error, reload };
}
