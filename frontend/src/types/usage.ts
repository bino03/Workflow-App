/** Espelho de backend/src/usage/usageFiles.ts (docs/api.md → Quota). */
export type UsageWindow = { usedPct: number; resetsAt: string };

export type UsageView = {
  fiveHour: UsageWindow | null;
  weekly: UsageWindow | null;
  /** Quando a status line de algum terminal a viu pela última vez. */
  fetchedAt: string | null;
};
