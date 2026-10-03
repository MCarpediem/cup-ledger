import { describe, expect, it } from 'vitest';
import { catalog, categories } from './catalog';
import { categoryIds } from './model';
import { mergedCatalog } from './db';

describe('revised beverage catalog', () => {
  it('orders categories and exposes the requested choices', () => {
    expect(categoryIds.map(id => categories[id].name)).toEqual(['水', '茶', '咖啡', '奶茶', '果汁', '牛奶', '碳酸饮料', '能量饮料', '运动饮料', '酒精饮品', '其他种类']);
    expect(catalog.filter(t => t.category === 'water').map(t => t.name)).toEqual(['水']);
    expect(catalog.filter(t => t.category === 'coffee').map(t => t.name)).toEqual(expect.arrayContaining(['摩卡', '澳白']));
    expect(catalog.filter(t => t.category === 'milk').map(t => t.name)).toEqual(['全脂牛奶', '低脂牛奶', '脱脂牛奶']);
    expect(catalog.filter(t => t.category === 'soda').map(t => t.name)).toEqual(['可乐', '无糖可乐', '雪碧', '芬达橙味']);
    expect(catalog.find(t => t.id === 'water-sparkling')?.plainWater).toBe(false);
  });
  it('preserves user nutrition overrides but applies new catalog labels and retires obsolete options', () => {
    const water = catalog.find(t => t.id === 'water-plain')!;
    const soy = catalog.find(t => t.id === 'milk-soy')!;
    const overrides = [{ ...water, name: '普通饮用水', volume: 600 }, { ...water, id: 'water-mineral', name: '矿泉水' }, { ...soy, category: 'milk' as const }, { ...water, id: 'my-drink', custom: true, name: '我的配方' }];
    const merged = mergedCatalog(overrides);
    expect(merged.find(t => t.id === water.id)).toMatchObject({ name: '水', volume: 600 });
    expect(merged.some(t => t.id === 'water-mineral')).toBe(false);
    expect(merged.find(t => t.id === soy.id)?.category).toBe('other');
    expect(merged.find(t => t.id === 'my-drink')?.name).toBe('我的配方');
    expect(overrides[0].name).toBe('普通饮用水');
  });
});
