export type ProjectEntry = {
  name: string;
  /** Absolute, already checked against ALLOWED_ROOTS (`resolveAllowedPath`). */
  path: string;
  type: string | null;
  stack: string | null;
  status: string | null;
};
