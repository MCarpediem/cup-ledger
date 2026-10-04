import { allSources, zeroNutrition, type Beverage, type Category, type Nutrition } from './model';

export const categories: Record<Category, { name: string; icon: string; color: string; background: string }> = {
  other: { name: '其他种类', icon: '🥤', color: '#978E80', background: '#EDE8E0' },
  water: { name: '水', icon: '💧', color: '#789EAA', background: '#E5EFF0' },
  coffee: { name: '咖啡', icon: '☕', color: '#99725D', background: '#EFE3D9' },
  tea: { name: '茶', icon: '🍵', color: '#879A72', background: '#E7EDE1' },
  milk: { name: '牛奶', icon: '🥛', color: '#C5AA82', background: '#F3EBDD' },
  juice: { name: '果汁', icon: '🍊', color: '#C48866', background: '#F4E3D8' },
  soda: { name: '碳酸饮料', icon: '🫧', color: '#899EAC', background: '#E7EEF0' },
  energy: { name: '能量饮料', icon: '⚡', color: '#B08B64', background: '#F0E5D6' },
  sports: { name: '运动饮料', icon: '🏃', color: '#839B91', background: '#E3ECE8' },
  milkTea: { name: '奶茶', icon: '🧋', color: '#AA8875', background: '#F0E5DE' },
  alcohol: { name: '酒精饮品', icon: '🍷', color: '#92747D', background: '#EEE4E8' },
};
const n = (caffeine: number | null, sugar: number | null, protein: number | null, calories: number | null): Nutrition => ({ caffeine, sugar, protein, calories, alcohol: 0 });
function drink(id: string, name: string, category: Category, volume: number, nutrition: Nutrition, extra: Partial<Beverage> = {}): Beverage {
  return { id, name, category, volume, nutrition, plainWater: false, basis: '100ml', sources: allSources('estimated'), abv: null, alcoholManual: false, kind: 'generic', note: '通用配方估算，非品牌商品数据；请按包装标签或实际配方调整。', ...extra };
}
export const catalog: Beverage[] = [
  drink('water-plain', '水', 'water', 250, zeroNutrition(), { plainWater: true, note: '普通水，成分按 0 记录。' }),
  drink('water-sparkling', '无糖气泡水', 'other', 330, zeroNutrition(), { note: '不计入水目标；无糖款通用估算。' }),
  drink('coffee-americano', '美式咖啡', 'coffee', 250, n(40, 0, 0.2, 2), { variants: [
    { id: 'regular', name: '标准浓度', nutrition: n(40, 0, 0.2, 2) },
    { id: 'strong', name: '加浓', nutrition: n(60, 0, 0.3, 3) },
    { id: 'decaf', name: '低因', nutrition: n(2, 0, 0.2, 2) },
  ] }),
  drink('coffee-latte', '拿铁咖啡', 'coffee', 300, n(27, 4.5, 2.8, 55), { variants: [
    { id: 'whole', name: '全脂奶', nutrition: n(27, 4.5, 2.8, 55) },
    { id: 'skim', name: '脱脂奶', nutrition: n(27, 4.8, 2.9, 36) },
    { id: 'oat', name: '燕麦奶', nutrition: n(27, 4, 1, 48) },
  ] }),
  drink('coffee-mocha', '摩卡', 'coffee', 300, n(30, 9, 2.5, 80)),
  drink('coffee-flat-white', '澳白', 'coffee', 200, n(50, 4, 2.8, 55)),
  drink('coffee-espresso', '意式浓缩', 'coffee', 30, n(210, 0, 0.1, 9)),
  drink('coffee-cappuccino', '卡布奇诺', 'coffee', 200, n(40, 4, 2.5, 48)),
  drink('tea-green', '绿茶', 'tea', 300, n(12, 0, 0, 0)),
  drink('tea-black', '红茶', 'tea', 300, n(20, 0, 0, 0)),
  drink('tea-oolong', '乌龙茶', 'tea', 300, n(16, 0, 0, 0)),
  drink('tea-herbal', '花草茶', 'tea', 300, n(0, 0, 0, 0)),
  drink('milk-whole', '全脂牛奶', 'milk', 250, n(0, 4.8, 3.2, 61)),
  drink('milk-low-fat', '低脂牛奶', 'milk', 250, n(0, 4.8, 3.3, 46)),
  drink('milk-skim', '脱脂牛奶', 'milk', 250, n(0, 5, 3.4, 35)),
  drink('milk-soy', '无糖豆奶', 'other', 250, n(0, 0.7, 3, 33)),
  drink('juice-orange', '橙汁', 'juice', 250, n(0, 8.5, 0.7, 45)),
  drink('juice-apple', '苹果汁', 'juice', 250, n(0, 10, 0.1, 46)),
  drink('soda-cola', '可乐', 'soda', 330, n(10, 10.6, 0, 42)),
  drink('soda-zero', '无糖可乐', 'soda', 330, n(10, 0, 0, 0)),
  drink('soda-sprite', '雪碧', 'soda', 330, n(0, 10, 0, 40)),
  drink('soda-fanta-orange', '芬达橙味', 'soda', 330, n(0, null, 0, null), { note: '不同地区和版本的配方不同，请按瓶身标签填写总糖与热量。' }),
  drink('energy-regular', '含糖能量饮料', 'energy', 250, n(32, 11, 0, 45)),
  drink('energy-zero', '无糖能量饮料', 'energy', 250, n(32, 0, 0, 3)),
  drink('sports-electrolyte', '电解质饮料', 'sports', 500, n(0, 4, 0, 16)),
  drink('sports-zero', '无糖运动饮料', 'sports', 500, n(0, 0, 0, 0)),
  drink('milktea-classic', '经典奶茶', 'milkTea', 500, n(20, 10, 1, 65), { sweetenable: true, variants: [
    { id: 'classic', name: '经典奶茶', nutrition: n(20, 10, 1, 65) },
    { id: 'fresh', name: '鲜奶茶', nutrition: n(18, 10, 2, 70) },
  ] }),
  drink('milktea-pearl', '珍珠奶茶', 'milkTea', 500, n(18, 12, 1, 90), { sweetenable: true }),
  drink('alcohol-beer', '啤酒', 'alcohol', 330, n(0, 0.5, 0.5, 43), { abv: 5 }),
  drink('alcohol-wine', '葡萄酒', 'alcohol', 150, n(0, 0.6, 0.1, 85), { abv: 12 }),
  drink('alcohol-baijiu', '白酒', 'alcohol', 50, n(0, 0, 0, 295), { abv: 52 }),
  drink('alcohol-cocktail', '调制鸡尾酒', 'alcohol', 200, n(0, null, null, null), { abv: null, note: '配方差异较大，请填写酒精度和成分；缺失值不会作为 0。' }),
  drink('product-kangshifu-iced-tea', '冰红茶', 'tea', 500, n(0, 8.8, 0, 37), { kind: 'product', brand: '康师傅', packageLabel: '500 ml 瓶装', searchTerms: ['康师傅', '冰红茶', '红茶饮料'], note: '包装标签参考值；不同地区版本请以瓶身标签为准。' }),
  drink('product-wahaha-ad-milk', 'AD 钙奶', 'milk', 220, n(0, 8.6, 1.2, 54), { kind: 'product', brand: '娃哈哈', packageLabel: '220 ml 瓶装', searchTerms: ['娃哈哈', '哇哈哈', 'AD钙奶', '钙奶'], note: '包装标签参考值；不同地区版本请以瓶身标签为准。' }),
  drink('product-coca-cola', '可口可乐', 'soda', 330, n(10, 10.6, 0, 42), { kind: 'product', brand: '可口可乐', packageLabel: '330 ml 罐装', searchTerms: ['可口', '可乐', 'coca cola'], note: '包装标签参考值；不同地区版本请以罐身标签为准。' }),
  drink('product-pepsi-cola', '百事可乐', 'soda', 330, n(10, 10.9, 0, 43), { kind: 'product', brand: '百事', packageLabel: '330 ml 罐装', searchTerms: ['百事', '百事可乐', 'pepsi'], note: '包装标签参考值；不同地区版本请以罐身标签为准。' }),
  drink('product-kumquat-lemon', '金桔柠檬', 'juice', 700, n(0, 7, 0, 32), { kind: 'product', brand: '通用配方', packageLabel: '700 ml 杯装 · 标准糖', searchTerms: ['金桔', '柠檬', '金桔柠檬'], sweetenable: true, note: '门店通用配方估算；甜度变化后请核对实际配方。' }),
];
