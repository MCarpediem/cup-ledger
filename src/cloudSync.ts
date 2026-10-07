import { type LedgerDB } from './db';
import { defaultSettings, type Beverage, type DrinkRecord, type FavoriteDrink, type Settings } from './model';
import { validateRecord } from './domain';
import { supabase } from './supabase';

export interface Snapshot { records: DrinkRecord[]; templates: Beverage[]; settings: Settings; favorites: FavoriteDrink[] }
export interface RemoteSnapshot { payload: Snapshot; updated_at: string }
export interface SyncTransport {
  read(): Promise<RemoteSnapshot | null>;
  write(payload: Snapshot, expected: string | null): Promise<string | null>;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export const emptySnapshot = (): Snapshot => ({ records: [], templates: [], favorites: [], settings: { ...defaultSettings } });
export function mergeSnapshots(base: Snapshot, local: Snapshot, remote: Snapshot): Snapshot {
  function mergeRows<T extends { id: string }>(before: T[], ours: T[], theirs: T[]): T[] {
    const maps = [before, ours, theirs].map(rows => new Map(rows.map(row => [row.id, row])));
    const result: T[] = [];
    for (const id of new Set([...maps[0].keys(), ...maps[1].keys(), ...maps[2].keys()])) {
      const [b, l, r] = maps.map(map => map.get(id));
      if (!equal(l, b) && !equal(r, b) && !equal(l, r)) throw new Error('同一项数据在两台设备上被修改，已暂停同步并保留本机数据。');
      const value = equal(l, b) ? r : l;
      if (value) result.push(value);
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }
  const settings = mergeRows([base.settings], [local.settings], [remote.settings])[0];
  const favorites = mergeRows(base.favorites, local.favorites, remote.favorites);
  if (favorites.length > 8) throw new Error('常喝饮品合计超过 8 项，请先减少收藏后重试。');
  return { records: mergeRows(base.records, local.records, remote.records), templates: mergeRows(base.templates, local.templates, remote.templates), favorites, settings };
}
export function validateSnapshot(value: unknown): asserts value is Snapshot {
  const data = value as Snapshot;
  if (!data || !Array.isArray(data.records) || !Array.isArray(data.templates) || !Array.isArray(data.favorites) || !data.settings || data.settings.id !== 'main') throw new Error('云端数据格式异常，本机数据已保留。');
  for (const rows of [data.records, data.templates, data.favorites]) {
    if (rows.some(row => !row || typeof row.id !== 'string') || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('云端数据存在无效或重复编号。');
  }
  data.records.forEach(validateRecord);
  if (['water', 'caffeine', 'sugar'].some(key => !Number.isFinite(data.settings[key as 'water']) || data.settings[key as 'water'] <= 0)) throw new Error('云端目标设置无效。');
}
export async function readSnapshot(database: LedgerDB): Promise<Snapshot> {
  return database.transaction('r', database.records, database.templates, database.settings, database.favorites, async () => ({
    records: await database.records.orderBy('id').toArray(), templates: await database.templates.orderBy('id').toArray(),
    favorites: await database.favorites.orderBy('id').toArray(), settings: await database.settings.get('main') ?? { ...defaultSettings },
  }));
}
export async function syncOnce(database: LedgerDB, transport: SyncTransport): Promise<void> {
  const local = await readSnapshot(database);
  const baseline = (await database.sync.get('base'))?.payload as Snapshot | undefined;
  const remote = await transport.read();
  if (baseline && !remote) throw new Error('云端快照不存在，已暂停同步并保留本机数据。');
  if (remote) validateSnapshot(remote.payload);
  const merged = mergeSnapshots(baseline ?? emptySnapshot(), local, remote?.payload ?? emptySnapshot());
  const token = await transport.write(merged, remote?.updated_at ?? null);
  if (!token) throw new Error('另一台设备刚更新了数据，请重试同步。本机修改已保留。');
  await database.transaction('rw', database.records, database.templates, database.settings, database.favorites, database.sync, async () => {
    const current: Snapshot = { records: await database.records.orderBy('id').toArray(), templates: await database.templates.orderBy('id').toArray(), favorites: await database.favorites.orderBy('id').toArray(), settings: await database.settings.get('main') ?? { ...defaultSettings } };
    const applied = mergeSnapshots(local, current, merged);
    {
      await Promise.all([database.records.clear(), database.templates.clear(), database.settings.clear(), database.favorites.clear()]);
      await database.records.bulkPut(applied.records); await database.templates.bulkPut(applied.templates);
      await database.favorites.bulkPut(applied.favorites); await database.settings.put(applied.settings);
    }
    await database.sync.put({ id: 'base', payload: merged });
  });
}
export function cloudTransport(userId: string): SyncTransport {
  const client = supabase;
  if (!client) throw new Error('尚未配置云端连接。');
  return {
    async read() {
      const { data, error } = await client.from('ledger_snapshots').select('payload,updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      return data as RemoteSnapshot | null;
    },
    async write(payload, expected) {
      const { data, error } = await client.rpc('save_ledger_snapshot', { p_payload: payload, p_expected: expected });
      if (error) throw new Error(error.message);
      return data as string | null;
    },
  };
}
