import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, Award, BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleCheck, Coins, FolderOpen, HeartPulse, House, Landmark, LockKeyhole, Mail, Map, Settings2, Shield, Sparkles, Upload, Users, X } from 'lucide-react';
import App from './App';
import { CASES } from './campaign/content';
import { createCampaign, getCareerGoals, getCase, getChapterEnding, getRank, openCase, parseCampaignSave, resolveCampaignEvent, syncFirstCase } from './campaign/engine';
import type { CampaignState, CampaignView, CaseId } from './campaign/types';
import type { GameState } from './game/types';
import CaseWorkspace from './components/campaign/CaseWorkspace';
import { CareerPanel, OfficePanel, ContactsPanel, CampaignArchive } from './components/campaign/ProgressionPanels';
import Modal from './components/campaign/Modal';
import './campaign.css';

export const CAMPAIGN_SAVE_KEY = 'sk-materialy-dela-campaign-v2';
const LEGACY_SAVE_KEY = 'sk-materialy-dela-v1';
const navigation: { id: CampaignView; label: string; icon: typeof Map }[] = [
  { id: 'campaign', label: 'Кампания', icon: Map },
  { id: 'case', label: 'Текущее дело', icon: FolderOpen },
  { id: 'career', label: 'Следователь', icon: Award },
  { id: 'office', label: 'Мой кабинет', icon: House },
  { id: 'contacts', label: 'Люди и отношения', icon: Users },
  { id: 'archive', label: 'Личный архив', icon: BookOpen },
];

function loadCampaign(): { state: CampaignState; error: string; recovery: string | null } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CAMPAIGN_SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY);
    return { state: raw ? parseCampaignSave(raw) : createCampaign(), error: '', recovery: null };
  } catch {
    return { state: createCampaign(), error: raw ? 'Сохранение не удалось прочитать. Исходный файл сохранён: его можно скачать в настройках.' : 'Хранилище браузера недоступно. Экспортируйте прогресс перед закрытием.', recovery: raw };
  }
}

const money = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;
const statusLabels = { locked: 'Пока недоступно', available: 'Новое поручение', investigating: 'В производстве', court: 'Судебная стадия', resolved: 'В архиве' };

