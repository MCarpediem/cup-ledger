import { Component, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, NavLink, Route, Routes, useLocation, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, ChartNoAxesCombined, CupSoda, CalendarDays, UserRound } from 'lucide-react';
import { readData } from './db';
import { DataContext, useData } from './components';
import { DrinkForm } from './DrinkForm';
import { DrinkPicker, Goals, History, Profile, Templates, Today } from './pages';
import styles from './App.module.css';
import { Stats } from './Stats';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className={styles.app}><h1>暂时无法打开日记</h1><p>请确认浏览器允许本地存储，再重新加载。已有数据不会被主动清除。</p><button className={styles.primary} onClick={() => location.reload()}>重新加载</button></main> : this.props.children; }
}
export function App() { return <ErrorBoundary><Ledger /></ErrorBoundary>; }
function Ledger() {
  const data = useLiveQuery(() => readData(), []);
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollKey = `cup-ledger:scroll:${location.key}`;
  const pathScrollKey = `cup-ledger:scroll:path:${location.pathname}${location.search}`;
  useEffect(() => {
    function saveScroll() {
      try {
        const value = String(window.scrollY);
        sessionStorage.setItem(scrollKey, value);
        sessionStorage.setItem(pathScrollKey, value);
      } catch { /* Storage may be unavailable in private WebViews. */ }
    }
    function handleLinkClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest('a') : null;
      const href = target?.getAttribute('href');
      if (href?.startsWith('/')) saveScroll();
    }
    function handleScroll() { saveScroll(); }
    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('pointerdown', handleLinkClick, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => { document.removeEventListener('click', handleLinkClick, true); document.removeEventListener('pointerdown', handleLinkClick, true); window.removeEventListener('scroll', handleScroll); };
  }, [pathScrollKey, scrollKey]);
  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
    let restore = 0;
    if (navigationType === 'POP') {
      try { restore = Number(sessionStorage.getItem(pathScrollKey) ?? sessionStorage.getItem(scrollKey) ?? 0); } catch { restore = 0; }
    }
    const target = Number.isFinite(restore) ? restore : 0;
    window.scrollTo({ top: target, left: 0, behavior: 'auto' });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: target, left: 0, behavior: 'auto' })));
    const timer = window.setTimeout(() => window.scrollTo({ top: target, left: 0, behavior: 'auto' }), 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathScrollKey, scrollKey, navigationType]);
  if (!data) return <main className={styles.loading} role="status">正在翻开你的饮品日记…</main>;
  const mainPage = ['/', '/records', '/stats', '/profile'].includes(location.pathname);
  if (!data.settings.onboarded) return <main className={styles.app}><Goals initial={data.settings} onboarding /></main>;
  return <DataContext.Provider value={data}><div className={styles.shell}><div className={styles.desktopBrand}><CupSoda size={22} /> 杯记 <small>CUP LEDGER</small></div><main className={`${styles.app} ${mainPage ? styles.withNav : styles.fullscreen}`} key={location.pathname + location.search}><Suspense fallback={<p role="status">正在打开…</p>}><Routes>
    <Route path="/" element={<>{location.state?.saved && <p role="status" className={styles.saved}>这一杯，已经记下了。</p>}<Today /></>} />
    <Route path="/records" element={<History />} /><Route path="/stats" element={<Stats />} /><Route path="/profile" element={<Profile />} />
    <Route path="/add" element={<PickerRoute />} /><Route path="/add/:id" element={<FormRoute />} /><Route path="/record/:id" element={<FormRoute editing />} />
    <Route path="/templates" element={<Templates />} /><Route path="/templates/:id" element={<FormRoute templateMode />} />
    <Route path="/goals" element={<Goals initial={data.settings} />} /><Route path="*" element={<Missing />} />
  </Routes></Suspense></main>{mainPage && <nav className={styles.nav} aria-label="主导航">{[{ to: '/', label: '今日', icon: CalendarDays }, { to: '/records', label: '记录', icon: BookOpen }, { to: '/stats', label: '统计', icon: ChartNoAxesCombined }, { to: '/profile', label: '我的', icon: UserRound }].map(item => <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? styles.navActive : ''}><item.icon size={21} strokeWidth={1.7} /><span>{item.label}</span></NavLink>)}</nav>}</div></DataContext.Provider>;
}
function PickerRoute() { const [query] = useSearchParams(); return <DrinkPicker editId={query.get('edit')} />; }
function FormRoute({ editing = false, templateMode = false }: { editing?: boolean; templateMode?: boolean }) {
  const { id } = useParams();
  const [query] = useSearchParams();
  const { records, templates } = useData();
  const record = templateMode ? undefined : records.find(r => r.id === (editing ? id : query.get('edit')));
  const template = templates.find(t => t.id === (editing ? record?.templateId : id));
  if (editing && !record || !editing && !template && !(templateMode && id === 'new') || !templateMode && query.get('edit') && !record) return <Missing />;
  return <DrinkForm key={`${id}-${editing}-${templateMode}`} record={record} template={template} templateMode={templateMode} reselected={!editing && !!record} />;
}
function Missing() { return <div className={styles.empty}><h1>这页已经不在这里了</h1><p>饮品或记录可能已被删除。</p><Link to="/" className={styles.primary}>返回今日</Link></div>; }
