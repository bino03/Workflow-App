import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atomicWrite } from '../src/state/atomicWrite.js';
import {
  type ClosedTerminal,
  MAX_CLOSED_TERMINALS,
  MAX_RECENT_FOLDERS,
  type SavedTerminal,
} from '../src/state/state.schema.js';
import { StateFileError, StateStore } from '../src/state/stateStore.js';

const T0 = Date.parse('2026-09-28T10:00:00.000Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString();

function savedTerminal(overrides: Partial<SavedTerminal> = {}): SavedTerminal {
  return {
    id: randomUUID(),
    label: null,
    cwd: 'C:\\projetos\\app',
    claudeSessionId: randomUUID(),
    createdAt: at(0),
    updatedAt: at(0),
    lastOpenedAt: at(0),
    ...overrides,
  };
}

function closedTerminal(closedAt: string): ClosedTerminal {
  return {
    id: randomUUID(),
    label: null,
    cwd: 'C:\\projetos\\app',
    claudeSessionId: randomUUID(),
    openedAt: at(0),
    closedAt,
    summary: null,
    summarySource: null,
  };
}

describe('StateStore', () => {
  let dataDir: string;
  let file: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'wfa-state-'));
    file = join(dataDir, 'state.json');
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('missing file → empty state, and nothing written until the first change', async () => {
    const store = await StateStore.load(dataDir);
    expect(store.read()).toEqual({ version: 1, terminals: [], closedTerminals: [], folders: [] });
    await store.flush();
    expect(existsSync(file)).toBe(false);
  });

  it('creates DATA_DIR when it does not exist', async () => {
    const nested = join(dataDir, 'a', 'b');
    const store = await StateStore.load(nested);
    store.update((draft) => void draft.folders.push({ path: 'C:\\x', favorite: true }));
    await store.flush();
    expect(existsSync(join(nested, 'state.json'))).toBe(true);
  });

  it('writes, and a new store reads back the same state', async () => {
    const store = await StateStore.load(dataDir);
    const terminal = savedTerminal({ label: 'api' });
    store.update((draft) => void draft.terminals.push(terminal));
    await store.flush();

    const reloaded = await StateStore.load(dataDir);
    expect(reloaded.read().terminals).toEqual([terminal]);
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });

  it.each([
    ['not JSON', '{ "version": 1,'],
    ['wrong shape', JSON.stringify({ version: 1, terminals: [{ id: 'nope' }], closedTerminals: [], folders: [] })],
    ['duplicate folder paths', JSON.stringify({ version: 1, terminals: [], closedTerminals: [], folders: [{ path: 'C:\\a' }, { path: 'C:\\a' }] })],
    ['newer version', JSON.stringify({ version: 2, terminals: [], closedTerminals: [], folders: [] })],
  ])('invalid file (%s) → StateFileError, and the file is left untouched', async (_case, content) => {
    await writeFile(file, content);
    await expect(StateStore.load(dataDir)).rejects.toBeInstanceOf(StateFileError);
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('the error lists paths and reasons', async () => {
    await writeFile(file, JSON.stringify({ version: 1, terminals: [{ ...savedTerminal(), claudeSessionId: 'x' }], closedTerminals: [], folders: [] }));
    const error = await StateStore.load(dataDir).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StateFileError);
    expect((error as StateFileError).issues.some((issue) => issue.startsWith('terminals.0.claudeSessionId:'))).toBe(true);
  });

  it('an invalid update throws and changes nothing', async () => {
    const store = await StateStore.load(dataDir);
    expect(() => store.update((draft) => void draft.terminals.push(savedTerminal({ label: 'x'.repeat(81) })))).toThrow();
    expect(store.read().terminals).toEqual([]);
    await store.flush();
    expect(existsSync(file)).toBe(false);
  });

  it('read() returns a copy', async () => {
    const store = await StateStore.load(dataDir);
    store.read().folders.push({ path: 'C:\\x', favorite: false });
    expect(store.read().folders).toEqual([]);
  });

  it('keeps only the 200 newest closed terminals, newest first', async () => {
    const store = await StateStore.load(dataDir);
    store.update((draft) => {
      for (let i = 0; i < MAX_CLOSED_TERMINALS + 5; i++) draft.closedTerminals.push(closedTerminal(at(i)));
    });
    const { closedTerminals } = store.read();
    expect(closedTerminals).toHaveLength(MAX_CLOSED_TERMINALS);
    expect(closedTerminals[0]?.closedAt).toBe(at(MAX_CLOSED_TERMINALS + 4));
    expect(closedTerminals.at(-1)?.closedAt).toBe(at(5));
    await store.flush();
  });

  it('keeps 10 recent non-favourite folders; favourites never drop or count', async () => {
    const store = await StateStore.load(dataDir);
    store.update((draft) => {
      for (let i = 0; i < 3; i++) draft.folders.push({ path: `C:\\fav${i}`, favorite: true });
      for (let i = 0; i < MAX_RECENT_FOLDERS + 4; i++) draft.folders.push({ path: `C:\\r${i}`, favorite: false, lastUsedAt: at(i) });
    });
    const { folders } = store.read();
    expect(folders.filter((f) => f.favorite)).toHaveLength(3);
    const recents = folders.filter((f) => !f.favorite).map((f) => f.path);
    expect(recents).toHaveLength(MAX_RECENT_FOLDERS);
    expect(recents[0]).toBe(`C:\\r${MAX_RECENT_FOLDERS + 3}`);
    expect(recents).not.toContain('C:\\r3');
    await store.flush();
  });

  it('un-favouriting a folder puts it back under the limit', async () => {
    const store = await StateStore.load(dataDir);
    store.update((draft) => {
      draft.folders.push({ path: 'C:\\old', favorite: true, lastUsedAt: at(-100) });
      for (let i = 0; i < MAX_RECENT_FOLDERS; i++) draft.folders.push({ path: `C:\\r${i}`, favorite: false, lastUsedAt: at(i) });
    });
    store.update((draft) => {
      const old = draft.folders.find((f) => f.path === 'C:\\old');
      if (old) old.favorite = false;
    });
    expect(store.read().folders.map((f) => f.path)).not.toContain('C:\\old');
    // Without this, afterEach removes the folder while the queued write is still renaming into it.
    await store.flush();
  });

  it('queues writes one at a time and the file ends with the newest state', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const writes: string[] = [];
    const store = await StateStore.load(dataDir, {
      write: async (target, data) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        await atomicWrite(target, data);
        writes.push(data);
        inFlight--;
      },
    });
    for (let i = 0; i < 20; i++) store.update((draft) => void draft.folders.push({ path: `C:\\f${i}`, favorite: true }));
    await store.flush();

    expect(maxInFlight).toBe(1);
    expect(writes.length).toBeLessThan(20); // changes made during a write are coalesced
    const onDisk = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk.folders).toHaveLength(20);
  });

  it('a failed write is logged and the state stays in memory; the next change writes it', async () => {
    let fail = true;
    const store = await StateStore.load(dataDir, {
      write: async (target, data) => {
        if (fail) throw new Error('disk full');
        await atomicWrite(target, data);
      },
    });
    const logged = vi.fn();
    store.logger = { error: logged };

    store.update((draft) => void draft.folders.push({ path: 'C:\\a', favorite: true }));
    await store.flush();
    expect(logged).toHaveBeenCalledOnce();
    expect(existsSync(file)).toBe(false);
    expect(store.read().folders).toHaveLength(1);

    fail = false;
    store.update((draft) => void draft.folders.push({ path: 'C:\\b', favorite: true }));
    await store.flush();
    expect(JSON.parse(await readFile(file, 'utf8')).folders).toHaveLength(2);
  });
});

