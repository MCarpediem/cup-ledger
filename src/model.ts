export const categoryIds = ['water', 'tea', 'coffee', 'milkTea', 'juice', 'milk', 'soda', 'energy', 'sports', 'alcohol', 'other'] as const;
export type Category = typeof categoryIds[number];
export const nutrientKeys = ['caffeine', 'sugar', 'protein', 'calories', 'alcohol'] as const;
export type Nutrient = typeof nutrientKeys[number];
export type Metric = 'water' | Nutrient;
export type ValueSource = 'estimated' | 'manual';
export type Nutrition = Record<Nutrient, number | null>;
export type Sources = Record<Nutrient, ValueSource>;
export type Basis = 'serving' | '100ml';
export type Period = 'week' | 'month' | 'year';

export interface Variant {
  id: string;
  name: string;
  nutrition: Nutrition;
  basis?: Basis;
  abv?: number | null;
}
export interface Beverage {
  id: string;
  name: string;
  category: Category;
  plainWater: boolean;
  volume: number;
  basis: Basis;
  nutrition: Nutrition;
  sources: Sources;
  abv: number | null;
  alcoholManual: boolean;
  variants?: Variant[];
  sweetenable?: boolean;
  custom?: boolean;
  defaultSpecification?: string;
  note: string;
  kind?: 'product' | 'generic';
  brand?: string;
  searchTerms?: string[];
  packageLabel?: string;
}
export interface FavoriteDrink {
  id: string;
  templateId: string;
  typeId: string;
  name: string;
  category: Category;
  plainWater: boolean;
  volume: number;
  nutrition: Nutrition;
  sources: Sources;
  abv: number | null;
  alcoholManual: boolean;
  specification: string;
  pinnedAt: string;
  lastUsedAt: string;
}
export interface DrinkRecord {
  id: string;
  templateId?: string;
  typeId: string;
  name: string;
  category: Category;
  plainWater: boolean;
  volume: number;
  quantity: number;
  consumedAt: string;
  dayKey: string;
  nutrition: Nutrition;
  sources: Sources;
  abv: number | null;
  alcoholManual: boolean;
  specification: string;
}
export interface Settings {
  id: 'main';
  water: number;
  caffeine: number;
  sugar: number;
  onboarded: boolean;
}
export const defaultSettings: Settings = { id: 'main', water: 1600, caffeine: 400, sugar: 50, onboarded: false };
export const metricInfo: Record<Metric, { label: string; unit: string }> = {
  water: { label: '水', unit: 'ml' }, caffeine: { label: '咖啡因', unit: 'mg' },
  sugar: { label: '饮品总糖', unit: 'g' }, protein: { label: '蛋白质', unit: 'g' },
  calories: { label: '热量', unit: 'kcal' }, alcohol: { label: '纯酒精', unit: 'g' },
};
export const zeroNutrition = (): Nutrition => ({ caffeine: 0, sugar: 0, protein: 0, calories: 0, alcohol: 0 });
export const allSources = (source: ValueSource): Sources => ({ caffeine: source, sugar: source, protein: source, calories: source, alcohol: source });
