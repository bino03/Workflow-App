/** Espelho de `backend/src/appRuns/appRun.schemas.ts` (ADR 0030, docs/api.md → "Correr e parar a app"). */
export type AppRunPhase = 'unavailable' | 'idle' | 'starting' | 'running' | 'stopping' | 'failed';

/** Porque é que não há botões: o projeto não tem `/run` + `/stop`, ou é a própria Workflow App. */
export type AppRunUnavailableReason = 'missing-skills' | 'self';

/** `no-port` / `exited` = "Não arrancou"; `ports-gone` = "Parou sozinha". */
export type AppRunError = 'no-port' | 'exited' | 'ports-gone';

export type AppRunView = {
  path: string;
  phase: AppRunPhase;
  unavailableReason: AppRunUnavailableReason | null;
  terminalId: string | null;
  /** O clique em Correr. */
  startedAt: string | null;
  /** A primeira porta vista. */
  runningSince: string | null;
  ports: number[];
  error: AppRunError | null;
};
