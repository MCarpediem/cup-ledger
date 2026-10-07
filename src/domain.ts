import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear, parseISO } from 'date-fns';
import { nutrientKeys, type Basis, type Beverage, type DrinkRecord, type Metric, type Nutrition, type Period } from './model';

export const dayKey = (date = new Date()) => format(date, 'yyyy-MM-dd');
export const localInputTime = (date = new Date()) => format(date, "yyyy-MM-dd'T'HH:mm");
export const pretty = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value);
export function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
export function convertNutrition(nutrition: Nutrition, volume: number, from: Basis, to: Basis): Nutrition {
  const factor = from === to ? 1 : from === '100ml' ? volume / 100 : 100 / volume;
  return Object.fromEntries(nutrientKeys.map(key => [key, nutrition[key] === null ? null : nutrition[key]! * factor])) as Nutrition;
}
export function alcoholGrams(volume: number, abv: number | null, manual: number | null, isManual: boolean): number | null {
  return isManual ? manual : abv === null ? null : volume * abv / 100 * 0.789;
}
export function servingNutrition(nutrition: Nutrition, basis: Basis, volume: number, category: string, abv: number | null, alcoholManual: boolean): Nutrition {
  const result = convertNutrition(nutrition, volume, basis, 'serving');
  result.alcohol = category === 'alcohol' ? alcoholGrams(volume, abv, result.alcohol, alcoholManual) : 0;
  return result;
}
export function specificationNutrition(template: Beverage, variantId: string, sweetness: number, volume: number, basis: Basis): Nutrition {
  const variant = template.variants?.find(item => item.id === variantId);
  // Bundled recipes are per 100 ml, independent of a user's default input basis.
  const result = convertNutrition(variant?.nutrition ?? template.nutrition, volume, variant ? variant.basis ?? '100ml' : template.basis, basis);
  if (template.sweetenable && result.sugar !== null) {
    const naturalSugar = basis === '100ml' ? 2 : 2 * volume / 100;
    const removedSugar = Math.max(0, result.sugar - naturalSugar) * (1 - sweetness);
    result.sugar -= removedSugar;
    if (result.calories !== null) result.calories = Math.max(0, result.calories - removedSugar * 4);
  }
  return result;
}
export const metrics: Metric[] = ['water', ...nutrientKeys];
export interface Sum { value: number; incomplete: boolean }
export type Totals = Record<Metric, Sum>;
export function aggregate(records: DrinkRecord[]): Totals {
  const result = Object.fromEntries(metrics.map(key => [key, { value: 0, incomplete: false }])) as Totals;
  for (const record of records) {
    if (record.plainWater) result.water.value += record.volume * record.quantity;
    for (const key of nutrientKeys) {
      if (record.nutrition[key] === null) result[key].incomplete = true;
      else result[key].value += record.nutrition[key]! * record.quantity;
    }
  }
  return result;
}
export function referenceState(value: number, reference: number): 'normal' | 'near' | 'over' {
  return value > reference ? 'over' : value >= reference * 0.8 ? 'near' : 'normal';
}
export function periodRange(period: Period, anchor: Date, today = new Date()) {
  const start = period === 'week' ? startOfWeek(anchor, { weekStartsOn: 1 }) : period === 'month' ? startOfMonth(anchor) : startOfYear(anchor);
  const end = period === 'week' ? endOfWeek(anchor, { weekStartsOn: 1 }) : period === 'month' ? endOfMonth(anchor) : endOfYear(anchor);
  const effectiveEnd = dayKey(end) > dayKey(today) ? today : end;
  return { start, end, startKey: dayKey(start), endKey: dayKey(end), days: Math.max(1, differenceInCalendarDays(effectiveEnd, start) + 1) };
}
export function inRange(records: DrinkRecord[], startKey: string, endKey: string) {
  return records.filter(r => r.dayKey >= startKey && r.dayKey <= endKey);
}
export function dateList(start: Date, end: Date) {
  const result: Date[] = [];
  for (let date = start; dayKey(date) <= dayKey(end); date = addDays(date, 1)) result.push(date);
  return result;
}
export function uniqueDrinks(records: DrinkRecord[]) {
  return [...new Map([...records].sort((a, b) => a.typeId.localeCompare(b.typeId)).map(record => [record.typeId, record])).values()];
}
export function dominantDrink(records: DrinkRecord[]) {
  const candidates = records.filter(record => record.category !== 'water');
  const pool = candidates.length ? candidates : records.filter(record => record.category === 'water');
  const totals = new Map<string, { record: DrinkRecord; volume: number }>();
  for (const record of pool) {
    const current = totals.get(record.typeId);
    if (current) current.volume += record.volume * record.quantity;
    else totals.set(record.typeId, { record, volume: record.volume * record.quantity });
  }
  return [...totals.values()].sort((a, b) => b.volume - a.volume || a.record.typeId.localeCompare(b.record.typeId))[0]?.record;
}
export function preferences(records: DrinkRecord[]) {
  const grouped = new Map<string, { id: string; name: string; quantity: number; volume: number }>();
  for (const r of records) {
    const entry = grouped.get(r.typeId) ?? { id: r.typeId, name: r.name, quantity: 0, volume: 0 };
    entry.quantity += r.quantity;
    entry.volume += r.volume * r.quantity;
    grouped.set(r.typeId, entry);
  }
  const entries = [...grouped.values()];
  const rank = (key: 'quantity' | 'volume') => [...entries].sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id))[0];
  return { frequent: rank('quantity'), mostVolume: rank('volume') };
}
export function validateRecord(record: DrinkRecord) {
  if (!record.name.trim()) throw new Error('请填写饮品名称');
  if (!Number.isFinite(record.volume) || record.volume <= 0 || record.volume > 10000) throw new Error('单份容量需在 0 到 10,000 ml 之间');
  if (!Number.isInteger(record.quantity) || record.quantity < 1 || record.quantity > 100) throw new Error('份数需为 1 到 100 的整数');
  const date = parseISO(record.consumedAt);
  if (Number.isNaN(date.getTime()) || dayKey(date) !== record.dayKey) throw new Error('请填写有效的饮用时间');
  if (date.getTime() > Date.now() + 60000) throw new Error('饮用时间不能晚于现在');
  for (const key of nutrientKeys) {
    const value = record.nutrition[key];
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('成分需为非负数，未知时请留空');
  }
  if (record.abv !== null && (!Number.isFinite(record.abv) || record.abv < 0 || record.abv > 100)) throw new Error('酒精度需在 0 到 100% 之间');
}
