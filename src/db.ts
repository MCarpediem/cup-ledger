import Dexie, { type Table } from 'dexie';
import { catalog } from './catalog';
import { defaultSettings, type Beverage, type DrinkRecord, type FavoriteDrink, type Settings } from './model';
import { validateRecord } from './domain';

export class LedgerDB extends Dexie {
  records!: Table<DrinkRecord, string>;
  templates!: Table<Beverage, string>;
  settings!: Table<Settings, string>;
  favorites!: Table<FavoriteDrink, string>;
  constructor(name = 'cup-ledger') {
    super(name);
    this.version(1).stores({ records: 'id, dayKey, consumedAt, category', templates: 'id, category', settings: 'id' });
    this.version(2).stores({ records: 'id, dayKey, consumedAt, category', templates: 'id, category', settings: 'id', favorites: 'id, templateId, lastUsedAt' });
  }
}
export const db = new LedgerDB();
export function mergedCatalog(overrides: Beverage[]) {
  const map = new Map(catalog.map(item => [item.id, item]));
  overrides.forEach(item => {
    const builtin = map.get(item.id);
    if (item.custom) map.set(item.id, item);
    else if (builtin) map.set(item.id, { ...item, name: builtin.name, category: builtin.category, plainWater: builtin.plainWater });
    // Retired builtin overrides remain stored, but do not reappear in the picker.
  });
  return [...map.values()];
}
export async function saveRecord(record: DrinkRecord, template?: Beverage, database = db) {
  validateRecord(record);
  await database.transaction('rw', database.records, database.templates, async () => {
    await database.records.put(structuredClone(record));
    if (template) await database.templates.put(structuredClone(template));
  });
}
export async function saveSettings(settings: Settings, database = db) {
  if (['water', 'caffeine', 'sugar'].some(key => !Number.isFinite(settings[key as 'water']) || settings[key as 'water'] <= 0)) throw new Error('目标与参考值需要大于 0');
  await database.settings.put(settings);
}
export async function clearData(database = db) {
  await database.transaction('rw', database.records, database.templates, database.settings, database.favorites, async () => {
    await database.records.clear();
    await database.templates.clear();
    await database.settings.clear();
    await database.favorites.clear();
  });
}
export async function readData(database = db) {
  const [records, overrides, settings, favorites] = await Promise.all([database.records.orderBy('consumedAt').reverse().toArray(), database.templates.toArray(), database.settings.get('main'), database.favorites.toArray()]);
  favorites.sort((a, b) => {
    if (Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder)) return a.sortOrder! - b.sortOrder!;
    if (Number.isFinite(a.sortOrder)) return -1;
    if (Number.isFinite(b.sortOrder)) return 1;
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  });
  return { records, templates: mergedCatalog(overrides), settings: settings ?? defaultSettings, favorites };
}
export async function pinFavorite(favorite: FavoriteDrink, database = db) {
  const existing = await database.favorites.toCollection().filter(item => item.fingerprint === favorite.fingerprint).first();
  if (existing) return existing;
  if (await database.favorites.count() >= 8) throw new Error('最多固定 8 个常喝饮品，请先取消一个再添加。');
  const current = await database.favorites.toArray();
  const sortOrder = current.reduce((max, item) => Math.max(max, item.sortOrder ?? -1), -1) + 1;
  const stored = { ...favorite, sortOrder };
  await database.favorites.add(structuredClone(stored));
  return stored;
}
export async function unpinFavorite(id: string, database = db) { await database.favorites.delete(id); }
export async function touchFavorite(id: string, database = db) { await database.favorites.update(id, { lastUsedAt: new Date().toISOString() }); }
export async function reorderFavorites(ids: string[], database = db) {
  await database.transaction('rw', database.favorites, async () => {
    await Promise.all(ids.map((id, sortOrder) => database.favorites.update(id, { sortOrder })));
  });
}
