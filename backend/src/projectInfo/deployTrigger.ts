import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { isInsideRoot } from '../folders/cwdPolicy.js';
import { SESSION_STATE_FILES } from '../terminals/sessionState.js';
import { type SessionStateChange, SessionStateWatcher } from '../terminals/sessionStateWatcher.js';
import type { ProjectInfoService } from './projectInfoService.js';

const DEBOUNCE_MS = 1_000;

export type DeployTriggerOptions = {
  /** DATA_DIR — the hook writes `session-state/<terminal>/push.json` under it. */
  dataDir: string;
  /** The saved cwd of a terminal, never the hook's own (it follows Claude's `cd`). */
  terminalCwd: (terminalId: string) => string | null;
  /** The registry paths. */
  projectPaths: () => Promise<string[]>;
  projectInfo: Pick<ProjectInfoService, 'hasDeployBranch' | 'syncFromGit'>;
  log: FastifyBaseLogger;
  debounceMs?: number;
  /** The shared watcher of session-state/ (ADR 0038); omitted → one of its own, started and stopped with this. */
  watcher?: SessionStateWatcher;
};

/**
 * ADR 0035, point 6: a `git push` / `gh pr merge` in a normal terminal leaves `push.json` = `{at}`; this watches for
 * it and syncs the deploy of the project the terminal runs in. Never throws: a watcher error is only logged.
 */
export class DeployTrigger {
  private readonly watcher: SessionStateWatcher;
  private readonly ownWatcher: boolean;
  private unsubscribe: (() => void) | null = null;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly handled = new Map<string, string>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly stateDir: string;
  private readonly debounceMs: number;

  constructor(private readonly options: DeployTriggerOptions) {
    this.stateDir = join(options.dataDir, SESSION_STATE_FILES.dir);
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
    this.ownWatcher = !options.watcher;
    this.watcher = options.watcher ?? new SessionStateWatcher(options.dataDir, options.log);
  }

  start(): void {
    this.unsubscribe ??= this.watcher.subscribe((change) => this.onChange(change));
    if (this.ownWatcher) this.watcher.start();
  }

  /** Stops watching and waits for a sync already under way. */
  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.ownWatcher) this.watcher.stop();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled([...this.inFlight]);
  }

  private onChange({ terminalId, path }: SessionStateChange): void {
    // `<terminal id>/push.json` — the tmp file of the atomic write and every other file are ignored.
    if (path !== SESSION_STATE_FILES.push) return;
    clearTimeout(this.timers.get(terminalId));
    this.timers.set(
      terminalId,
      setTimeout(() => {
        this.timers.delete(terminalId);
        const work = this.handle(terminalId).catch((error: unknown) => this.options.log.warn({ err: error }, 'deploy trigger: sync failed'));
        this.inFlight.add(work);
        void work.finally(() => this.inFlight.delete(work));
      }, this.debounceMs),
    );
  }

  private async handle(terminalId: string): Promise<void> {
    let at: string;
    try {
      const data = JSON.parse(readFileSync(join(this.stateDir, terminalId, SESSION_STATE_FILES.push), 'utf8')) as { at?: unknown };
      if (typeof data.at !== 'string') return;
      at = data.at;
    } catch {
      return;
    }
    // A rename fires more than once: the same marker is handled once.
    if (this.handled.get(terminalId) === at) return;
    this.handled.set(terminalId, at);
    const cwd = this.options.terminalCwd(terminalId);
    if (!cwd) return;
    // The project folder that holds the terminal's; the deepest wins.
    const project = (await this.options.projectPaths())
      .filter((path) => isInsideRoot(cwd, path))
      .sort((a, b) => b.length - a.length)[0];
    if (!project || !this.options.projectInfo.hasDeployBranch(project)) return;
    const { warnings } = await this.options.projectInfo.syncFromGit(project);
    this.options.log.info({ project, warnings: warnings.length }, 'deploy trigger: synced after a push');
  }
}
