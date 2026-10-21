import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseWith } from '../common/validation.js';
import { keyBindingSchema } from '../state/state.schema.js';
import type { KeybindingsService } from './keybindingsService.js';

const paramsSchema = z.object({ actionId: z.string().min(1).max(64) });
const bodySchema = z.object({ binding: keyBindingSchema.nullable() });

export type KeybindingsRoutesOptions = {
  keybindingsService: KeybindingsService;
};

/** Keyboard shortcuts (docs/api.md → Atalhos, ADR 0016). Session required. Every route returns the full view. */
export async function keybindingsRoutes(app: FastifyInstance, { keybindingsService }: KeybindingsRoutesOptions): Promise<void> {
  app.get('/api/keybindings', async () => keybindingsService.view());

  // Registered before /:actionId so "reset" is never read as an action id.
  app.post('/api/keybindings/reset', async () => keybindingsService.resetAll());

  app.put('/api/keybindings/:actionId', async (request) => {
    const { actionId } = parseWith(paramsSchema, request.params);
    const { binding } = parseWith(bodySchema, request.body);
    return keybindingsService.set(actionId, binding);
  });

  app.delete('/api/keybindings/:actionId', async (request) => {
    const { actionId } = parseWith(paramsSchema, request.params);
    return keybindingsService.reset(actionId);
  });
}
