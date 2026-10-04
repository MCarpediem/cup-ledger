import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LedgerDB, clearData, mergedCatalog, pinFavorite, readData, saveRecord, saveSettings, touchFavorite, unpinFavorite } from './db';
import { catalog } from './catalog';
import { allSources, defaultSettings, zeroNutrition, type DrinkRecord, type FavoriteDrink } from './model';
import { aggregate, inRange } from './domain';

let database: LedgerDB;
const record = (): DrinkRecord => ({ id: 'test', typeId: 'custom', templateId: 'custom', name: '我的茶', category: 'tea', plainWater: false, volume: 300, quantity: 1, consumedAt: new Date(2024, 1, 29, 12).toISOString(), dayKey: '2024-02-29', nutrition: { ...zeroNutrition(), caffeine: 20 }, sources: allSources('manual'), abv: null, alcoholManual: false, specification: '手作' });
beforeEach(() => { database = new LedgerDB(`test-${crypto.randomUUID()}`); });
afterEach(async () => { await database.delete(); });
describe('local data services', () => {
  const favorite = (id: string): FavoriteDrink => ({ id, templateId: 'coffee-americano', typeId: 'coffee-americano', name: '美式咖啡', category: 'coffee', plainWater: false, volume: 250, nutrition: { ...zeroNutrition(), caffeine: 40 }, sources: allSources('estimated'), abv: null, alcoholManual: false, specification: '标准浓度 · 250 ml', pinnedAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
  it('pins at most eight quick drinks, de-duplicates templates, and supports undoing a pin', async () => {
    await expect(pinFavorite(favorite('favorite-1'), database)).resolves.toMatchObject({ name: '美式咖啡' });
    await expect(pinFavorite(favorite('favorite-duplicate'), database)).resolves.toMatchObject({ id: 'favorite-1' });
    for (let index = 2; index <= 8; index += 1) await pinFavorite({ ...favorite(`favorite-${index}`), templateId: `template-${index}` }, database);
    await expect(pinFavorite({ ...favorite('favorite-9'), templateId: 'template-9' }, database)).rejects.toThrow('最多固定 8 个');
    await touchFavorite('favorite-1', database);
    expect((await readData(database)).favorites).toHaveLength(8);
    await unpinFavorite('favorite-1', database);
    expect((await readData(database)).favorites).toHaveLength(7);
  });
  it('keeps history snapshots when the template is changed or deleted', async () => {
    const template = { ...catalog[4], id: 'custom', custom: true };
    const draft = record();
    await saveRecord(draft, template, database);
    draft.nutrition.caffeine = 999;
    await database.templates.put({ ...template, name: '新名字', nutrition: { ...zeroNutrition(), caffeine: 100 } });
    expect((await database.records.get('test'))?.nutrition.caffeine).toBe(20);
    await database.templates.delete('custom');
    expect((await database.records.get('test'))?.name).toBe('我的茶');
  });
  it('moves a record to its new natural day, and deletion removes totals', async () => {
    const draft = record();
    await saveRecord(draft, undefined, database);
    await saveRecord({ ...draft, consumedAt: new Date(2024, 2, 1, 8).toISOString(), dayKey: '2024-03-01', quantity: 3 }, undefined, database);
    let records = (await readData(database)).records;
    expect(inRange(records, '2024-02-29', '2024-02-29')).toHaveLength(0);
    expect(aggregate(inRange(records, '2024-03-01', '2024-03-01')).caffeine.value).toBe(60);
    await database.records.delete(draft.id);
    records = (await readData(database)).records;
    expect(aggregate(records).caffeine.value).toBe(0);
  });
  it('persists records when the database connection reopens', async () => {
    await saveRecord(record(), undefined, database);
    database.close(); await database.open();
    expect((await readData(database)).records).toHaveLength(1);
  });
  it('clears records, custom templates, builtin overrides, and onboarding together', async () => {
    await saveRecord(record(), { ...catalog[0], volume: 800 }, database);
    await database.templates.put({ ...catalog[0], id: 'custom', custom: true });
    await saveSettings({ ...defaultSettings, water: 2000, onboarded: true }, database);
    await clearData(database);
    expect(await database.records.count()).toBe(0);
    expect(await database.templates.count()).toBe(0);
    expect((await readData(database)).settings).toEqual(defaultSettings);
  });
  it('rolls back the record if saving its template fails', async () => {
    const invalid = { ...catalog[0], id: undefined };
    await expect(saveRecord(record(), invalid as unknown as typeof catalog[0], database)).rejects.toThrow();
    expect(await database.records.count()).toBe(0);
  });
  it('does not mutate the bundled catalog when applying overrides', () => {
    const original = catalog[0].volume;
    const result = mergedCatalog([{ ...catalog[0], volume: 999 }]);
    expect(result[0].volume).toBe(999);
    expect(catalog[0].volume).toBe(original);
  });
  it('rejects nonpositive and nonfinite settings', async () => {
    await expect(saveSettings({ ...defaultSettings, water: 0 }, database)).rejects.toThrow();
    await expect(saveSettings({ ...defaultSettings, sugar: Infinity }, database)).rejects.toThrow();
  });
});
