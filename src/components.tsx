import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Coffee, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { categories } from './catalog';
import { aggregate, dayKey, pretty, referenceState, type Totals } from './domain';
import { metricInfo, nutrientKeys, type Beverage, type Category, type DrinkRecord, type Settings } from './model';
import styles from './App.module.css';

export interface AppData { records: DrinkRecord[]; templates: Beverage[]; settings: Settings; favorites: import('./model').FavoriteDrink[] }
export const DataContext = createContext<AppData | null>(null);
export function useData() { return useContext(DataContext)!; }
export function useToday() {
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    const update = () => setToday(dayKey());
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return today;
}
export function Badge({ category, small = false }: { category: Category; small?: boolean }) {
  return <span className={`${styles.badge} ${small ? styles.badgeSmall : ''}`} style={{ '--category': `var(--${category})`, '--category-bg': `var(--${category}-bg)` } as CSSProperties} aria-hidden="true">{categories[category].icon}</span>;
}
export function Header({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return <header className={styles.header}><div>{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}<h1>{title}</h1></div>{action}</header>;
}
export function BackHeader({ title, to = '/' }: { title: string; to?: string }) {
  return <header className={styles.backHeader}><Link to={to} className={styles.iconButton} aria-label="返回"><ArrowLeft size={22} /></Link><h1>{title}</h1><span className={styles.wordmark}>杯记</span></header>;
}
export function AddButton({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation();
  return <Link to={pathname === '/records' ? '/add?from=records' : '/add'} className={styles.primary} data-compact={compact}><Plus size={20} />添加饮品</Link>;
}
export function Empty({ title = '这一页，等一杯饮品', description = '从一杯水开始，记下今天的小日常。', showAdd = true }: { title?: string; description?: string; showAdd?: boolean }) {
  return <div className={styles.empty}><div className={styles.emptyIcon}><Coffee size={32} strokeWidth={1.3} /></div><h3>{title}</h3><p>{description}</p>{showAdd && <AddButton compact />}</div>;
}
export function MetricSummary({ totals, settings }: { totals: Totals; settings: Settings }) {
  return <section aria-label="摄入指标" className={styles.metrics}>
    <div className={styles.referenceGrid}>{(['water', 'caffeine', 'sugar'] as const).map(key => {
      const sum = totals[key];
      const goal = settings[key];
      const state = key === 'water' ? 'normal' : referenceState(sum.value, goal);
      const remaining = goal - sum.value;
      return <div key={key} className={`${styles.metric} ${styles[state]} ${styles[`metric_${key}`]}`}>
        <div className={styles.metricLabel}><span>{metricInfo[key].label}</span><span>{key === 'water' ? '每日目标' : '个人参考线'}</span></div>
        <p className={styles.metricValue}>{pretty(sum.value)}<small>{metricInfo[key].unit}</small>{sum.incomplete && <span className={styles.incomplete}>不完整</span>}</p>
        <div className={styles.progress} role="progressbar" aria-label={metricInfo[key].label} aria-valuenow={Math.round(sum.value)} aria-valuemin={0} aria-valuemax={Math.max(goal, Math.ceil(sum.value))}><i style={{ width: `${Math.min(sum.value / goal * 100, 100)}%`, background: key === 'water' ? 'var(--water)' : undefined }} /></div>
        <p className={styles.metricHint}>{key === 'water' ? remaining > 0 ? `还差 ${pretty(remaining)} ml` : '今日目标已达成' : `${state === 'near' ? '接近参考线 · ' : ''}${remaining >= 0 ? '剩余' : '超出'} ${pretty(Math.abs(remaining))} ${metricInfo[key].unit}`}<span>/ {pretty(goal)}</span></p>
      </div>;
    })}</div>
    <div className={styles.intakeGrid}>{(['protein', 'calories', 'alcohol'] as const).map(key => <div key={key} className={styles[`metric_${key}`]}><span>{metricInfo[key].label}</span><p>{pretty(totals[key].value)} <small>{metricInfo[key].unit}</small></p>{totals[key].incomplete && <small>合计不完整</small>}</div>)}</div>
  </section>;
}
export function RecordList({ records }: { records: DrinkRecord[] }) {
  return <div className={styles.timeline}>{[...records].sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)).map(record => <Link key={record.id} to={`/record/${record.id}`} className={styles.record} aria-label={`编辑 ${record.name}`}>
    <div className={styles.recordTop}><Badge category={record.category} /><div className={styles.recordBody}><div className={styles.recordHeading}><h3>{record.name}</h3><time>{format(parseISO(record.consumedAt), 'HH:mm')}</time></div><div className={styles.recordMeta}><span className={styles.volumePill}>{pretty(record.volume)} ml × {record.quantity} 份</span>{record.specification && <span className={styles.specPill}>{record.specification}</span>}</div></div></div>
    <div className={styles.recordNutrients}>{nutrientKeys.map(key => <span key={key} className={`${styles.recordNutrient} ${record.nutrition[key] === null ? styles.recordNutrientMissing : ''}`}><b>{metricInfo[key].label}{' '}</b><em>{record.nutrition[key] === null ? '未填写' : `${pretty(record.nutrition[key]! * record.quantity)} ${metricInfo[key].unit}`}</em></span>)}</div>
    <div className={styles.recordFooter}><span className={styles.sourceHint}>{nutrientKeys.some(key => record.nutrition[key] !== null && record.sources[key] === 'estimated') ? '含估算值' : '手动填写'} · 本条合计</span><span className={styles.recordAction}>查看详情 <ArrowUpRight size={15} /></span></div>
  </Link>)}</div>;
}
export function SectionTitle({ title, to, children }: { title: string; to?: string; children?: ReactNode }) {
  return <div className={styles.sectionTitle}><h2>{title}</h2>{to ? <Link to={to}>查看全部 <ArrowUpRight size={16} /></Link> : children}</div>;
}
export function ErrorMessage({ error }: { error: string }) { return error ? <p role="alert" className={styles.error}>{error}</p> : null; }
export function errorText(error: unknown) { return error instanceof Error && error.name === 'Error' ? error.message : '未能保存到本机，请检查浏览器存储空间或隐私设置后重试。'; }
export function DayDetail({ records, settings }: { records: DrinkRecord[]; settings: Settings }) {
  return <><MetricSummary totals={aggregate(records)} settings={settings} />{records.length ? <RecordList records={records} /> : <Empty title="这天还没有记录" />}</>;
}
