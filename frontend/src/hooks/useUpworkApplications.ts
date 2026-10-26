import { useCallback, useEffect, useState } from 'react';
import { ErrorHandler } from '@/errors/errorHandler';
import { getApplications, getProfile } from '@/services/upworkService';
import type { ApplicationView, ProfileView } from '@/types/upwork';

/** As candidaturas (abertas ou arquivadas) e o perfil — sem perfil, a página pede-o antes da primeira. */
export function useUpworkApplications(archived: boolean) {
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A carga atual acabou quando a chave carregada é a pedida — muda ao alternar "arquivadas" ou no refresh.
  const requested = `${archived}:${attempt}`;
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getApplications(archived), getProfile()])
      .then(([list, currentProfile]) => {
        if (cancelled) return;
        setApplications(list);
        setProfile(currentProfile);
        setError(null);
      })
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (cancelled) return;
        setError(ErrorHandler.getMessage(e));
      })
      .finally(() => !cancelled && setLoaded(`${archived}:${attempt}`));
    return () => {
      cancelled = true;
    };
  }, [archived, attempt]);

  const loading = loaded !== requested;

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  /** Uma candidatura que mudou (criada, editada, arquivada) entra na lista sem esperar pelo refresh. */
  const replace = useCallback(
    (changed: ApplicationView) =>
      setApplications((current) => {
        const others = current.filter((application) => application.id !== changed.id);
        return changed.archived === archived ? [changed, ...others].sort(byNewest) : others;
      }),
    [archived],
  );

  const remove = useCallback(
    (id: string) => setApplications((current) => current.filter((application) => application.id !== id)),
    [],
  );

  return { applications, profile, setProfile, loading, error, refresh, replace, remove };
}

function byNewest(a: ApplicationView, b: ApplicationView) {
  return b.createdAt.localeCompare(a.createdAt);
}
