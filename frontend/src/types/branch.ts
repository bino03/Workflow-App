/** Espelho de GET /api/branches (backend/src/terminals/gitBranches.ts): só leitura, sem correr o git. */
export type BranchList = { current: string | null; branches: string[] };
