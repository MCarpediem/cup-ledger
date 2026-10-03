import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowRight, ChevronRight, CupSoda, Leaf, Search, Settings2, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { db, clearData, saveSettings } from './db';
import { categories } from './catalog';
import { aggregate, pretty } from './domain';
import { categoryIds, type Category, type Settings } from './model';
import { AddButton, BackHeader, Badge, Empty, ErrorMessage, Header, MetricSummary, RecordList, SectionTitle, errorText, useData, useToday } from './components';
import styles from './App.module.css';

export function Today() {
  const { records, settings } = useData();
  const today = useToday();
  const daily = records.filter(r => r.dayKey === today);
  const totalVolume = daily.reduce((sum, r) => sum + r.volume * r.quantity, 0);
  return <><Header title="今天，喝了些什么？" eyebrow={format(parseISO(today), 'yyyy 年 M 月 d 日 · EEEE', { locale: zhCN })} action={<span className={styles.headerIcon}><Leaf size={25} strokeWidth={1.4} /></span>} />
    <section className={styles.hero}><div><span className={styles.eyebrow}>MY DAILY SIPS</span><h2>一杯一记，<br />把日常慢慢收藏。</h2><p>今天已记录 <strong>{daily.reduce((sum, r) => sum + r.quantity, 0)}</strong> 份饮品 <span>·</span> {pretty(totalVolume)} ml</p></div><div className={styles.cupIllustration} aria-hidden="true"><svg viewBox="0 0 160 170"><path d="M55 45c-18-20 21-21 5-41M81 43c-16-15 17-22 7-35" fill="none" stroke="#cdb7a1" strokeWidth="3" strokeLinecap="round"/><ellipse cx="78" cy="144" rx="65" ry="10" fill="#e4d5c2"/><path d="M109 68h12c40 0 34 48-7 48" fill="none" stroke="#b48b70" strokeWidth="12"/><path d="M27 61h91l-8 63c-4 25-64 25-70 0z" fill="#e6c9ac"/><path d="M29 64h87l-3 18H33z" fill="#f2ddc6"/><ellipse cx="72" cy="62" rx="45" ry="10" fill="#bf9878"/><ellipse cx="72" cy="63" rx="36" ry="6" fill="#785542"/><path d="M48 88l4 32" stroke="#f5e5d2" strokeWidth="7" strokeLinecap="round"/></svg></div></section>
    <div className={styles.primaryEntry}><AddButton /></div>
    <SectionTitle title="今日摄入"><span className={styles.muted}>每一杯，都算数</span></SectionTitle>
    <MetricSummary totals={aggregate(daily)} settings={settings} />
    <p className={styles.footnote}>仅统计已记录的饮品；总糖包含天然糖，参考线是个人提醒值。</p>
    <SectionTitle title="最近记录" to="/records" />{daily.length ? <RecordList records={daily.slice(0, 5)} /> : <Empty showAdd={false} />}
  </>;
}
export function History() {
  const { records } = useData();
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const filtered = records.filter(r => (!date || r.dayKey === date) && (!category || r.category === category));
  const days = [...new Set(filtered.map(r => r.dayKey))].sort().reverse();
  return <><Header title="每一杯的足迹" eyebrow="饮品日记 / RECORDS" action={<SlidersHorizontal size={23} />} />
    <section className={styles.historyOverview} aria-label="记录概览"><div><p>把喝过的每一杯，留在这里</p><div className={styles.historyNumbers}><span><strong>{records.length}</strong> 条记录</span><span><strong>{new Set(records.map(r => r.dayKey)).size}</strong> 个记录日</span></div></div><AddButton /></section>
    <div className={styles.filters}><label>饮用日期<input aria-label="饮用日期筛选" type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>饮品类别<select aria-label="饮品类别筛选" value={category} onChange={e => setCategory(e.target.value as Category | '')}><option value="">全部类别</option>{categoryIds.map(id => <option key={id} value={id}>{categories[id].name}</option>)}</select></label></div>
    {(date || category) && <button className={styles.textButton} onClick={() => { setDate(''); setCategory(''); }}>清除筛选</button>}
    <p className={styles.footnote}>共 {filtered.length} 条记录 · 点击任意记录可编辑或删除</p>
    {days.length ? days.map(day => <section key={day}><SectionTitle title={format(parseISO(day), 'M 月 d 日 · EEEE', { locale: zhCN })}><span className={styles.muted}>{filtered.filter(r => r.dayKey === day).length} 条</span></SectionTitle><RecordList records={filtered.filter(r => r.dayKey === day)} /></section>) : <Empty showAdd={false} title="还没有找到记录" description={records.length ? "换个日期或类别，找回那一杯。" : "记下第一杯后，这里会按日期整理你的饮品、容量与成分。"} />}
  </>;
}
export function DrinkPicker({ editId }: { editId?: string | null }) {
  const { templates } = useData();
  const [query] = useSearchParams();
  const flowQuery = new URLSearchParams();
  if (query.get('from') === 'records') flowQuery.set('from', 'records');
  if (editId) flowQuery.set('edit', editId);
  const suffix = flowQuery.size ? `?${flowQuery}` : '';
  const customPath = `/templates/new?${new URLSearchParams({ ...Object.fromEntries(flowQuery), via: 'add' })}`;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const filtered = templates.filter(item => (!category || item.category === category) && `${item.name}${categories[item.category].name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <><BackHeader title="选择一杯饮品" to={editId ? `/record/${editId}` : query.get('from') === 'records' ? '/records' : '/'} />
    <div className={styles.search}><Search size={20} /><input aria-label="搜索饮品" placeholder="搜索饮品，比如：拿铁、绿茶" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <div className={styles.chips} role="group" aria-label="选择饮品类别"><button aria-pressed={!category} onClick={() => setCategory('')}>全部</button>{categoryIds.map(id => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{categories[id].icon} {categories[id].name}</button>)}</div>
    <div className={styles.pickerNote}><span>选一杯，记录此刻</span><Link to={customPath}>自定义饮品 +</Link></div>
    {categoryIds.filter(id => filtered.some(item => item.category === id)).map(id => <section key={id}><SectionTitle title={categories[id].name} /><div className={styles.drinkGrid}>{filtered.filter(item => item.category === id).map(item => <Link className={styles.drinkOption} key={item.id} to={`/add/${item.id}${suffix}`}><Badge category={id} /><div><h3>{item.name}</h3><p>{item.volume} ml · {item.custom ? '自定义' : '预设估算'}</p></div><ChevronRight size={17} /></Link>)}</div></section>)}
    {!filtered.length && <div className={styles.empty}><h3>没有找到这杯饮品</h3><p>试试其他关键词，或创建自己的配方。</p><Link className={styles.primary} to={customPath}>创建自定义饮品</Link></div>}
  </>;
}
export function Goals({ initial, onboarding = false }: { initial: Settings; onboarding?: boolean }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await saveSettings({ ...values, onboarded: true }); void navigator.storage?.persist?.().catch(() => false); navigate('/'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <div className={onboarding ? styles.onboarding : ''}>{onboarding ? <><div className={styles.brand}><CupSoda size={27} /><span>杯记 <small>cup-ledger</small></span></div><span className={styles.onboardingIcon}>☕</span><p className={styles.eyebrow}>HELLO, A NEW LITTLE RITUAL</p><h1>从今天的第一杯开始</h1><p className={styles.intro}>给自己留一份温暖的饮品日记。<br />先设定三个数字，之后随时可以调整。</p></> : <BackHeader title="目标与参考线" to="/profile" />}
    <form onSubmit={submit} className={styles.form}>
      {([{ key: 'water', label: '白水目标', unit: 'ml / 日', note: '1,600 ml 是产品起始值，请按个人情况调整。' }, { key: 'caffeine', label: '咖啡因参考值', unit: 'mg / 日', note: '400 mg 适用于一般健康成年人，不是所有人的安全保证。' }, { key: 'sugar', label: '饮品总糖参考线', unit: 'g / 日', note: '50 g 仅为个人提醒线，不是总糖的官方安全上限。' }] as const).map(item => <label className={styles.goalField} key={item.key}><span>{item.label}<small>{item.unit}</small></span><input required type="number" min="0.1" max="100000" step="any" value={values[item.key]} onChange={e => setValues({ ...values, [item.key]: e.target.value === '' ? '' : Number(e.target.value) } as Settings)} /><small>{item.note}</small></label>)}
      <div className={styles.notice}><ShieldCheck size={20} /><p>数据只保存在当前浏览器。清理浏览器数据、更换设备或浏览器可能导致记录丢失。杯记仅记录饮品，不代表全天饮食，也不提供医疗诊断。</p></div>
      <ErrorMessage error={error} /><button className={styles.primary} disabled={busy} type="submit">{busy ? '保存中…' : onboarding ? '开始我的饮品日记' : '保存设置'}<ArrowRight size={19} /></button>
    </form>
  </div>;
}
export function Profile() {
  const { records, templates, settings } = useData();
  const [clearStep, setClearStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function clear() { setBusy(true); try { await clearData(); navigate('/'); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }
  return <><Header title="我的饮品日常" eyebrow="一点习惯 / ABOUT ME" /><section className={styles.profileIntro}><div className={styles.profileIcon}><CupSoda size={35} strokeWidth={1.4} /></div><h2>让每一杯，都有迹可循</h2><p>已收藏 {records.length} 条日常 · {templates.filter(t => t.custom).length} 款自定义饮品</p></section>
    <div className={styles.menu}><Link to="/templates"><CoffeeIcon /><div><strong>饮品管理</strong><small>预设饮品与我的配方</small></div><ChevronRight size={20} /></Link><Link to="/goals"><Settings2 size={24} /><div><strong>目标与参考线</strong><small>白水 {settings.water} ml · 咖啡因 {settings.caffeine} mg · 总糖 {settings.sugar} g</small></div><ChevronRight size={20} /></Link><button onClick={() => setClearStep(1)}><Trash2 size={23} /><div><strong>清空本地数据</strong><small>删除记录、饮品与设置</small></div><ChevronRight size={20} /></button></div>
    <div className={styles.notice}><ShieldCheck size={21} /><p>你的日记留在这台设备。清理站点数据、更换浏览器或设备，记录可能丢失；浏览器也可能回收存储。请勿将这里作为重要数据的唯一存档。</p></div><p className={styles.version}>杯记 cup-ledger · v1.0.0<br />一杯一记，慢慢了解自己</p>
    {clearStep > 0 && <div className={styles.modalBackdrop}><div role="dialog" aria-modal="true" aria-labelledby="clear-title" className={styles.modal}><h2 id="clear-title">{clearStep === 1 ? '清空全部本地数据？' : '最后确认：数据无法恢复'}</h2><p>将删除所有饮用记录、自定义饮品、预设覆盖和目标设置。此操作无法恢复。</p><ErrorMessage error={error} /><button autoFocus className={styles.secondary} onClick={() => setClearStep(0)} disabled={busy}>保留数据</button><button className={styles.dangerButton} disabled={busy} onClick={() => clearStep === 1 ? setClearStep(2) : void clear()}>{busy ? '清空中…' : clearStep === 1 ? '继续清空' : '确认永久清空'}</button></div></div>}
  </>;
}
function CoffeeIcon() { return <CupSoda size={24} />; }
export function Templates() {
  const { templates } = useData();
  const [search, setSearch] = useState('');
  return <><BackHeader title="饮品管理" to="/profile" /><div className={styles.search}><Search size={19} /><input placeholder="搜索预设或自定义饮品" aria-label="搜索管理饮品" value={search} onChange={e => setSearch(e.target.value)} /></div><Link to="/templates/new" className={styles.primary}>＋ 创建自定义饮品</Link><p className={styles.footnote}>修改默认值只影响之后的记录。历史记录保留原始快照。</p><div className={styles.drinkGrid}>{templates.filter(t => t.name.includes(search)).map(item => <Link className={styles.drinkOption} key={item.id} to={`/templates/${item.id}`}><Badge category={item.category} /><div><h3>{item.name}</h3><p>{item.custom ? '我的配方' : '内置饮品'} · {item.volume} ml</p></div><ChevronRight size={18} /></Link>)}</div></>;
}
