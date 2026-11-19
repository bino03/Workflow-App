import { type FSWatcher, mkdirSync, readFileSync, watch } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { isInsideRoot } from '../folders/cwdPolicy.js';
import { SESSION_STATE_FILES } from '../terminals/sessionState.js';
import type { ProjectInfoService } from './projectInfoService.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
};

/**
 * ADR 0035, point 6: a `git push` / `gh pr merge` in a normal terminal leaves `push.json` = `{at}`; this watches for
 * it and syncs the deploy of the project the terminal runs in. Never throws: a watcher error is only logged.
 */
export class DeployTrigger {
  private watcher: FSWatcher | null = null;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly handled = new Map<string, string>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly stateDir: string;
  private readonly debounceMs: number;

  constructor(private readonly options: DeployTriggerOptions) {
    this.stateDir = join(options.dataDir, SESSION_STATE_FILES.dir);
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  }

  start(): void {
    try {
      mkdirSync(this.stateDir, { recursive: true });
      this.watcher = watch(this.stateDir, { recursive: true }, (_event, filename) => {
        if (filename) this.onChange(String(filename));
      });
      this.watcher.on('error', (error) => this.options.log.warn({ err: error }, 'deploy trigger: watcher error'));
    } catch (error) {
      this.options.log.warn({ err: error }, 'deploy trigger: could not watch the session state');
    }
  }

  /** Stops watching and waits for a sync already under way. */
  async stop(): Promise<void> {
    this.watcher?.close();
    this.watcher = null;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled([...this.inFlight]);
  }

  private onChange(filename: string): void {
    // `<terminal id>/push.json` — the tmp file of the atomic write and every other file are ignored.
    if (basename(filename) !== SESSION_STATE_FILES.push) return;
    const terminalId = basename(dirname(filename)).toLowerCase();
    if (!UUID.test(terminalId)) return;
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