describe('atomicWrite', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wfa-atomic-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const errno = (code: string) => Object.assign(new Error(code), { code });

  it('retries the rename on EPERM/EBUSY and succeeds', async () => {
    const { rename } = await import('node:fs/promises');
    const failures = ['EPERM', 'EBUSY'];
    const flaky = vi.fn(async (from: string, to: string) => {
      const code = failures.shift();
      if (code) throw errno(code);
      await rename(from, to);
    });
    const target = join(dir, 'state.json');
    await atomicWrite(target, 'ok', { rename: flaky, baseDelayMs: 1 });
    expect(flaky).toHaveBeenCalledTimes(3);
    expect(await readFile(target, 'utf8')).toBe('ok');
  });

  it('gives up after the retries, and does not retry other errors', async () => {
    const alwaysBusy = vi.fn(async () => {
      throw errno('EBUSY');
    });
    await expect(atomicWrite(join(dir, 'a.json'), 'x', { rename: alwaysBusy, retries: 2, baseDelayMs: 1 })).rejects.toThrow('EBUSY');
    expect(alwaysBusy).toHaveBeenCalledTimes(3);

    const notFound = vi.fn(async () => {
      throw errno('ENOENT');
    });
    await expect(atomicWrite(join(dir, 'b.json'), 'x', { rename: notFound, baseDelayMs: 1 })).rejects.toThrow('ENOENT');
    expect(notFound).toHaveBeenCalledOnce();
  });
});
