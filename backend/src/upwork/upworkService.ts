import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from '../common/errors.js';
import type { GuidedView } from '../guided/guided.schemas.js';
import type { GuidedService } from '../guided/guidedService.js';
import { isUuid } from '../sessions/claudeSessions.js';
import { atomicWrite } from '../state/atomicWrite.js';
import {
  type Application,
  type ApplicationView,
  type CreateApplication,
  type PatchApplication,
  type ProfileView,
  applicationSchema,
} from './upwork.schemas.js';
import { PROFILE_TEMPLATE, UPWORK_FILES, jobMarkdown, titleFromJob, upworkPaths } from './upworkFiles.js';

export type UpworkServiceDeps = {
  dataDir: string;
  /** The Workflow: where `/upwork-proposal` runs. */
  workflowPath: string;
  guided: Pick<GuidedService, 'start' | 'get' | 'remove'>;
  now?: () => Date;
};

/**
 * The Upwork section (ADR 0022): the owner's profile and the applications, each one a record plus a long guided
 * session of `/upwork-proposal`. Never talks to the Upwork — everything comes in pasted and goes out copied.
 */
export class UpworkService {
  private readonly now: () => Date;
  private readonly paths: ReturnType<typeof upworkPaths>;

  constructor(private readonly deps: UpworkServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.paths = upworkPaths(deps.dataDir);
  }

  /** The saved profile, or the template (updatedAt null) while there is none. */
  getProfile(): ProfileView {
    try {
      return { markdown: readFileSync(this.paths.profile, 'utf8'), updatedAt: statSync(this.paths.profile).mtime.toISOString() };
    } catch {
      return { markdown: PROFILE_TEMPLATE, updatedAt: null };
    }
  }

  async putProfile(markdown: string): Promise<ProfileView> {
    mkdirSync(this.paths.dir, { recursive: true });
    await atomicWrite(this.paths.profile, markdown.endsWith('\n') ? markdown : `${markdown}\n`);
    return this.getProfile();
  }

  /** Most recent first; a folder without a valid record (a start that died) is not one. */
  list(archived: boolean): ApplicationView[] {
    if (!existsSync(this.paths.applications)) return [];
    return readdirSync(this.paths.applications)
      .filter(isUuid)
      .map((id) => this.readRecord(id))
      .filter((record): record is Application => record !== null && record.archived === archived)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((record) => this.view(record));
  }

  /**
   * A new application: the record and its guided session. The skill reads `job.md` and a copy of the profile taken
   * now — the proposal stays tied to the profile of the day it was written.
   */
  async create({ job, screeningQuestions, url }: CreateApplication): Promise<ApplicationView> {
    if (!existsSync(this.paths.profile)) throw new AppError('UPWORK_002');
    const library = join(this.deps.workflowPath, 'library');
    if (!existsSync(library) || !statSync(library).isDirectory()) throw new AppError('LIBRARY_001');

    const id = randomUUID();
    const guided = await this.deps.guided.start({
      purpose: 'upwork',
      cwd: this.deps.workflowPath,
      input: jobMarkdown(id, job, screeningQuestions),
      files: { [UPWORK_FILES.profile]: readFileSync(this.paths.profile, 'utf8') },
    });
    const at = this.now().toISOString();
    const record: Application = {
      version: 1,
      id,
      title: titleFromJob(job),
      url: url ?? null,
      clientName: null,
      status: 'draft',
      history: [{ status: 'draft', at }],
      connectsSpent: null,
      notes: '',
      guidedId: guided.id,
      agreement: null,
      creationGuidedId: null,
      projectPath: null,
      archived: false,
      createdAt: at,
      updatedAt: at,
    };
    try {
      mkdirSync(this.paths.folderOf(id), { recursive: true });
      await this.write(record);
    } catch (error) {
      // A session without its record could never be listed or closed.
      await this.deps.guided.remove(guided.id);
      rmSync(this.paths.folderOf(id), { recursive: true, force: true });
      throw error;
    }
    return this.view(record, guided);
  }

  get(id: string): ApplicationView {
    return this.view(this.record(id));
  }

  /** Free, manual changes (ADR 0022 point 6): any status to any other, each one added to the history. */
  async patch(id: string, changes: PatchApplication): Promise<ApplicationView> {
    const record = this.record(id);
    if (record.archived) throw new AppError('UPWORK_004');
    const at = this.now().toISOString();
    const next: Application = { ...record, ...changes, updatedAt: at };
    if (changes.status !== undefined && changes.status !== record.status) next.history = [...record.history, { status: changes.status, at }];
    await this.write(next);
    return this.view(next);
  }

  private record(id: string): Application {
    const record = isUuid(id) ? this.readRecord(id) : null;
    if (!record || record.id !== id) throw new AppError('UPWORK_001');
    return record;
  }

  private readRecord(id: string): Application | null {
    try {
      const parsed = applicationSchema.safeParse(JSON.parse(readFileSync(this.paths.recordOf(id), 'utf8')));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async write(record: Application): Promise<void> {
    await atomicWrite(this.paths.recordOf(record.id), `${JSON.stringify(record, null, 2)}\n`);
  }

  /** The session is gone after archiving (guidedId null), or if it was removed by hand: null, not an error. */
  private guidedOf(record: Application): GuidedView | null {
    if (record.guidedId === null) return null;
    try {
      return this.deps.guided.get(record.guidedId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'GUIDED_001') return null;
      throw error;
    }
  }

  private view(record: Application, guided?: GuidedView): ApplicationView {
    const rest: Omit<Application, 'version'> & { version?: 1 } = { ...record };
    delete rest.version;
    return { ...rest, guided: guided ?? this.guidedOf(record), package: null, packageError: null };
  }
}
