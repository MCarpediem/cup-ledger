import { afterEach, describe, expect, it } from 'vitest';
import { LedgerDB } from './db';
import { catalog } from './catalog';
import { emptySnapshot, mergeSnapshots, readSnapshot, syncOnce, validateSnapshot, type SyncTransport } from './cloudSync';

const databases: LedgerDB[] = [];
function database() { const result = new LedgerDB(`sync-test-${crypto.randomUUID()}`); databases.push(result); return result; }
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())); });
describe('cloud synchronization', () => {
  it('merges independent device additions and propagates deletion', () => {
    const base = emptySnapshot(); base.templates = [catalog[0]];
    const local = { ...base, templates: [catalog[1]] };
    const remote = { ...base, templates: [catalog[0], catalog[2]] };
    expect(mergeSnapshots(base, local, remote).templates.map(row => row.id).sort()).toEqual([catalog[1].id, catalog[2].id].sort());
  });
  it('stops conflicting edits without choosing a device', () => {
    const base = emptySnapshot(); base.templates = [catalog[0]];
    expect(() => mergeSnapshots(base, { ...base, templates: [{ ...catalog[0], volume: 100 }] }, { ...base, templates: [{ ...catalog[0], volume: 200 }] })).toThrow('暂停同步');
  });
  it('preserves local data and baseline when atomic upload loses a race', async () => {
    const db = database(); await db.templates.put(catalog[0]);
    const transport: SyncTransport = { read: async () => null, write: async () => null };
    await expect(syncOnce(db, transport)).rejects.toThrow('重试同步');
    expect(await db.templates.count()).toBe(1); expect(await db.sync.get('base')).toBeUndefined();
  });
  it('keeps changes made while uploading and also applies remote additions', async () => {
    const db = database(); await db.templates.put(catalog[0]);
    const remote = emptySnapshot(); remote.templates = [catalog[1]];
    const transport: SyncTransport = {
      read: async () => ({ payload: remote, updated_at: 'previous' }),
      write: async (_payload, expected) => { expect(expected).toBe('previous'); await db.templates.put(catalog[2]); return 'next'; },
    };
    await syncOnce(db, transport);
    expect((await readSnapshot(db)).templates).toHaveLength(3);
    expect(await db.sync.get('base')).toBeDefined();
  });
  it('keeps separate account caches', async () => {
    const a = database(); const b = database(); await a.templates.put(catalog[0]);
    expect(await b.templates.count()).toBe(0);
  });
  it('retains pending data on network failure', async () => {
    const db = database(); await db.templates.put(catalog[0]);
    await expect(syncOnce(db, { read: async () => { throw new Error('offline'); }, write: async () => 'never' })).rejects.toThrow('offline');
    expect(await db.templates.count()).toBe(1);
  });
  it('rejects malformed cloud payloads', () => { expect(() => validateSnapshot({ records: [] })).toThrow('格式异常'); });
});
