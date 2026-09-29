import Dexie, { type Table } from 'dexie';
import { catalog } from './catalog';
import { defaultSettings, type Beverage, type DrinkRecord, type Settings } from './model';
import { validateRecord } from './domain';

export class LedgerDB extends Dexie {
  records!: Table<DrinkRecord, string>;
  templates!: Table<Beverage, string>;
  settings!: Table<Settings, string>;
  constructor(name = 'cup-ledger') {
    super(name);
    this.version(1).stores({ records: 'id, dayKey, consumedAt, category', templates: 'id, category', settings: 'id' });
  }
}
export const db = new LedgerDB();
export function mergedCatalog(overrides: Beverage[]) {
  const map = new Map(catalog.map(item => [item.id, item]));
  overrides.forEach(item => map.set(item.id, item));
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
  await database.transaction('rw', database.records, database.templates, database.settings, async () => {
    await database.records.clear();
    await database.templates.clear();
    await database.settings.clear();
  });
}
export async function readData(database = db) {
  const [records, overrides, settings] = await Promise.all([database.records.orderBy('consumedAt').reverse().toArray(), database.templates.toArray(), database.settings.get('main')]);
  return { records, templates: mergedCatalog(overrides), settings: settings ?? defaultSettings };
}
