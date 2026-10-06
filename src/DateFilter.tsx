import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, addMonths, addYears, format, parseISO, setMonth, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useToday } from './components';
import { dateList, dayKey } from './domain';
import styles from './App.module.css';

export function DateFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const today = useToday();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [month, setCalendarMonth] = useState(() => startOfMonth(parseISO(value || today)));
  const [monthsView, setMonthsView] = useState(false);
  const [focusedDay, setFocusedDay] = useState(value || today);
  const firstDay = startOfWeek(month, { weekStartsOn: 1 });
  const days = dateList(firstDay, addDays(firstDay, 41));
  const tabStop = days.some(date => dayKey(date) === focusedDay) ? focusedDay : dayKey(month);
  const close = () => dialog.current?.close();
  function choose(date: string) { onChange(date); close(); }
  function show() {
    setCalendarMonth(startOfMonth(parseISO(value || today)));
    setFocusedDay(value || today);
    setMonthsView(false);
    pendingFocus.current = true;
    dialog.current?.showModal();
    setOpen(true);
  }
  useLayoutEffect(() => {
    if (!open || monthsView || !pendingFocus.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusedDay}"]`)?.focus();
    pendingFocus.current = false;
  }, [open, month, monthsView, focusedDay]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    let next: Date;
    switch (event.key) {
      case 'ArrowLeft': next = addDays(date, -1); break;
      case 'ArrowRight': next = addDays(date, 1); break;
      case 'ArrowUp': next = addDays(date, -7); break;
      case 'ArrowDown': next = addDays(date, 7); break;
      case 'Home': next = startOfWeek(date, { weekStartsOn: 1 }); break;
      case 'End': next = addDays(startOfWeek(date, { weekStartsOn: 1 }), 6); break;
      case 'PageUp': next = addMonths(date, -1); break;
      case 'PageDown': next = addMonths(date, 1); break;
      default: return;
    }
    event.preventDefault();
    pendingFocus.current = true;
    setFocusedDay(dayKey(next));
    setCalendarMonth(startOfMonth(next));
  }

  return <div className={styles.filterField}>
    <span>饮用日期</span>
    <button ref={trigger} type="button" className={styles.dateControl} aria-label={`饮用日期筛选：${value || '全部日期'}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={show}>
      <CalendarDays size={19} aria-hidden="true" /><span data-testid="date-display" className={!value ? styles.datePlaceholder : undefined}>{value ? value.replaceAll('-', '/') : '年 / 月 / 日'}</span><ChevronDown size={17} aria-hidden="true" />
    </button>
    <dialog ref={dialog} id={id} className={styles.dateDialog} aria-labelledby={`${id}-title`} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <div className={styles.sheetHandle} aria-hidden="true" />
      <header className={styles.dateDialogHeader}><h2 id={`${id}-title`}>选择饮用日期</h2><button type="button" className={styles.iconButton} aria-label="关闭日期选择" onClick={close}><X size={20} /></button></header>
      <div className={styles.dateMonthHeading}>
        <button type="button" className={styles.iconButton} aria-label={monthsView ? '上一年' : '上个月'} onClick={() => setCalendarMonth(monthsView ? addYears(month, -1) : addMonths(month, -1))}><ChevronLeft size={20} /></button>
        <button type="button" className={styles.dateMonthToggle} aria-label={monthsView ? '返回日期选择' : '选择月份'} aria-expanded={monthsView} onClick={() => setMonthsView(view => !view)}>{format(month, monthsView ? 'yyyy 年' : 'yyyy 年 M 月')}<ChevronDown size={16} aria-hidden="true" /></button>
        <button type="button" className={styles.iconButton} aria-label={monthsView ? '下一年' : '下个月'} onClick={() => setCalendarMonth(monthsView ? addYears(month, 1) : addMonths(month, 1))}><ChevronRight size={20} /></button>
      </div>
      {monthsView ? <div className={styles.dateMonths} role="group" aria-label="月份选择">{Array.from({ length: 12 }, (_, index) => <button type="button" key={index} aria-pressed={month.getMonth() === index} onClick={() => { setCalendarMonth(setMonth(month, index)); setMonthsView(false); }}>{index + 1} 月</button>)}</div> : <>
        <div className={styles.dateWeekdays} aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}</div>
        <div ref={grid} className={styles.dateDays} role="group" aria-label="日期选择">{days.map(date => {
          const key = dayKey(date);
          return <button type="button" key={key} data-day={key} aria-label={key} aria-pressed={value === key} aria-current={key === today ? 'date' : undefined} tabIndex={key === tabStop ? 0 : -1} className={date.getMonth() !== month.getMonth() ? styles.dateOutside : undefined} onKeyDown={event => navigate(event, date)} onClick={() => choose(key)}>{format(date, 'd')}</button>;
        })}</div>
      </>}
      <footer className={styles.dateDialogFooter}><button type="button" className={styles.textButton} disabled={!value} onClick={() => choose('')}>清除日期</button><button type="button" className={styles.dateTodayButton} onClick={() => choose(today)}>今天</button></footer>
    </dialog>
  </div>;
}
