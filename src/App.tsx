import { Component, Suspense, useEffect, useLayoutEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, NavLink, Route, Routes, useLocation, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, ChartNoAxesCombined, CupSoda, CalendarDays, UserRound } from 'lucide-react';
import { LedgerDB, readData, selectAccountDatabase } from './db';
import { DataContext, useData } from './components';
import { DrinkForm } from './DrinkForm';
import { DrinkPicker, Goals, History, Profile, Templates, Today } from './pages';
import styles from './App.module.css';
import { Stats } from './Stats';
import { cloudTransport, emptySnapshot, mergeSnapshots, readSnapshot, syncOnce } from './cloudSync';
import { supabase, supabaseConfigured } from './supabase';
import type { Session } from '@supabase/supabase-js';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className={styles.app}><h1>暂时无法打开日记</h1><p>请确认浏览器允许本地存储，再重新加载。已有数据不会被主动清除。</p><button className={styles.primary} onClick={() => location.reload()}>重新加载</button></main> : this.props.children; }
}
export function App() { return <ErrorBoundary>{supabaseConfigured ? <AuthenticatedLedger /> : <Ledger />}</ErrorBoundary>; }
function AuthenticatedLedger() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);
  if (!ready) return <main className={styles.loading}>正在检查登录状态…</main>;
  return session ? <SyncedLedger key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} /> : <AuthScreen />;
}
function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supabase) return; setBusy(true); setMessage(''); try { const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password }); if (result.error) throw result.error; setMessage(mode === 'signup' ? '注册成功，请检查邮箱确认后登录。' : ''); } catch (error) { setMessage(error instanceof Error ? error.message : '登录失败，请稍后重试。'); } finally { setBusy(false); } }
  return <main className={styles.app}><div className={styles.onboarding}><div className={styles.brand}><CupSoda size={27} /><span>杯记 <small>cup-ledger</small></span></div><h1>{mode === 'login' ? '登录你的饮品日记' : '创建杯记账号'}</h1><p className={styles.intro}>登录后可在不同设备继续记录。</p><form onSubmit={submit} className={styles.form}><label className={styles.goalField}><span>邮箱</span><input required type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className={styles.goalField}><span>密码</span><input required minLength={6} type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>{message && <p role="alert" className={styles.error}>{message}</p>}<button className={styles.primary} disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}</button><button type="button" className={styles.textButton} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? '还没有账号？注册' : '已有账号？返回登录'}</button></form></div></main>;
}
function SyncedLedger({ userId, email }: { userId: string; email: string }) {
  const [database] = useState(() => selectAccountDatabase(userId));
  const [status, setStatus] = useState('正在同步…');
  const [migration, setMigration] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; let running = false;
    const sync = async () => {
      if (!active || running) return;
      running = true; setStatus('正在同步…');
      try { await syncOnce(database, cloudTransport(userId)); if (active) setStatus('已同步'); }
      catch (error) { if (active) setStatus(`同步失败：${error instanceof Error ? error.message : '请检查网络后重试'}`); }
      finally { running = false; }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 15000);
    window.addEventListener('online', sync); window.addEventListener('focus', sync);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('online', sync); window.removeEventListener('focus', sync); };
  }, [database, userId, retry]);
  async function importLocal() {
    const guest = new LedgerDB();
    try {
      const source = await readSnapshot(guest); const current = await readSnapshot(database);
      const imported = mergeSnapshots(emptySnapshot(), { ...source, settings: current.settings }, current);
      await database.transaction('rw', database.records, database.templates, database.favorites, async () => {
        await database.records.bulkPut(imported.records); await database.templates.bulkPut(imported.templates); await database.favorites.bulkPut(imported.favorites);
      });
      setMigration(false); setRetry(value => value + 1);
    } catch (error) { setStatus(error instanceof Error ? error.message : '导入失败'); } finally { guest.close(); }
  }
  return <><Ledger /><aside className={styles.syncStatus} aria-label="账号与同步"><span>{email}</span><span role="status">{status}</span><button type="button" onClick={() => setRetry(value => value + 1)}>立即同步</button><button type="button" onClick={() => setMigration(true)}>导入原本地记录</button><button type="button" onClick={() => void supabase?.auth.signOut().then(({ error }) => { if (error) setStatus(error.message); })}>退出登录</button></aside>{migration && <div className={styles.modalBackdrop}><div role="dialog" aria-modal="true" aria-labelledby="import-title" className={styles.modal}><h2 id="import-title">导入这台设备的原本地记录？</h2><p>这些记录将加入当前账号并同步到云端。原本地数据会保留，目标设置沿用账号设置。</p><button className={styles.secondary} onClick={() => setMigration(false)}>取消</button><button className={styles.primary} onClick={() => void importLocal()}>确认导入当前账号</button></div></div>}</>;
}
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
      if (href?.startsWith('/') && target?.getAttribute('data-history-back') !== 'true') saveScroll();
    }
    document.addEventListener('click', handleLinkClick, true);
    return () => { document.removeEventListener('click', handleLinkClick, true); };
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
