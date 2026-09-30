/**
 * Surgical edits to the frontmatter of a Workflow manifest. Pure — no I/O.
 *
 * The app may only touch the `provides-skills` array of a `STACK.md` (ADR 0014); everything else in
 * the file must come out byte-for-byte identical, so nothing here re-serializes the YAML: it finds
 * the one line (or block) that holds the list and rewrites just that span.
 */

const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/;
const KEY_LINE = /^provides-skills:[ \t]*(.*)$/m;
const ITEM_LINE = /^([ \t]+)-[ \t]*(.*)$/;

type Line = { start: number; end: number; eol: string };

function lines(text: string): Line[] {
  const found: Line[] = [];
  const breaks = /\r\n|\n|\r/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = breaks.exec(text)) !== null) {
    found.push({ start, end: match.index, eol: match[0] });
    start = breaks.lastIndex;
  }
  found.push({ start, end: text.length, eol: '' });
  return found;
}

/** `"a"` / `'a'` / `a` → `a`. Only for comparing names, never for writing them back. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  return (quote === '"' || quote === "'") && trimmed.endsWith(quote) && trimmed.length > 1
    ? trimmed.slice(1, -1)
    : trimmed;
}

/** Strips an unquoted trailing `# comment`, which YAML allows after a value. */
function withoutComment(value: string): { value: string; comment: string } {
  const hash = value.search(/(^|\s)#/);
  return hash === -1 ? { value, comment: '' } : { value: value.slice(0, hash), comment: value.slice(hash) };
}

function splitFlow(inner: string): string[] {
  return inner
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Adds `name` to the `provides-skills` list of a `STACK.md`, keeping the rest of the file untouched.
 * Idempotent: a name already in the list returns the text unchanged (same string, not a copy).
 * Handles the three shapes the Workflow's manifests use — inline flow (`[a, b]`), a block list of
 * `- item` lines, and a missing key (the schema defaults it to `[]`).
 *
 * @throws if the text has no `--- … ---` frontmatter block at the top.
 */
export function withSkillAddedToProvidesSkills(stackMdText: string, name: string): string {
  const bom = stackMdText.charCodeAt(0) === 0xfeff ? '\ufeff' : '';
  const text = bom === '' ? stackMdText : stackMdText.slice(1);
  const block = FRONTMATTER.exec(text);
  if (!block) throw new Error('no frontmatter block (--- … ---) at the top of the file');

  const [whole, open = '', body = '', close = ''] = block;
  const nextBody = withNameInList(body, name.trim());
  return nextBody === body ? stackMdText : bom + open + nextBody + close + text.slice(whole.length);
}

function withNameInList(body: string, name: string): string {
  const key = KEY_LINE.exec(body);
  const eol = body.includes('\r\n') ? '\r\n' : '\n';

  if (!key) {
    // No key at all: the reading schema defaults it to `[]`, so the list is empty — add it last.
    const separator = body.length === 0 || body.endsWith('\n') || body.endsWith('\r') ? '' : eol;
    return `${body}${separator}provides-skills: [${name}]`;
  }

  const keyStart = key.index;
  const keyEnd = keyStart + key[0].length;
  const { value, comment } = withoutComment(key[1] ?? '');
  const flow = /^\s*\[([\s\S]*)\]\s*$/.exec(value);

  if (flow) {
    const items = splitFlow(flow[1] ?? '');
    if (items.some((item) => unquote(item) === name)) return body;
    return `${body.slice(0, keyStart)}provides-skills: [${[...items, name].join(', ')}]${comment}${body.slice(keyEnd)}`;
  }

  if (value.trim() !== '') {
    // A scalar (`provides-skills: something`) is not a list we know how to extend safely.
    throw new Error(`provides-skills is not a list: ${key[0]}`);
  }

  // Bare key: either a block list below it, or nothing (null).
  const all = lines(body);
  const keyIndex = all.findIndex((line) => line.start === keyStart);
  const items: { line: Line; indent: string; value: string }[] = [];
  for (let i = keyIndex + 1; i < all.length; i += 1) {
    const line = all[i];
    if (!line) break;
    const item = ITEM_LINE.exec(body.slice(line.start, line.end));
    if (!item) break;
    items.push({ line, indent: item[1] ?? '  ', value: item[2] ?? '' });
  }

  if (items.length === 0) {
    return `${body.slice(0, keyStart)}provides-skills: [${name}]${comment}${body.slice(keyEnd)}`;
  }
  if (items.some((item) => unquote(withoutComment(item.value).value) === name)) return body;

  const last = items[items.length - 1];
  if (!last) return body;
  const insertAt = last.line.end;
  return `${body.slice(0, insertAt)}${last.line.eol === '' ? eol : last.line.eol}${last.indent}- ${name}${body.slice(insertAt)}`;
}
