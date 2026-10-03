import { useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Layers3, X } from 'lucide-react';
import { categories } from './catalog';
import { Badge } from './components';
import { categoryIds, type Category, type DrinkRecord } from './model';
import styles from './App.module.css';

export function HistoryFilters({ date, onDateChange, category, onCategoryChange, records }: {
  date: string;
  onDateChange: (date: string) => void;
  category: Category | '';
  onCategoryChange: (category: Category | '') => void;
  records: DrinkRecord[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const dateRecords = records.filter(record => !date || record.dayKey === date);

  function close() { dialog.current?.close(); }
  function choose(value: Category | '') { onCategoryChange(value); close(); }

  return <div className={styles.filters}>
    <label className={styles.filterField}>饮用日期
      <span className={styles.dateControl}>
        <CalendarDays size={19} aria-hidden="true" />
        <span aria-hidden="true" data-testid="date-display" className={!date ? styles.datePlaceholder : undefined}>{date ? date.replaceAll('-', '/') : '年 / 月 / 日'}</span>
        <input aria-label="饮用日期筛选" type="date" value={date} onChange={event => onDateChange(event.target.value)} onClick={event => {
          // Keep the native mobile picker, but draw the placeholder/value ourselves:
          // Android WebViews do not consistently render an empty date input's segments.
          try { event.currentTarget.showPicker?.(); } catch { /* Native input interaction remains available. */ }
        }} />
      </span>
    </label>
    <div className={styles.filterField}><span id="category-filter-label">饮品类别</span>
      <button ref={trigger} type="button" className={styles.categoryTrigger} aria-label={`饮品类别筛选：${category ? categories[category].name : '全部类别'}`} aria-haspopup="dialog" aria-expanded={open} aria-controls="history-category-dialog" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
        {category ? <Badge category={category} small /> : <Layers3 size={19} aria-hidden="true" />}
        <span>{category ? categories[category].name : '全部类别'}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
    </div>
    <dialog ref={dialog} id="history-category-dialog" className={styles.categoryDialog} aria-labelledby="category-dialog-title" onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <div className={styles.sheetHandle} aria-hidden="true" />
      <header className={styles.categoryDialogHeader}><div><h2 id="category-dialog-title">想回看哪一类？</h2><p>按饮品类别，找到那一杯</p></div><button type="button" className={styles.iconButton} aria-label="关闭类别选择" onClick={close}><X size={21} /></button></header>
      <div className={styles.categoryOptions} role="group" aria-label="饮品类别选项">
        {(['', ...categoryIds] as const).map(id => {
          const count = id ? dateRecords.filter(record => record.category === id).length : dateRecords.length;
          return <button key={id || 'all'} type="button" className={styles.categoryOption} aria-label={id ? categories[id].name : '全部类别'} aria-pressed={category === id} onClick={() => choose(id)}>
            {id ? <Badge category={id} /> : <span className={styles.allCategoryIcon}><Layers3 size={24} /></span>}
            <span><strong>{id ? categories[id].name : '全部类别'}</strong><small>{count} 条记录</small></span>
            {category === id && <Check className={styles.categoryCheck} size={18} aria-hidden="true" />}
          </button>;
        })}
      </div>
    </dialog>
  </div>;
}
