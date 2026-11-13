import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { BorderOutlined, CaretRightOutlined } from '@ant-design/icons';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAppRun } from '@/hooks/useAppRun';
import type { AppRunError } from '@/types/appRun';

type AppRunControlProps = {
  /** O projeto ativo. Usar com `key={path}`. */
  path: string;
  /** "Ver terminal": o terminal do `/run` já está na lista do backend; a página mostra-o na grelha. */
  onReveal: (terminalId: string) => void;
};

const ERROR_LABELS: Record<AppRunError, string> = { 'no-port': 'Não arrancou', exited: 'Não arrancou', 'ports-gone': 'Parou sozinha' };

/** "0 min", "12 min", "1 h 05 min" — desde a primeira porta. */
function formatRunningFor(sinceIso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** O minuto corrente, para o "há quanto tempo" subir sem nova sondagem. */
function useMinuteClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [active]);
  // Parado fora de "a correr": ao voltar, mostra no máximo 15 s de atraso (o formatRunningFor nunca dá negativo).
  return now;
}

/**
 * Correr / Parar a app do projeto (spec correr-a-app §4.4, ADR 0030): no cabeçalho dos Terminais, à esquerda do
 * seletor de grelha, também com um terminal ampliado. Sem as skills `/run` + `/stop` (ou na própria Workflow
 * App) não aparece.
 */
export function AppRunControl({ path, onReveal }: AppRunControlProps) {
  const { view, start, stop, reveal } = useAppRun(path);
  const [busy, setBusy] = useState(false);
  const now = useMinuteClock(view?.phase === 'running');

  if (!view || view.phase === 'unavailable') return null;

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setBusy(false);
    }
  };

  const runButton = (
    <Button size="small" icon={<CaretRightOutlined />} loading={busy} onClick={() => void act(start)} data-app-run="start">
      Correr
    </Button>
  );
  const stopButton = (disabled: boolean) => (
    <Button size="small" icon={<BorderOutlined />} disabled={disabled} loading={busy} onClick={() => void act(stop)} data-app-run="stop">
      Parar
    </Button>
  );

  return (
    <div className="flex items-center gap-2.5 text-[13px]" data-app-run-phase={view.phase}>
      {view.phase === 'idle' && runButton}

      {view.phase === 'starting' && (
        <>
          <span className="flex items-center gap-1.5 text-text-2">
            <span className="state-icon is-work" aria-hidden />A arrancar…
          </span>
          {stopButton(false)}
        </>
      )}

      {view.phase === 'running' && (
        <>
          <span className="flex items-center gap-1.5 text-text-1">
            <span className="state-icon is-run" aria-hidden />
            A correr · {view.runningSince ? formatRunningFor(view.runningSince, now) : '0 min'} ·
            {view.ports.map((port, index) => (
              <span key={port}>
                <a href={`http://localhost:${port}`} target="_blank" rel="noreferrer" className="font-mono" data-app-run-port={port}>
                  :{port}
                </a>
                {index < view.ports.length - 1 && ','}
              </span>
            ))}
          </span>
          {stopButton(false)}
        </>
      )}

      {view.phase === 'stopping' && (
        <>
          <span className="flex items-center gap-1.5 text-text-2">
            <span className="state-icon is-work" aria-hidden />A parar…
          </span>
          {stopButton(true)}
        </>
      )}

      {view.phase === 'failed' && (
        <>
          <span className="flex items-center gap-1.5 text-[var(--wfa-state-err)]">
            <span className="state-icon is-err" aria-hidden />
            {view.error ? ERROR_LABELS[view.error] : 'Não arrancou'}
          </span>
          <Button size="small" type="text" disabled={busy} onClick={() => void act(async () => onReveal(await reveal()))} data-app-run="reveal">
            Ver terminal
          </Button>
          {runButton}
        </>
      )}
    </div>
  );
}
