import { describe, expect, it } from 'vitest';
import { aggregate, alcoholGrams, cloneValue, convertNutrition, dayKey, dominantDrink, inRange, newId, periodRange, preferences, referenceState, servingNutrition, specificationNutrition, uniqueDrinks, validateRecord } from './domain';
import { allSources, zeroNutrition, type DrinkRecord } from './model';
import { catalog } from './catalog';

export function fixture(overrides: Partial<DrinkRecord> = {}): DrinkRecord {
  return { id: 'record-1', templateId: 'water-plain', typeId: 'water-plain', name: '普通饮用水', category: 'water', plainWater: true, volume: 250, quantity: 2, consumedAt: new Date(2024, 1, 29, 12).toISOString(), dayKey: '2024-02-29', nutrition: zeroNutrition(), sources: allSources('estimated'), abv: null, alcoholManual: false, specification: '', ...overrides };
}
describe('nutrition and reference values', () => {
  it('creates IDs and clones values without relying on secure-origin-only APIs', () => {
    const id = newId();
    expect(id).toMatch(/^[\da-f]+-[\da-f-]+$/);
    const original = { nested: { value: 1 } };
    const copy = cloneValue(original);
    copy.nested.value = 2;
    expect(original.nested.value).toBe(1);
  });
  it('converts per 100 ml to serving, preserving missing values and true zero', () => {
    const nutrition = { ...zeroNutrition(), caffeine: 40, sugar: null, protein: 2 };
    expect(convertNutrition(nutrition, 250, '100ml', 'serving')).toEqual({ caffeine: 100, sugar: null, protein: 5, calories: 0, alcohol: 0 });
    expect(convertNutrition(convertNutrition(nutrition, 250, '100ml', 'serving'), 250, 'serving', '100ml')).toEqual(nutrition);
  });
  it('multiplies every known component and water by quantity', () => {
    const totals = aggregate([fixture({ nutrition: { caffeine: 12, sugar: 3, protein: 5, calories: 10, alcohol: 2 } })]);
    expect(Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.value]))).toEqual({ water: 500, caffeine: 24, sugar: 6, protein: 10, calories: 20, alcohol: 4 });
  });
  it('only counts water-qualified snapshots, excluding sparkling water and coffee', () => {
    const records = catalog.filter(t => ['water-plain', 'water-mineral', 'water-purified', 'water-sparkling', 'coffee-americano'].includes(t.id)).map(t => fixture({ id: t.id, plainWater: t.plainWater, category: t.category, volume: 100, quantity: 1 }));
    expect(aggregate(records).water.value).toBe(100);
  });
  it('flags partially unknown totals without discarding known quantities', () => {
    const totals = aggregate([fixture({ nutrition: { ...zeroNutrition(), sugar: null } }), fixture({ nutrition: { ...zeroNutrition(), sugar: 10 }, quantity: 3 })]);
    expect(totals.sugar).toEqual({ value: 30, incomplete: true });
    expect(totals.caffeine).toEqual({ value: 0, incomplete: false });
    expect(aggregate([]).sugar).toEqual({ value: 0, incomplete: false });
  });
  it('computes alcohol from ABV and preserves explicit manual values, including zero and null', () => {
    expect(alcoholGrams(330, 5, null, false)).toBeCloseTo(13.0185);
    expect(alcoholGrams(500, 10, 4, true)).toBe(4);
    expect(alcoholGrams(500, 10, 0, true)).toBe(0);
    expect(alcoholGrams(500, 10, null, true)).toBeNull();
    expect(alcoholGrams(500, null, null, false)).toBeNull();
    expect(servingNutrition(zeroNutrition(), '100ml', 330, 'alcohol', 5, false).alcohol).toBeCloseTo(13.0185);
  });
  it('uses 80% for approaching a reference and distinguishes exceeding it', () => {
    expect(referenceState(319, 400)).toBe('normal');
    expect(referenceState(320, 400)).toBe('near');
    expect(referenceState(400, 400)).toBe('near');
    expect(referenceState(401, 400)).toBe('over');
  });
  it('keeps bundled variant units independent of an overridden default basis', () => {
    const coffee = catalog.find(t => t.id === 'coffee-americano')!;
    const updated = { ...coffee, basis: 'serving' as const, nutrition: { ...zeroNutrition(), caffeine: 100 } };
    expect(specificationNutrition(updated, 'strong', 1, 250, 'serving').caffeine).toBe(150);
    expect(specificationNutrition(updated, 'strong', 1, 250, '100ml').caffeine).toBe(60);
  });
  it('sweetness removes estimated added sugar and calories while retaining natural sugar', () => {
    const tea = catalog.find(t => t.id === 'milktea-classic')!;
    const half = specificationNutrition(tea, 'classic', 0.5, 500, 'serving');
    expect(half.sugar).toBe(30); expect(half.calories).toBe(245);
    expect(specificationNutrition(tea, 'classic', 0, 500, 'serving').sugar).toBe(10);
  });
});
describe('natural-day periods', () => {
  it('starts weeks on Monday across a year boundary', () => {
    const range = periodRange('week', new Date(2025, 0, 1), new Date(2025, 0, 1));
    expect(range.startKey).toBe('2024-12-30'); expect(range.endKey).toBe('2025-01-05'); expect(range.days).toBe(3);
  });
  it('includes unrecorded days and uses complete past weeks and months', () => {
    expect(periodRange('week', new Date(2024, 1, 2), new Date(2025, 0, 1)).days).toBe(7);
    expect(periodRange('month', new Date(2024, 1, 2), new Date(2025, 0, 1)).days).toBe(29);
    expect(periodRange('month', new Date(2025, 1, 2), new Date(2025, 2, 1)).days).toBe(28);
  });
  it('uses leap-year and elapsed current-year denominators', () => {
    expect(periodRange('year', new Date(2024, 1, 2), new Date(2025, 1, 2)).days).toBe(366);
    expect(periodRange('year', new Date(2023, 1, 2), new Date(2025, 1, 2)).days).toBe(365);
    expect(periodRange('year', new Date(2024, 1, 29), new Date(2024, 1, 29)).days).toBe(60);
    expect(periodRange('month', new Date(2024, 1, 29), new Date(2024, 1, 12)).days).toBe(12);
  });
  it('uses the stored day key rather than reassigning records by UTC date', () => {
    const r = fixture({ consumedAt: '2024-02-28T17:00:00.000Z', dayKey: '2024-02-29' });
    expect(inRange([r], '2024-02-29', '2024-02-29')).toEqual([r]);
    expect(inRange([r], '2024-02-28', '2024-02-28')).toEqual([]);
    expect(dayKey(new Date(2024, 1, 29, 23, 59))).toBe('2024-02-29');
  });
});
describe('calendar and preferences', () => {
  it('deduplicates drink types regardless of number of records or portions', () => {
    expect(uniqueDrinks([fixture(), fixture({ id: 'another', quantity: 3 })])).toHaveLength(1);
  });
  it('ranks frequency by portions and volume by total ml', () => {
    const result = preferences([fixture({ typeId: 'a', name: '浓缩', volume: 30, quantity: 5 }), fixture({ typeId: 'b', name: '水', volume: 500, quantity: 1 })]);
    expect(result.frequent?.name).toBe('浓缩'); expect(result.mostVolume?.name).toBe('水');
  });
  it('resolves ties by stable type ID', () => {
    expect(preferences([fixture({ typeId: 'b' }), fixture({ typeId: 'a' })]).frequent?.id).toBe('a');
    expect(preferences([]).frequent).toBeUndefined();
  });
  it('selects the highest-volume non-water drink for calendar marks', () => {
    expect(dominantDrink([fixture({ typeId: 'water', category: 'water', volume: 1000 }), fixture({ typeId: 'tea', category: 'tea', volume: 300, quantity: 2 }), fixture({ typeId: 'coffee', category: 'coffee', volume: 500, quantity: 1 })])?.typeId).toBe('tea');
    expect(dominantDrink([fixture({ typeId: 'water', category: 'water', volume: 500 })])?.typeId).toBe('water');
  });
});
describe('input validation', () => {
  it.each([0, -1, 1.5, 101, NaN])('rejects invalid quantity %s', quantity => expect(() => validateRecord(fixture({ quantity }))).toThrow());
  it('rejects invalid volumes, dates, ABV and negative nutrition', () => {
    expect(() => validateRecord(fixture({ volume: 0 }))).toThrow();
    expect(() => validateRecord(fixture({ dayKey: '2024-02-28' }))).toThrow();
    expect(() => validateRecord(fixture({ abv: 101 }))).toThrow();
    expect(() => validateRecord(fixture({ nutrition: { ...zeroNutrition(), sugar: -1 } }))).toThrow();
  });
  it('accepts missing nutrition and explicit zeros', () => expect(() => validateRecord(fixture({ nutrition: { ...zeroNutrition(), caffeine: null } }))).not.toThrow());
});
