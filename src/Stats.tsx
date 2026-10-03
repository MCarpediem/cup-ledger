import { useState } from 'react';
import { addMonths, addWeeks, addYears, format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { categories } from './catalog';
import { aggregate, dateList, dayKey, inRange, metrics, periodRange, preferences, pretty, uniqueDrinks } from './domain';
import { categoryIds, metricInfo, type Metric, type Period } from './model';
import { Badge, DayDetail, Empty, Header, SectionTitle, useData, useToday } from './components';
import styles from './App.module.css';

export function Stats() {
  const { records, settings } = useData();
  const today = useToday();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [metric, setMetric] = useState<Metric>('water');
  const range = periodRange(period, parseISO(anchor), parseISO(today));
  const cycleRecords = inRange(records, range.startKey, range.endKey);
  const sums = aggregate(cycleRecords);
  const preference = preferences(cycleRecords.filter(record => record.category !== 'water'));
  const currentRange = range.endKey >= today;
  const dateKeys = dateList(range.start, range.end);
  const chartData = dateKeys.filter(date => dayKey(date) <= today).map(date => {
    const totals = aggregate(cycleRecords.filter(r => r.dayKey === dayKey(date)));
    return { date: format(date, 'M/d'), value: totals[metric].value, incomplete: totals[metric].incomplete };
  });
  const categoryData = categoryIds.map(id => ({ id, name: categories[id].name, value: cycleRecords.filter(r => r.category === id).reduce((sum, r) => sum + r.volume * r.quantity, 0) })).filter(item => item.value > 0);
  const totalVolume = categoryData.reduce((sum, item) => sum + item.value, 0);
  const calendarDates = period === 'month' ? dateList(startOfWeek(range.start, { weekStartsOn: 1 }), endOfWeek(range.end, { weekStartsOn: 1 })) : dateKeys;
  function move(direction: number) {
    const date = parseISO(anchor);
    const next = period === 'week' ? addWeeks(date, direction) : period === 'month' ? addMonths(date, direction) : addYears(date, direction);
    setAnchor(dayKey(next));
    const nextRange = periodRange(period, next, parseISO(today));
    setSelected(nextRange.startKey);
  }
  function changePeriod(next: Period) { setPeriod(next); setAnchor(today); setSelected(today); }
  return <><Header title="慢慢看见，自己的习惯" eyebrow="饮品回顾 / INSIGHTS" action={<Sparkles size={23} strokeWidth={1.4} />} />
    <div className={styles.segmented} role="group" aria-label="统计周期">{([{ id: 'week', name: '周' }, { id: 'month', name: '月' }, { id: 'year', name: '年' }] as const).map(item => <button key={item.id} aria-pressed={period === item.id} onClick={() => changePeriod(item.id)}>{item.name}</button>)}</div>
    <div className={styles.periodHeading}><button className={styles.iconButton} aria-label="上一个周期" onClick={() => move(-1)}><ChevronLeft size={21} /></button><h2>{period === 'week' ? `${format(range.start, 'yyyy.M.d')} — ${format(range.end, 'M.d')}` : format(range.start, period === 'month' ? 'yyyy 年 M 月' : 'yyyy 年')}</h2><button disabled={currentRange} className={styles.iconButton} aria-label="下一个周期" onClick={() => move(1)}><ChevronRight size={21} /></button></div>
    {!currentRange && <button className={styles.textButton} onClick={() => { setAnchor(today); setSelected(today); }}>回到本{period === 'week' ? '周' : period === 'month' ? '月' : '年'}</button>}
    {period !== 'year' && <section className={styles.calendar} aria-label={period === 'week' ? '周日历' : '月日历'}><div className={styles.weekdays}>{['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day}>{day}</span>)}</div><div className={styles.calendarGrid}>{calendarDates.map(date => {
      const key = dayKey(date);
      const outside = key < range.startKey || key > range.endKey;
      const drinks = uniqueDrinks(records.filter(r => r.dayKey === key));
      const visible = period === 'month' ? drinks.slice(0, 2) : drinks;
      return <button key={key} className={`${styles.calendarDay} ${outside ? styles.outside : ''}`} disabled={outside || key > today} aria-pressed={selected === key} aria-label={`${key}，${drinks.length} 种饮品`} onClick={() => setSelected(key)}><span className={key === today ? styles.todayDate : ''}>{format(date, 'd')}</span><div>{visible.map(drink => <span title={drink.name} key={drink.typeId}><Badge category={drink.category} small /></span>)}{drinks.length > visible.length && <small>+{drinks.length - visible.length}</small>}</div></button>;
    })}</div></section>}
    <SectionTitle title="这一段时间的积累"><span className={styles.muted}>{cycleRecords.length} 条记录</span></SectionTitle><p className={styles.footnote}>日均按 {range.days} 个自然日计算{currentRange ? '，截至今天' : '，包含没有记录的日期'}。</p>
    <div className={styles.periodMetrics} role="group" aria-label="周期摄入指标">{metrics.map(key => <div key={key}><span>{metricInfo[key].label}</span><p>{pretty(sums[key].value)} <small>{metricInfo[key].unit}</small></p><small>日均 {pretty(sums[key].value / range.days)} {metricInfo[key].unit}{sums[key].incomplete && ' · 合计不完整'}</small></div>)}</div>
    {cycleRecords.length > 0 ? <>
      {period !== 'year' && <section><SectionTitle title="每天的一点变化" /><label className={styles.chartSelect}>查看指标<select value={metric} onChange={e => setMetric(e.target.value as Metric)}>{metrics.map(key => <option key={key} value={key}>{metricInfo[key].label}（{metricInfo[key].unit}）</option>)}</select></label><div className={styles.chart} aria-label={`${metricInfo[metric].label}每日趋势`}><ResponsiveContainer width="100%" height={210}><AreaChart data={chartData} margin={{ left: -20, right: 12, top: 16, bottom: 0 }}><defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#99725D" stopOpacity={0.22}/><stop offset="100%" stopColor="#99725D" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#E6D9CC" strokeDasharray="3 3"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 13, fontWeight: 500, fill: '#65584F' }} minTickGap={24}/><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 13, fontWeight: 500, fill: '#65584F' }}/><Tooltip formatter={value => [`${pretty(Number(value))} ${metricInfo[metric].unit}`, metricInfo[metric].label]} contentStyle={{ borderColor: '#E6D9CC', borderRadius: 12, background: '#FFF9F2' }}/><Area type="monotone" dataKey="value" stroke="#8B4F3D" strokeWidth={2} fill="url(#trend-fill)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>{sums[metric].incomplete && <p className={styles.footnote}>部分记录未填写此成分，趋势仅显示已知值。</p>}<details className={styles.chartDetails}><summary>查看每日数值</summary><ul>{chartData.map(item => <li key={item.date}><span>{item.date}</span><strong>{pretty(item.value)} {metricInfo[metric].unit}{item.incomplete && ' · 不完整'}</strong></li>)}</ul></details></section>}
      <SectionTitle title="杯中的偏好" /><div className={styles.preferenceGrid}><div><span>最常喝的饮品</span><h3>{preference.frequent?.name ?? '暂未记录'}</h3><p>{preference.frequent ? `${preference.frequent.quantity} 份` : '记下一杯非水饮品后显示'}</p></div><div><span>饮用量最多的饮品</span><h3>{preference.mostVolume?.name ?? '暂未记录'}</h3><p>{preference.mostVolume ? `${pretty(preference.mostVolume.volume)} ml` : '记下一杯非水饮品后显示'}</p></div></div>
      <SectionTitle title="饮品类别占比"><span className={styles.muted}>按饮用容量</span></SectionTitle><div className={styles.categoryChart}><div className={styles.donut}><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={49} outerRadius={72} paddingAngle={3} stroke="none" isAnimationActive={false}>{categoryData.map(item => <Cell key={item.id} fill={categories[item.id].color} />)}</Pie><Tooltip formatter={value => `${pretty(Number(value))} ml`} /></PieChart></ResponsiveContainer><span>{pretty(totalVolume)}<small>ml</small></span></div><ul className={styles.legend}>{categoryData.map(item => <li key={item.id}><i style={{ background: categories[item.id].color }} /><span>{item.name}<small>{pretty(item.value)} ml</small></span><strong>{pretty(item.value / totalVolume * 100)}%</strong></li>)}</ul></div>
    </> : <Empty title="这段时间，还没有记录" description="记下每一杯，慢慢发现自己的饮品偏好。" />}
    {period !== 'year' && <section className={styles.dayDetail}><SectionTitle title={`${format(parseISO(selected), 'M 月 d 日')}的饮品`} /><DayDetail records={records.filter(r => r.dayKey === selected)} settings={settings} /></section>}
  </>;
}
