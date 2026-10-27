import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { z } from 'zod';
import type { AttachmentsView } from './upwork.schemas.js';

/**
 * The screenshots `/upwork-proposal` picked to attach (Workflow: docs/skills/skill-upwork-proposal.md Step 2b, ADR 0024):
 * `attachments.json`, next to the package. Each item names a screenshot of the portfolio's catalog —
 * `PORTFOLIO_PATH/public/images/projects/<slug>/<file>`. Written by a process the backend started, so parsed like the
 * package: a bad file never breaks a request.
 */

export const ATTACHMENTS_FILE = 'attachments.json';

/** Where the portfolio keeps its screenshots, one folder per project. */
export const PORTFOLIO_IMAGES = ['public', 'images', 'projects'] as const;

export const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

const imageName = /\.(png|jpe?g|webp)$/i;

export const attachmentsSchema = z.object({
  version: z.literal(1),
  updatedAt: z.iso.datetime(),
  items: z
    .array(
      z.object({
        project: z.string().trim().min(1).max(120),
        slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'tem de ser a pasta do projeto, em kebab-case'),
        // The catalog's names have spaces and accents; never a folder, `..` or a drive.
        file: z
          .string()
          .min(1)
          .max(200)
          .regex(/^[^/\\:*?"<>|]+$/, 'tem de ser um nome de ficheiro, sem pastas')
          .refine((name) => !name.startsWith('.'), 'não pode começar por ponto')
          .refine((name) => imageName.test(name), 'tem de ser uma imagem (.png, .jpg, .webp)'),
        uploadName: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}\.(png|jpe?g|webp)$/, 'tem de ser ASCII em kebab-case, com extensão de imagem'),
        caption: z.string().trim().min(1).max(300),
      }),
    )
    .max(10),
  missing: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
});

export type Attachments = z.infer<typeof attachmentsSchema>;

export type AttachmentsRead = { attachments: AttachmentsView | null; error: string | null };

/**
 * The image an item names, or null when it is not there (or resolves outside the portfolio's images folder — a
 * junction cannot take it elsewhere).
 */
export function attachmentFile(portfolioPath: string | undefined, item: { slug: string; file: string }): string | null {
  if (portfolioPath === undefined) return null;
  const root = join(portfolioPath, ...PORTFOLIO_IMAGES);
  const file = join(root, item.slug, item.file);
  try {
    if (!existsSync(file) || !statSync(file).isFile()) return null;
    const realRoot = realpathSync(root);
    const realFile = realpathSync(file);
    return realFile.startsWith(realRoot + sep) ? realFile : null;
  } catch {
    return null;
  }
}

/** The parsed file, or null with no error when there is none (an older package, or the skill still writing). */
export function parseAttachments(dir: string): { data: Attachments | null; error: string | null } {
  const file = join(dir, ATTACHMENTS_FILE);
  if (!existsSync(file)) return { data: null, error: null };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { data: null, error: 'attachments.json inválido: não é JSON' };
  }
  const parsed = attachmentsSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { data: null, error: `attachments.json inválido: ${issue.path.join('.') || '(raiz)'} — ${issue.message}` };
  }
  return { data: parsed.data, error: null };
}

/** What the detail shows: each item, and whether its image can be served (`available`). */
export function readAttachments(dir: string, portfolioPath: string | undefined): AttachmentsRead {
  const { data, error } = parseAttachments(dir);
  if (data === null) return { attachments: null, error };
  return {
    attachments: {
      updatedAt: data.updatedAt,
      portfolioConfigured: portfolioPath !== undefined,
      items: data.items.map((item) => ({ ...item, available: attachmentFile(portfolioPath, item) !== null })),
      missing: data.missing,
    },
    error: null,
  };
}
