import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, GlassWater, Minus, Plus, Wine } from 'lucide-react';
import { categories } from './catalog';
import { db, pinFavorite, saveRecord } from './db';
import { alcoholGrams, convertNutrition, dayKey, localInputTime, pretty, specificationNutrition, validateRecord } from './domain';
import { allSources, categoryIds, metricInfo, zeroNutrition, type Basis, type Beverage, type Category, type DrinkRecord, type FavoriteDrink, type Nutrition } from './model';
import { BackHeader, Badge, ErrorMessage, errorText } from './components';
import styles from './App.module.css';

const editableNutrients = ['caffeine', 'sugar', 'protein', 'calories'] as const;
const containers = [{ name: '小杯', ml: 150 }, { name: '玻璃杯', ml: 250 }, { name: '易拉罐', ml: 330 }, { name: '马克杯', ml: 350 }, { name: '中杯 / 瓶装', ml: 500 }, { name: '大杯', ml: 700 }];
export function DrinkForm({ template, record, templateMode = false, reselected = false }: { template?: Beverage; record?: DrinkRecord; templateMode?: boolean; reselected?: boolean }) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const flowQuery = new URLSearchParams();
  if (query.get('from') === 'records') flowQuery.set('from', 'records');
  if (record?.id || query.get('edit')) flowQuery.set('edit', record?.id ?? query.get('edit')!);
  const pickerPath = `/add${flowQuery.size ? `?${flowQuery}` : ''}`;
  const templateReturn = query.get('via') === 'add' ? pickerPath : '/templates';
  const snapshot = record && !reselected && !templateMode ? record : undefined;
  const [name, setName] = useState(snapshot?.name ?? template?.name ?? '');
  const [category, setCategory] = useState<Category>(snapshot?.category ?? template?.category ?? 'coffee');
  const [plainWater, setPlainWater] = useState(snapshot?.plainWater ?? template?.plainWater ?? false);
  const [volume, setVolume] = useState(snapshot?.volume ?? template?.volume ?? 250);
  const [quantity, setQuantity] = useState(record?.quantity ?? 1);
  const [time, setTime] = useState(record ? localInputTime(new Date(record.consumedAt)) : localInputTime());
  const [basis, setBasis] = useState<Basis>(snapshot ? 'serving' : template?.basis ?? '100ml');
  const [nutrition, setNutrition] = useState<Nutrition>(snapshot?.nutrition ?? template?.nutrition ?? { ...zeroNutrition(), caffeine: null, sugar: null, protein: null, calories: null });
  const [sources, setSources] = useState(snapshot?.sources ?? template?.sources ?? allSources('manual'));
  const [abv, setAbv] = useState<number | null>(snapshot ? snapshot.abv : template?.abv ?? null);
  const [alcoholManual, setAlcoholManual] = useState(snapshot?.alcoholManual ?? template?.alcoholManual ?? false);
  const [manualAlcohol, setManualAlcohol] = useState<number | null>(snapshot ? snapshot.nutrition.alcohol : (template ? convertNutrition(template.nutrition, template.volume, template.basis, 'serving').alcohol : null));
  const [variantId, setVariantId] = useState('');
  const [sweetness, setSweetness] = useState('1');
  const [dirty, setDirty] = useState(false);
  const [updateDefault, setUpdateDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pinned, setPinned] = useState(false);
  const [specification, setSpecification] = useState(snapshot?.specification ?? template?.defaultSpecification ?? '');
  const perServing = convertNutrition(nutrition, volume || 1, basis, 'serving');
  perServing.alcohol = category === 'alcohol' ? alcoholGrams(volume, abv, manualAlcohol, alcoholManual) : 0;
  const variantsAvailable = !snapshot && template?.variants?.length;
  const sweetAvailable = !snapshot && template?.sweetenable;

  function changeVolume(next: number) {
    if (basis === 'serving' && volume > 0 && next > 0) {
      setNutrition(Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, value !== null && sources[key as keyof Nutrition] === 'estimated' ? value * next / volume : value])) as Nutrition);
    }
    setVolume(next);
  }
  function changeBasis(next: Basis) { setNutrition(convertNutrition(nutrition, volume || 1, basis, next)); setBasis(next); }
  function applySpecification(variant: string, sweet: string) {
    if (!template) return;
    const selected = template.variants?.find(item => item.id === variant);
    const base = specificationNutrition(template, variant, Number(sweet), volume || 1, basis);
    setNutrition(base); setSources(allSources('estimated')); setDirty(true);
    setSpecification([selected?.name, template.sweetenable ? ({ '1': '标准甜', '0.5': '半糖', '0': '不额外加糖' }[sweet]) : undefined].filter(Boolean).join(' · '));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const effectivePlain = category === 'water' && plainWater;
      const savedSources = { ...sources, alcohol: alcoholManual ? 'manual' as const : 'estimated' as const };
      const templateId = template?.id ?? record?.templateId ?? crypto.randomUUID();
      const consumedAt = new Date(time).toISOString();
      const draft: DrinkRecord = {
        id: record?.id ?? crypto.randomUUID(), templateId, typeId: snapshot?.typeId ?? templateId,
        name: name.trim(), category, plainWater: effectivePlain, volume, quantity, consumedAt,
        dayKey: dayKey(new Date(time)), nutrition: perServing, sources: savedSources, abv: category === 'alcohol' ? abv : null,
        alcoholManual: category === 'alcohol' && alcoholManual, specification,
      };
      const nextTemplate: Beverage = {
        ...(template ?? {}), id: templateId, name: name.trim(), category, plainWater: effectivePlain,
        volume, basis, nutrition: convertNutrition(perServing, volume, 'serving', basis), sources: savedSources,
        abv: category === 'alcohol' ? abv : null, alcoholManual: category === 'alcohol' && alcoholManual,
        custom: template?.custom ?? !template, note: template?.note ?? '自定义饮品，请按包装标签或实际配方填写。',
        defaultSpecification: specification,
      };
      if (templateMode) {
        validateRecord(draft);
        await db.templates.put(nextTemplate);
        navigate(templateReturn);
      } else {
        await saveRecord(draft, dirty && updateDefault && template ? nextTemplate : undefined);
        navigate('/', { state: { saved: true } });
      }
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function pinCurrent() {
    setError('');
    try {
      const templateId = template?.id ?? record?.templateId ?? `custom-${name.trim().toLowerCase().replace(/\s+/g, '-')}`;
      const now = new Date().toISOString();
      const favorite: FavoriteDrink = { id: crypto.randomUUID(), templateId, typeId: snapshot?.typeId ?? templateId, name: name.trim(), category, plainWater: category === 'water' && plainWater, volume, nutrition: perServing, sources: { ...sources, alcohol: alcoholManual ? 'manual' : 'estimated' }, abv: category === 'alcohol' ? abv : null, alcoholManual: category === 'alcohol' && alcoholManual, specification, pinnedAt: now, lastUsedAt: now };
      await pinFavorite(favorite);
      setPinned(true);
    } catch (e) { setError(errorText(e)); }
  }
  async function remove() {
    if (!window.confirm(templateMode ? '删除这个自定义饮品？历史记录仍会保留。' : '删除这条饮品记录？此操作无法恢复。')) return;
    setBusy(true);
    try {
      if (templateMode && template?.custom) await db.templates.delete(template.id);
      else if (record) await db.records.delete(record.id);
      navigate(templateMode ? templateReturn : '/records');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <><BackHeader title={templateMode ? template ? '编辑饮品默认值' : '创建自定义饮品' : record ? '编辑饮品记录' : '记录这一杯'} to={templateMode ? templateReturn : record ? '/records' : pickerPath} />
    <form onSubmit={submit} className={styles.form}>
      {templateMode ? <section className={styles.formSection}><h2>饮品信息</h2><label>饮品名称<input aria-label="饮品名称" required maxLength={60} value={name} onChange={e => setName(e.target.value)} readOnly={!!template && !template.custom} /></label><label>类别<select value={category} disabled={!!template && !template.custom} onChange={e => { setCategory(e.target.value as Category); setPlainWater(false); }}>{categoryIds.map(id => <option key={id} value={id}>{categories[id].name}</option>)}</select></label>{category === 'water' && <label className={styles.checkbox}><input type="checkbox" checked={plainWater} disabled={!!template && !template.custom} onChange={e => setPlainWater(e.target.checked)} />普通饮用水、矿泉水或纯净水（计入水）</label>}</section> : <div className={styles.selectedDrink}><Badge category={category} /><div><h2>{name}</h2><p>{categories[category].name} · {plainWater ? '计入水目标' : '不计入水目标'}</p></div><Link to={pickerPath} aria-label="更换饮品"><ChevronRight size={21} /></Link></div>}
      {(variantsAvailable || sweetAvailable || specification) && <section className={styles.formSection}><h2>适用规格</h2>{variantsAvailable && <label>饮品类型<select value={variantId} onChange={e => { setVariantId(e.target.value); applySpecification(e.target.value, sweetness); }}><option value="">当前默认配方</option>{template!.variants!.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{sweetAvailable && <label>甜度<select value={sweetness} onChange={e => { setSweetness(e.target.value); applySpecification(variantId, e.target.value); }}><option value="1">标准甜</option><option value="0.5">半糖</option><option value="0">不额外加糖</option></select></label>}{snapshot && specification && <p className={styles.footnote}>原记录规格：{specification}。更换饮品可重新选择规格；下方可以直接调整成分。</p>}</section>}
      <section className={styles.formSection}><div className={styles.sectionTitle}><h2>{templateMode ? '默认容量' : '这一杯，有多少？'}</h2><span className={styles.muted}>单份容量</span></div><div className={styles.containers}>{containers.map(item => <button type="button" key={item.ml} aria-pressed={volume === item.ml} onClick={() => changeVolume(item.ml)}><GlassWater size={24} strokeWidth={1.3} /><strong>{item.name}</strong><span>{item.ml} ml</span></button>)}</div><label className={styles.inlineField}><span>准确容量 <small>ml</small></span><input aria-label="准确容量" type="number" required min="1" max="10000" step="any" value={volume || ''} onChange={e => changeVolume(Number(e.target.value))} /></label>
      {!templateMode && <><div className={styles.quantity}><label htmlFor="quantity">数量 <small>杯 / 瓶 / 份</small></label><div><button type="button" aria-label="减少份数" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus size={18} /></button><input id="quantity" aria-label="份数" type="number" min="1" max="100" required value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} /><button type="button" aria-label="增加份数" disabled={quantity >= 100} onClick={() => setQuantity(quantity + 1)}><Plus size={18} /></button></div></div><label>饮用时间<input aria-label="饮用时间" type="datetime-local" value={time} required max={localInputTime()} onChange={e => setTime(e.target.value)} /></label></>}
      </section>
      <section className={styles.formSection}><div className={styles.sectionTitle}><h2>营养成分</h2><span className={styles.muted}>默认展开 · 可修改</span></div><div className={styles.segmented} role="group" aria-label="营养填写基准"><button type="button" aria-pressed={basis === 'serving'} onClick={() => changeBasis('serving')}>按单份填写</button><button type="button" aria-pressed={basis === '100ml'} onClick={() => changeBasis('100ml')}>按每 100 ml 填写</button></div><p className={styles.footnote}>{template?.note ?? '请按包装标签填写，未知成分可以留空。'}{sweetAvailable && ' 甜度仅调整估算的添加糖，天然糖仍保留。'}</p>
        <div className={styles.nutrientFields}>{editableNutrients.map(key => <label key={key}><span>{metricInfo[key].label}<small>{metricInfo[key].unit}</small></span><input aria-label={metricInfo[key].label} type="number" min="0" step="any" value={nutrition[key] === null ? '' : Math.round(nutrition[key]! * 10000) / 10000} placeholder="未填写" onChange={e => { setNutrition({ ...nutrition, [key]: e.target.value === '' ? null : Number(e.target.value) }); setSources({ ...sources, [key]: 'manual' }); setDirty(true); }} /><small>{nutrition[key] === null ? '未填写' : sources[key] === 'estimated' ? '估算' : '手动'}</small></label>)}</div>
        {category === 'alcohol' && <div className={styles.alcoholFields}><Wine size={20} /><label>酒精度 ABV（%）<input aria-label="酒精度 ABV" type="number" min="0" max="100" step="any" placeholder="未填写" value={abv ?? ''} onChange={e => { setAbv(e.target.value === '' ? null : Number(e.target.value)); setDirty(true); }} /></label><label>单份纯酒精（g）<input aria-label="单份纯酒精" type="number" min="0" step="any" placeholder="未填写" value={perServing.alcohol === null ? '' : Math.round(perServing.alcohol * 10000) / 10000} onChange={e => { setManualAlcohol(e.target.value === '' ? null : Number(e.target.value)); setAlcoholManual(true); setDirty(true); }} /></label><p className={styles.footnote}>{alcoholManual ? '手动值已保留；改变容量或酒精度不会自动覆盖。' : '估算：容量 × 酒精度 ÷ 100 × 0.789。'}</p>{alcoholManual && <button type="button" className={styles.textButton} onClick={() => { setAlcoholManual(false); setDirty(true); }}>恢复按酒精度估算</button>}</div>}
      </section>
      <section className={styles.totalPanel} aria-label="本次合计"><div className={styles.sectionTitle}><h2>{templateMode ? '默认单份合计' : '本次合计'}</h2><span>{pretty(volume * (templateMode ? 1 : quantity))} ml · {templateMode ? 1 : quantity} 份</span></div><div className={styles.totalGrid}>{(['caffeine', 'sugar', 'protein', 'calories', ...(category === 'alcohol' ? ['alcohol'] : [])] as (keyof Nutrition)[]).map(key => <div key={key}><span>{metricInfo[key].label}</span><strong>{perServing[key] === null ? '未填写' : pretty(perServing[key]! * (templateMode ? 1 : quantity))}<small>{perServing[key] === null ? '' : metricInfo[key].unit}</small></strong><small>单份 {perServing[key] === null ? '未填写' : `${pretty(perServing[key]!)} ${metricInfo[key].unit}`}</small></div>)}</div>{plainWater && category === 'water' && <p className={styles.footnote}>计入水 {pretty(volume * (templateMode ? 1 : quantity))} ml</p>}</section>
      {dirty && !templateMode && template && <fieldset className={styles.saveScope}><legend>营养值有调整，如何保存？</legend><label><input type="radio" name="scope" checked={!updateDefault} onChange={() => setUpdateDefault(false)} />仅本次</label><label><input type="radio" name="scope" checked={updateDefault} onChange={() => setUpdateDefault(true)} />更新该饮品默认值</label><small>历史记录不会随默认值改变。</small></fieldset>}
      <ErrorMessage error={error} />{!templateMode && <button type="button" disabled={busy || pinned} className={styles.pinButton} onClick={() => void pinCurrent()}>{pinned ? '已固定为常喝饮品' : '固定为常喝饮品'}</button>}<button type="submit" disabled={busy} className={styles.primary}><Check size={19} />{busy ? '保存中…' : templateMode ? '保存饮品' : record ? '保存修改' : '保存这一杯'}</button>
      {(record && !templateMode || templateMode && template?.custom) && <button type="button" disabled={busy} className={styles.deleteButton} onClick={() => void remove()}>{templateMode ? '删除自定义饮品' : '删除这条记录'}</button>}
    </form>
  </>;
}