function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CampaignApp() {
  const [initial] = useState(loadCampaign);
  const [state, setState] = useState(initial.state);
  const [view, setView] = useState<CampaignView>('campaign');
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [notice, setNotice] = useState(initial.error);
  const [saveError, setSaveError] = useState('');
  const [recovery, setRecovery] = useState(initial.recovery);
  const [modal, setModal] = useState<'settings' | 'reset' | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (recovery) { setSaveError('Исходное сохранение защищено от перезаписи. Импортируйте файл или подтвердите новую кампанию.'); return; }
    try {
      localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(state));
      localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(state.firstCase));
      setSaveError('');
    } catch { setSaveError('Автосохранение недоступно. Экспортируйте кампанию через настройки.'); }
  }, [state, recovery]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const onLegacyState = useCallback((firstCase: GameState) => setState(current => syncFirstCase(current, firstCase)), []);
  const change = (next: CampaignState) => setState(next);
  const run = (operation: () => CampaignState, message?: string) => {
    try { setState(operation()); if (message) setNotice(message); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Действие не удалось выполнить.'); return false; }
  };
  const goToCase = (id: CaseId) => {
    if (!run(() => openCase(state, id))) return;
    setView('case');
    if (id === '001' && !state.firstCase.ending) setLegacyOpen(true);
    window.scrollTo({ top: 0 });
  };
  const navigate = (next: CampaignView) => {
    if (next === 'case' && state.activeCase === '001' && !state.firstCase.ending) setLegacyOpen(true);
    setView(next); window.scrollTo({ top: 0 });
  };
  const exportSave = () => { download(JSON.stringify(state, null, 2), `sk-campaign-case-${state.activeCase}.json`); setNotice('Вся кампания, документы и подписи экспортированы.'); };
  async function importSave(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('Сохранение слишком большое. Выберите файл до 20 МБ.');
      const parsed = parseCampaignSave(await file.text());
      setState(parsed); setRecovery(null); setView('campaign'); setLegacyOpen(false); setModal(null); setNotice('Кампания восстановлена.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Сохранение повреждено.'); }
    if (importInput.current) importInput.current.value = '';
  }

  const currentCase = getCase(state.activeCase);
  const resolved = CASES.filter(item => state.cases[item.id].status === 'resolved').length;
  const pendingEvents = state.events.filter(event => event.selected === null);
  const selectedEvent = state.events.find(event => event.id === eventId);
  const rank = getRank(state);
  const careerGoals = getCareerGoals(state);
  const nextGoal = careerGoals.find(goal => !goal.claimed && goal.progress >= goal.target) ?? careerGoals.find(goal => !goal.claimed);
  const finale = state.chapterComplete ? getChapterEnding(state) : null;
  const title = view === 'campaign' ? 'Чужие решения' : view === 'case' ? currentCase.title : view === 'career' ? 'Дело вашей жизни' : view === 'office' ? 'Место, где всё начинается' : view === 'contacts' ? 'По обе стороны стола' : 'Ничего не исчезает бесследно';
  const subtitle = { campaign: 'Пять дел. Одна история. И решения, которые останутся с вами.', case: currentCase.subtitle, career: 'Опыт меняет возможности. Поступки — репутацию.', office: 'Личные покупки и служебное оснащение помогают в расследованиях.', contacts: 'Доверие складывается из разговоров и выполненных обещаний.', archive: 'Подписанные документы, судебные решения и история вашей службы.' }[view];

  if (legacyOpen) return <App initialState={state.firstCase} onStateChange={onLegacyState} onExit={() => { setLegacyOpen(false); setView(state.firstCase.ending ? 'case' : 'campaign'); }} />;

  return <div className="app-shell campaign-shell">
    <aside className="sidebar campaign-sidebar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('campaign'); }} aria-label="СК: Материалы дела — кампания"><span className="brand-emblem"><Shield size={28} strokeWidth={1.4} /><b>СК</b></span><span>МАТЕРИАЛЫ<br /><strong>ДЕЛА</strong></span></a>
      <div className="department-label">РАЙОННЫЙ СЛЕДСТВЕННЫЙ ОТДЕЛ<br /><span>г. Зареченск · Сентябрь 2026</span></div>
      <div className="nav-label">ЛИЧНОЕ ДЕЛО</div>
      <nav aria-label="Кампания и развитие">{navigation.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={18} strokeWidth={1.6} /><span>{item.label}</span>{item.id === 'career' && state.stats.skillPoints > 0 && <small>{state.stats.skillPoints}</small>}{item.id === 'contacts' && pendingEvents.length > 0 && <small>{pendingEvents.length}</small>}</button>)}</nav>
      <div className="campaign-side-progress"><span className="eyebrow">ГЛАВА I</span><strong>Чужие решения</strong><div className="chapter-mini-track">{CASES.map(item => <span key={item.id} className={state.cases[item.id].status === 'resolved' ? 'complete' : item.id === state.activeCase ? 'current' : ''} />)}</div><p>{resolved} из 5 дел завершено</p></div>
      <div className="campaign-side-note">«В каждом деле есть человек.<br />Не потеряйте его за бумагами».</div>
      <div className="profile"><span className="avatar">АМ</span><div><strong>{state.profileName}</strong><small>{rank}</small></div><span className="online-dot" /></div>
    </aside>

    <div className="workspace">
      <header className="topbar campaign-topbar"><div className="breadcrumbs"><span>Личная история</span><ChevronRight size={13} /><span>Глава I</span></div><div className="campaign-topbar-stats"><span title="Личные деньги"><Coins size={15} /><span>{money(state.stats.money)}<small>ЛИЧНЫЕ</small></span></span><span title="Служебный бюджет"><BriefcaseBusiness size={15} /><span>{money(state.stats.budget)}<small>БЮДЖЕТ</small></span></span><button className="icon-button" aria-label="Сохранение кампании и настройки" onClick={() => setModal('settings')}><Settings2 size={19} /></button></div></header>
      {saveError && <div className="storage-warning" role="alert">{saveError}</div>}
      <main className="main-area campaign-main">
        <header className="page-heading"><div><div className="eyebrow heading-eyebrow">СЮЖЕТНАЯ КАМПАНИЯ <span className="dot-separator">·</span><span className="status-text">ПЕРВАЯ ГЛАВА</span></div><h1>{title}</h1><p>{subtitle}</p></div><button className="campaign-rank-tag" onClick={() => navigate('career')}><Award size={18} /><span>{rank}<small>{state.stats.xp} ОПЫТА</small></span></button></header>

        {pendingEvents.length > 0 && <section className="campaign-inbox-banner" aria-label="Новые события"><span className="inbox-icon"><Mail size={19} /></span><div><strong>У прошлых решений появилось продолжение</strong><p>{pendingEvents[0].title}{pendingEvents.length > 1 ? ` · ещё ${pendingEvents.length - 1}` : ''}</p></div><button className="text-button" onClick={() => setEventId(pendingEvents[0].id)}>Прочитать <ArrowRight size={16} /></button></section>}

        {view === 'campaign' && <div className="campaign-dashboard-grid"><div className="campaign-dashboard-main">
          <section className="campaign-hero"><div className="campaign-hero-art" /><div className="campaign-hero-shade" /><div className="campaign-hero-top"><span className="hero-tag">ГЛАВА I / СЕНТЯБРЬ</span><span className="campaign-hero-number">01—05</span></div><div className="campaign-hero-content"><span className="eyebrow">ЗАРЕЧЕНСК. ГОРОД, КОТОРЫЙ УМЕЕТ МОЛЧАТЬ.</span><h2>{finale ? finale.title : <>Правда редко<br />помещается в одну папку.</>}</h2><p>{finale ? finale.text : state.firstCase.ending ? 'Первое дело оставило больше вопросов, чем ответов. За исчезнувшими документами обнаруживается история, в которой слишком многим есть что терять.' : 'Начните с исчезнувшей папки. Изучайте следы, проверяйте показания и собирайте историю, в которой слишком многим есть что терять.'}</p><button className="hero-button" onClick={() => finale ? navigate('archive') : goToCase(state.activeCase)}>{finale ? 'Открыть историю главы' : state.cases[state.activeCase].status === 'court' ? 'Перейти к судебному заседанию' : 'Продолжить расследование'}<ArrowUpRight size={17} /></button></div><div className="campaign-hero-footer"><span><span className="online-dot" /> {finale ? 'ГЛАВА ЗАВЕРШЕНА' : `ТЕКУЩЕЕ ДЕЛО № ${state.activeCase}`}</span><span>{finale ? 'РЕШЕНИЯ СОХРАНЕНЫ В АРХИВЕ' : currentCase.title.toUpperCase()}</span></div></section>

          <section className="campaign-growth-goal" aria-label="Цель развития героя">
            <span className="campaign-growth-icon"><Award size={23} strokeWidth={1.4} /></span>
            <div><span className="eyebrow">ВАША СЛЕДУЮЩАЯ ЦЕЛЬ</span><h3>{nextGoal ? nextGoal.title : 'Все цели первой главы выполнены'}</h3><p>{nextGoal ? `${Math.min(nextGoal.progress, nextGoal.target)} / ${nextGoal.target} · ${nextGoal.rewardText}` : 'Достижения сохранены в личном деле. Продолжайте развивать навыки и отношения.'}</p></div>
            <button className="text-button" onClick={() => navigate('career')}>Открыть цели <ArrowRight size={15} /></button>
          </section>
          <div className="chapter-section-heading"><div><span className="eyebrow">ОТ ПЕРВОГО СЛЕДА ДО СУДА</span><h2>Материалы одной истории</h2></div><span className="chapter-count">{resolved}<small> / 5</small></span></div>
          <div className="chapter-case-list">{CASES.map((item, index) => {
            const progress = state.cases[item.id]; const locked = progress.status === 'locked'; const completed = progress.status === 'resolved';
            return <article key={item.id} className={`chapter-case-card ${locked ? 'locked' : ''} ${item.id === state.activeCase ? 'current' : ''} ${completed ? 'completed' : ''}`}>
              <div className="case-card-number"><span>ДЕЛО</span><strong>{String(index + 1).padStart(2, '0')}</strong>{completed ? <CircleCheck size={17} /> : locked ? <LockKeyhole size={15} /> : <FolderOpen size={17} />}</div>
              <div className="case-card-info"><div className="case-card-heading"><h3>{item.title}</h3><span className={`case-status case-status-${progress.status}`}>{statusLabels[progress.status]}</span></div><p>{item.subtitle}</p><div className="case-card-location"><span>{item.location}</span>{completed && progress.courtResult && <span className="case-card-outcome">{progress.courtResult.title}</span>}</div></div>
              <button className="case-card-open" aria-label={`${locked ? 'Недоступно' : completed ? 'Архив' : 'Открыть'}: ${item.title}`} disabled={locked} onClick={() => goToCase(item.id)}>{locked ? <LockKeyhole size={16} /> : <ArrowUpRight size={20} />}</button>
            </article>;
          })}</div>

          <section className="campaign-journal-preview"><div className="section-heading"><h2>На полях личного дела</h2><button className="text-button" onClick={() => navigate('archive')}>Весь архив <ArrowRight size={14} /></button></div>{state.journal.length ? state.journal.slice(-3).reverse().map(entry => <div className="campaign-log-row" key={entry.id}><span>№ {entry.caseId}<small>День {entry.day}</small></span><p>{entry.text}</p></div>) : <p className="campaign-empty-log">Служба начинается с первого поручения. Ваши действия и решения появятся здесь.</p>}</section>
        </div><aside className="campaign-dashboard-aside">
          <section className="panel campaign-person-card"><span className="eyebrow">СЛЕДОВАТЕЛЬ</span><div className="campaign-person-identity"><span className="campaign-person-avatar">АМ</span><div><strong>{state.profileName}</strong><small>{rank}</small></div></div><div className="campaign-xp-label"><span>Профессиональный опыт</span><strong>{state.stats.xp} XP</strong></div><div className="campaign-xp-track"><span style={{ width: `${state.stats.xp % 100}%` }} /></div><p className="campaign-xp-help">Каждые 100 XP — очко навыка</p>{state.stats.skillPoints > 0 && <button className="campaign-skill-notice" onClick={() => navigate('career')}><Sparkles size={17} /><span>Доступно очков: <strong>{state.stats.skillPoints}</strong></span><ArrowRight size={15} /></button>}<div className="campaign-vital-row"><span><HeartPulse size={15} /> Здоровье</span><strong>{state.stats.health}%</strong></div><div className="campaign-vital-row"><span><Shield size={15} /> Репутация</span><strong>{state.stats.reputation}/100</strong></div><button className="secondary-button full-width" onClick={() => navigate('career')}>Открыть личное дело</button></section>
          <section className="panel campaign-office-card"><div className="section-heading"><h2>Кабинет № 12</h2><House size={17} /></div><div className="campaign-office-mini"><div className="mini-window" /><div className="mini-frame" /><div className="mini-table"><span /></div><div className="mini-chair" /><div className="mini-cabinet" /></div><p>{state.upgrades.length === 0 ? 'Рабочее место скромное. Каждая деталь может сделать его удобнее.' : `Приобретено улучшений: ${state.upgrades.length}. Оснащение помогает в новых расследованиях.`}</p><button className="text-button" onClick={() => navigate('office')}>Обустроить кабинет <ArrowUpRight size={15} /></button></section>
          <section className="campaign-system-note"><Landmark size={22} strokeWidth={1.3} /><h3>Подпись — только начало</h3><p>После расследования ваши выводы проверят в суде. Сохранённый источник бывает убедительнее самой уверенной речи.</p></section>
          <div className="campaign-save-note"><span className={saveError ? 'warning-dot' : 'online-dot'} />{saveError ? 'Проверьте сохранение' : 'Прогресс сохраняется в этом браузере'}</div>
        </aside></div>}

        {view === 'case' && <CaseWorkspace state={state} onChange={change} onNotify={setNotice} onOpenLegacy={() => setLegacyOpen(true)} />}
        {view === 'career' && <CareerPanel state={state} onChange={change} onNotify={setNotice} />}
        {view === 'office' && <OfficePanel state={state} onChange={change} onNotify={setNotice} />}
        {view === 'contacts' && <ContactsPanel state={state} onChange={change} onNotify={setNotice} />}
        {view === 'archive' && <CampaignArchive state={state} onChange={change} onNotify={setNotice} />}
        {view === 'case' && state.cases[state.activeCase].status === 'resolved' && <div className="campaign-next-case"><Check size={22} /><div><strong>Решение сохранено. История продолжается.</strong><p>{state.chapterComplete ? 'Все пять дел первой главы завершены. Последствия отражены в личном архиве.' : 'Следующее поручение доступно на карте кампании.'}</p></div><button className="primary-button" onClick={() => navigate('campaign')}>{state.chapterComplete ? 'Итоги главы' : 'К следующему делу'}<ArrowRight size={16} /></button></div>}
        <footer className="workspace-footer"><span>СК: МАТЕРИАЛЫ ДЕЛА</span><span>Первая глава · Развитие героя · Версия 0.3</span><span>НИ ОДНО РЕШЕНИЕ НЕ ИСЧЕЗАЕТ</span></footer>
      </main>
    </div>

    {notice && <div className="toast" role="status"><AlertCircle size={18} /><span>{notice}</span><button className="icon-button" aria-label="Скрыть уведомление" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {selectedEvent && <Modal title={selectedEvent.title} onClose={() => setEventId(null)}><div className="eyebrow">ПОСЛЕДСТВИЕ ПРЕЖНЕГО РЕШЕНИЯ · ДЕЛО {selectedEvent.caseId}</div><p className="campaign-event-text">{selectedEvent.text}</p>{selectedEvent.selected ? <p>{selectedEvent.response}</p> : <div className="campaign-event-choices">{selectedEvent.choices.map(choice => <button className="secondary-button" key={choice.id} onClick={() => { if (run(() => resolveCampaignEvent(state, selectedEvent.id, choice.id), choice.response)) setEventId(null); }}>{choice.label}<ArrowRight size={15} /></button>)}</div>}</Modal>}
    {modal === 'settings' && <Modal title="Сохранение кампании" onClose={() => setModal(null)}><p className="modal-copy">Один файл содержит все пять дел, развитие персонажа, покупки, отношения и подписанные документы. Поддерживается импорт сохранения первого прототипа.</p><div className="settings-actions"><button className="secondary-button" onClick={exportSave}><ArrowDownToLine size={18} /> Экспортировать кампанию</button><button className="secondary-button" onClick={() => importInput.current?.click()}><Upload size={18} /> Импортировать сохранение</button><input type="file" hidden ref={importInput} accept=".json,application/json" onChange={event => void importSave(event.target.files?.[0])} />{recovery && <button className="secondary-button" onClick={() => download(recovery, 'sk-original-save-recovery.json')}>Скачать исходное сохранение</button>}<button className="text-button danger-text" onClick={() => setModal('reset')}>Начать новую кампанию</button></div><div className="settings-note">Мышь, клавиатура или сенсорный экран.<br />Рукописная подпись и ввод имени дают одинаковые игровые возможности.<br />Сведения и персонажи вымышлены.</div></Modal>}
    {modal === 'reset' && <Modal title="Новая кампания" onClose={() => setModal(null)}><p className="modal-copy">Текущие дела, покупки и развитие будут заменены новой кампанией. Перед этим можно сохранить отдельную копию.</p><div className="button-row"><button className="secondary-button" onClick={exportSave}>Экспортировать текущую</button><button className="primary-button" onClick={() => { setState(createCampaign()); setRecovery(null); setLegacyOpen(false); setView('campaign'); setModal(null); setNotice('Новое личное дело открыто.'); }}>Начать новую кампанию</button></div></Modal>}
  </div>;
}
