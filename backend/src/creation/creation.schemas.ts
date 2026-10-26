import { z } from 'zod';

/** Request bodies of /api/creations — mirrored in `frontend/src/types/guided.ts`. */
export const createCreationSchema = z.object({
  /** The owner's description of the app: the brief `/create --app` reads (ADR 0020). Never on the command line. */
  description: z.string().trim().min(1).max(8000),
});

export type CreateCreation = z.infer<typeof createCreationSchema>;
