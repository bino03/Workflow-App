/** Espelho de GET /api/projects (backend/src/projects/project.schemas.ts). */
export type ProjectEntry = {
  name: string;
  /** Absoluto, já validado contra ALLOWED_ROOTS. */
  path: string;
  type: string | null;
  stack: string | null;
  status: string | null;
};
