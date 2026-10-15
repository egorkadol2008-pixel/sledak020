import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, FileSignature, Files, Folder, MapPin, NotebookPen, RotateCcw, Settings2, Shield, Upload, Users, X } from 'lucide-react';
import { ACTIONS, EVIDENCE } from './game/content';
import { assessCase, createInitialState, endDay, finishCase, getAvailability, getTime, parseSave, performAction, signDocument, updateDraft } from './game/engine';
import type { Decision, EvidenceId, GameState, Hypothesis, Tab } from './game/types';
import DocumentsPanel from './components/DocumentsPanel';
import SignaturePad from './components/SignaturePad';
import { EvidencePanel, PeoplePanel, ScenePanel } from './components/InvestigationPanels';

const SAVE_KEY = 'sk-materialy-dela-v1';
const navigation: { id: Tab; label: string; icon: typeof Folder }[] = [
  { id: 'overview', label: 'Обзор дела', icon: Folder },
  { id: 'scene', label: 'Место происшествия', icon: MapPin },
  { id: 'people', label: 'Участники дела', icon: Users },
  { id: 'evidence', label: 'Материалы', icon: Files },
  { id: 'documents', label: 'Документы', icon: FileSignature },
  { id: 'journal', label: 'Журнал следователя', icon: NotebookPen },
];
const hypotheses: Record<Hypothesis, string> = { unknown: 'Недостаточно данных', intervention: 'Вмешательство другого лица', suicide: 'Исходная версия: самоубийство' };

function loadInitial(): { state: GameState; error: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return { state: raw ? parseSave(raw) : createInitialState(), error: '' };
  } catch {
    return { state: createInitialState(), error: 'Не удалось прочитать сохранение. Доступна новая игра и импорт резервной копии.' };
  }
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () => Array.from(node?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    node?.addEventListener('keydown', handler);
    return () => { node?.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Закрыть окно" onClick={onClose}><X size={20} /></button></header>
      {children}
    </div>
  </div>;
}

export default function App({ initialState, onStateChange, onExit }: { initialState?: GameState; onStateChange?: (state: GameState) => void; onExit?: () => void } = {}) {
  const [initial] = useState(() => initialState ? { state: initialState, error: '' } : loadInitial());
  const [state, setState] = useState(initial.state);
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState(initial.error);
  const [storageError, setStorageError] = useState('');
  const [modal, setModal] = useState<'settings' | 'report' | 'final' | 'reset' | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [signatureStep, setSignatureStep] = useState(false);
  const [hypothesis, setHypothesis] = useState<Hypothesis>(state.hypothesis);
  const [plan, setPlan] = useState('Проверить противоречия и дождаться результатов запросов.');
  const [decision, setDecision] = useState<Decision>('orlov');
  const [selected, setSelected] = useState<EvidenceId[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); setStorageError(''); }
    catch { setStorageError('Автосохранение недоступно. Экспортируйте прогресс через меню сохранения.'); }
  }, [state]);
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 6500); return () => clearTimeout(id); }, [notice]);

  const apply = (operation: (current: GameState) => GameState, success?: string) => {
    try { const next = operation(state); setState(next); if (success) setNotice(success); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось выполнить действие.'); return false; }
  };
  const closeModal = () => { setModal(null); setSignatureStep(false); };
  const act = (id: string) => { const availability = getAvailability(state, id); if (availability.allowed) setPendingAction(id); else setNotice(availability.reason ?? 'Действие уже выполнено.'); };
  const knownCount = Object.keys(state.evidence).length;
  const assessment = assessCase(state);
  const pending = ACTIONS.find(action => action.id === pendingAction);
  const openReport = () => { setHypothesis(state.hypothesis); setSignatureStep(false); setModal('report'); };
  const openFinal = () => { setSelected(Object.keys(state.evidence) as EvidenceId[]); setSignatureStep(false); setModal('final'); };
  const dayDate = new Date(Date.UTC(2026, 8, 13 + state.day));
  const dateLabel = dayDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const sideActions = ACTIONS.filter(action => ['preserve-camera', 'prepare-expert', 'request-access', 'request-print', 'contact-accountant', 'verify-finance', 'consult', 'break'].includes(action.id));

  function exportSave() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `materialy-dela-day-${state.day}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice('Сохранение экспортировано.');
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('Файл слишком большой для сохранения.');
      const next = parseSave(await file.text()); setState(next); setTab('overview'); closeModal(); setNotice('Прогресс восстановлен.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Файл сохранения повреждён.'); }
    if (importRef.current) importRef.current.value = '';
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('overview'); }} aria-label="СК: Материалы дела — обзор"><span className="brand-emblem"><Shield size={26} strokeWidth={1.4} /><b>СК</b></span><span>МАТЕРИАЛЫ<br /><strong>ДЕЛА</strong></span></a>
      <div className="department-label">СЛЕДСТВЕННЫЙ ОТДЕЛ<br /><span>г. Зареченск</span></div>
      <div className="nav-label">РАБОЧИЙ СТОЛ</div>
      <nav aria-label="Разделы расследования">{navigation.map(item => <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><item.icon size={18} strokeWidth={1.6} /><span>{item.label}</span>{item.id === 'evidence' && <small>{knownCount}</small>}{item.id === 'documents' && <small>{state.documents.length}</small>}</button>)}</nav>
      <div className="sidebar-case"><span className="eyebrow">В ПРОИЗВОДСТВЕ</span><div className="case-index">01 <span>/ Первое дело</span></div><p>У каждого решения<br />есть продолжение.</p><div className="sidebar-rule" /></div>
      <div className="profile"><span className="avatar">АМ</span><div><strong>{state.profileName}</strong><small>Младший следователь</small></div><span className="online-dot" title="Игра сохраняется локально" /></div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="breadcrumbs">{onExit ? <button className="text-button" onClick={onExit}>← К кампании</button> : <span>Кампания</span>}<ChevronRight size={13} /><span>Первое дело</span></div><div className="topbar-right"><span className="saved-indicator"><span className={storageError ? 'warning-dot' : 'online-dot'} />{storageError ? 'Нет сохранения' : 'Автосохранение'}</span><button className="icon-button" aria-label="Сохранение и настройки" onClick={() => setModal('settings')}><Settings2 size={19} /></button></div></header>
      {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
      <main className="main-area">
        <div className="page-heading"><div><div className="eyebrow heading-eyebrow">МАТЕРИАЛЫ № 001 / 2026 <span className="dot-separator">·</span> <span className="status-text">{state.ending ? 'РЕШЕНИЕ ПРИНЯТО' : 'В ПРОИЗВОДСТВЕ'}</span></div><h1>{tab === 'overview' ? 'Последняя папка' : navigation.find(item => item.id === tab)?.label}</h1><p>{tab === 'overview' ? 'Иногда самое важное — то, чего не оказалось на месте.' : 'Дело № 001 · Смерть предпринимателя Павла Коренева'}</p></div><div className="date-display"><CalendarDays size={15} /><span>{dateLabel}<small>Рабочий день {state.day}</small></span></div></div>

        <div className="content-grid"><div className="main-content">
          {tab === 'overview' && <>
            {state.ending ? <section className="ending-panel panel"><div className="ending-seal"><Shield size={36} /></div><div className="eyebrow">РЕШЕНИЕ В АРХИВЕ</div><h2>{state.ending.title}</h2><p>{state.ending.description}</p>{state.ending.issues.length > 0 && <ul className="issue-list">{state.ending.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}<div className="epilogue"><div className="eyebrow">ШЕСТЬ МЕСЯЦЕВ СПУСТЯ</div><p>{state.ending.epilogue}</p></div><div className="button-row"><button className="primary-button" onClick={() => setTab('documents')}>Открыть архив <ArrowRight size={16} /></button><button className="secondary-button" onClick={onExit ?? (() => setModal('reset'))}>{onExit ? 'К судебной стадии' : 'Другое прохождение'}</button></div></section> : <section className="case-hero"><div className="hero-art" /><div className="hero-shade" /><div className="hero-top"><span className="hero-tag">СЮЖЕТНАЯ КАМПАНИЯ</span><span className="hero-number">ДЕЛО 01</span></div><div className="hero-body"><span className="hero-location"><MapPin size={13} /> ОФИС КОРЕНЕВА · УЛ. ЗАВОДСКАЯ, 17</span><h2>Записка есть.<br />Ответов — пока нет.</h2><p>Предпринимателя нашли в собственном кабинете.<br className="desktop-break" /> Первичная версия — самоубийство. Но одна папка исчезла.</p><button className="hero-button" onClick={() => setTab('scene')}>К месту происшествия <ArrowUpRight size={17} /></button></div><div className="hero-footer"><span><span className="small-square" /> 13 СЕНТЯБРЯ 2026</span><span>21:30 · СООБЩЕНИЕ ПРИНЯТО</span></div></section>}

            <div className="overview-stat-row"><div><span className="stat-icon"><Files size={18} /></span><span><strong>{knownCount}<small> / 8</small></strong><em>материалов получено</em></span></div><div><span className="stat-icon"><FileSignature size={18} /></span><span><strong>{state.documents.length.toString().padStart(2, '0')}</strong><em>документов в архиве</em></span></div><div><span className="stat-icon"><Clock3 size={18} /></span><span><strong>{state.requests.length.toString().padStart(2, '0')}</strong><em>ожидаемых ответов</em></span></div></div>

            <section className="panel brief-panel"><div className="section-heading"><h2>Обстоятельства дела</h2><span className="paper-index">ЛИСТ 01</span></div><p className="brief-text">Павел Андреевич Коренев, владелец строительной фирмы, обнаружен мёртвым в своём кабинете. Рядом — напечатанная записка. Тело обнаружил охранник. Обстоятельства вечера пока не установлены.</p><div className="brief-note"><span className="note-line" /><p>«Не торопитесь с выводами. Сначала установите, что произошло на самом деле».<small>Руководитель следственного отдела</small></p></div><div className="brief-meta"><span><span className="muted">Погибший</span> Павел Коренев</span><span><span className="muted">Причина смерти</span> Не установлена</span></div></section>

            <section className="next-section"><div className="section-heading"><h2>С чего начать</h2><span className="muted">Вы выбираете порядок</span></div><div className="task-card-grid">{[{ title: 'Осмотреть кабинет', sub: 'Обстановка, записка, пропавшая папка', icon: MapPin, target: 'scene' as Tab, done: !!state.evidence.E01 }, { title: 'Сопоставить показания', sub: 'У каждого своя версия того вечера', icon: Users, target: 'people' as Tab, done: !!state.evidence.E06 }, { title: 'Проверить документы', sub: 'Внимание к деталям имеет значение', icon: FileSignature, target: 'documents' as Tab, done: state.documents.some(d => d.kind === 'inspection') }].map((item, index) => <button className={`task-card ${item.done ? 'task-done' : ''}`} key={item.title} onClick={() => setTab(item.target)}><div className="task-card-top"><item.icon size={21} strokeWidth={1.5} /><span>{item.done ? <Check size={16} /> : `0${index + 1}`}</span></div><strong>{item.title}</strong><p>{item.sub}</p><ArrowUpRight className="task-arrow" size={15} /></button>)}</div></section>

            <section className="recent-journal"><div className="section-heading"><h2>Последние записи</h2><button className="text-button" onClick={() => setTab('journal')}>Весь журнал <ArrowRight size={14} /></button></div>{state.journal.slice(-3).reverse().map(entry => <div className="journal-row" key={entry.id}><span className="journal-time">{entry.time}<small>День {entry.day}</small></span><span className="journal-dot" /><p>{entry.text}</p></div>)}</section>
          </>}
          {tab === 'scene' && <ScenePanel state={state} onAction={act} />}
          {tab === 'people' && <PeoplePanel state={state} onAction={act} />}
          {tab === 'evidence' && <EvidencePanel state={state} onAction={act} />}
          {tab === 'documents' && <DocumentsPanel state={state} onDraftChange={(kind, patch) => apply(current => updateDraft(current, kind, patch))} onSign={(kind, signature, mode) => { apply(current => signDocument(current, kind, signature, mode), 'Подписанная версия сохранена в архиве.'); }} />}
          {tab === 'journal' && <section className="panel journal-panel"><div className="section-heading"><h2>Хронология расследования</h2><span className="badge">{state.journal.length} записей</span></div><p className="muted">Решения остаются в деле. Здесь можно восстановить ход расследования.</p>{[...state.journal].reverse().map(entry => <div className="journal-row" key={entry.id}><span className="journal-time">{entry.time}<small>День {entry.day}</small></span><span className="journal-dot" /><p>{entry.text}</p></div>)}</section>}
        </div>

        <aside className="right-column"><section className="day-panel panel"><div className="section-heading"><span className="eyebrow">РАБОЧИЙ ДЕНЬ {String(state.day).padStart(2, '0')}</span><Clock3 size={16} /></div><div className="clock-display">{getTime(state.spent)}<span>/ 17:00</span></div><div className="time-track" aria-label={`Потрачено ${state.spent} из 16 единиц времени`}>{Array.from({ length: 16 }, (_, index) => <span key={index} className={index < state.spent ? 'used' : index === 15 ? 'reserved' : ''} />)}</div><p className="time-caption">{Math.max(0, 15 - state.spent) * 30} мин на действия <span>30 мин на отчёт</span></p><div className="day-divider" /><div className="eyebrow">РАБОЧАЯ ВЕРСИЯ</div><p className="current-hypothesis">{hypotheses[state.hypothesis]}</p><button className="primary-button full-width" disabled={!!state.ending} onClick={openReport}>Завершить день <ArrowRight size={16} /></button>{state.day >= 4 && !state.ending && <button className="secondary-button full-width final-action" onClick={openFinal}>Принять решение по делу</button>}<span className="day-footnote">Чтение материалов не расходует время</span></section>

          <section className="panel lead-panel"><div className="section-heading"><h2>Поручения и запросы</h2><span className="tiny-label">В РАБОТЕ</span></div>{sideActions.filter(action => action.minDay <= state.day && !getAvailability(state, action.id).completed).slice(0, 6).map(action => { const availability = getAvailability(state, action.id); return <button key={action.id} className="lead-action" onClick={() => act(action.id)} disabled={!availability.allowed || !!state.ending} title={availability.reason}><span className="lead-circle" /><span><strong>{action.title}</strong><small>{availability.allowed ? `${action.cost * 30} мин` : availability.reason}</small></span><ChevronRight size={14} /></button>; })}{state.requests.length > 0 && <div className="pending-requests"><div className="eyebrow">ОЖИДАЕМ ОТВЕТ</div>{state.requests.map(request => <p key={request.key}><span>{({ camera: 'Запись камеры', expert: 'Экспертиза', access: 'Журнал доступа', print: 'История печати', finance: 'Проверка документов' })[request.key]}</span><small>День {request.dueDay}</small></p>)}</div>}{state.cameraLost && <p className="inline-warning">Запись камеры перезаписана. Проверьте журнал доступа и показания охранника.</p>}</section>

          <section className="readiness-panel"><div className="eyebrow">ОСНОВАНИЯ ДЛЯ РЕШЕНИЯ</div>{[{ ok: assessment.event, label: 'Характер события' }, { ok: assessment.identity, label: 'Связь лица с событием' }, { ok: assessment.integrity, label: 'Оформление материалов' }].map(item => <div className="readiness-row" key={item.label}><span className={item.ok ? 'condition-yes' : 'condition-no'}>{item.ok ? <Check size={12} /> : '—'}</span><span>{item.label}</span></div>)}<p>Версия требует оснований.<br />Одного подозрения недостаточно.</p></section>
          <div className="sidebar-quote">«Факты не становятся<br />убедительнее от спешки».<span>ПАМЯТКА СЛЕДОВАТЕЛЮ</span></div>
        </aside></div>
        <footer className="workspace-footer"><span>СК: МАТЕРИАЛЫ ДЕЛА</span><span>Игровой прототип · Вымышленное расследование</span><span>ВЕРСИЯ 0.1</span></footer>
      </main>
    </div>

    {notice && <div className="toast" role="status"><AlertCircle size={18} /><span>{notice}</span><button className="icon-button" aria-label="Скрыть уведомление" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {pending && <Modal title={pending.title} onClose={() => setPendingAction(null)}><p className="modal-copy">{pending.description}</p><div className="action-cost"><Clock3 size={18} /><span>{pending.cost * 30} минут игрового времени</span><strong>{getTime(state.spent)} → {getTime(state.spent + pending.cost)}</strong></div><div className="button-row"><button className="secondary-button" onClick={() => setPendingAction(null)}>Отмена</button><button className="primary-button" onClick={() => { if (apply(current => performAction(current, pending.id), 'Действие выполнено. Материалы и журнал обновлены.')) setPendingAction(null); }}>Выполнить действие <ArrowRight size={16} /></button></div></Modal>}

    {modal === 'settings' && <Modal title="Сохранение расследования" onClose={closeModal}><p className="modal-copy">{onExit ? 'Первое дело сохраняется вместе с кампанией. Экспорт, импорт и новая игра доступны в настройках кампании.' : 'Прогресс сохраняется в этом браузере после каждого действия. Экспортируйте копию, чтобы продолжить на другом устройстве.'}</p><div className="settings-actions">{onExit ? <button className="secondary-button" onClick={onExit}>Вернуться к кампании</button> : <><button className="secondary-button" onClick={exportSave}><ArrowDownToLine size={18} /> Экспортировать сохранение</button><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload size={18} /> Импортировать сохранение</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => void importSave(e.target.files?.[0])} />{!onExit && <button className="text-button danger-text" onClick={() => setModal('reset')}><RotateCcw size={16} /> Начать новое расследование</button>}</>}</div><div className="settings-note">Четыре игровых дня · 8 источников · Несколько исходов<br />Масштабирование текста: стандартные настройки браузера.</div></Modal>}

    {modal === 'reset' && <Modal title="Начать заново?" onClose={closeModal}><p className="modal-copy">Текущее расследование будет заменено новой игрой. Можно сначала экспортировать сохранение.</p><div className="button-row"><button className="secondary-button" onClick={exportSave}>Сохранить копию</button><button className="primary-button" onClick={() => { setState(createInitialState()); setTab('overview'); closeModal(); setNotice('Новое дело открыто.'); }}>Начать новое дело</button></div></Modal>}

    {modal === 'report' && <Modal title={signatureStep ? 'Подписать итоговый отчёт' : `Итоги рабочего дня ${state.day}`} onClose={closeModal}>{signatureStep ? <SignaturePad title="Рабочая версия и план" initialName={state.profileName} samples={state.signatureSamples} onSaveSamples={samples => setState(current => ({ ...current, signatureSamples: samples }))} onCancel={() => setSignatureStep(false)} onConfirm={(signature, mode) => { if (apply(current => endDay(current, hypothesis, plan, signature, mode), 'Начался новый рабочий день. Проверьте поступившие ответы.')) { closeModal(); setTab('overview'); } }} /> : <><p className="modal-copy">Зафиксируйте то, что удалось установить. Незавершённые проверки можно продолжить завтра.</p><label className="field">Рабочая версия<select value={hypothesis} onChange={e => setHypothesis(e.target.value as Hypothesis)}>{Object.entries(hypotheses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field">Что проверить дальше<textarea rows={3} value={plan} onChange={e => setPlan(e.target.value)} placeholder="Укажите вопросы и следующий шаг" maxLength={1000} /></label><div className="report-summary"><span>В деле <strong>{knownCount} материалов</strong></span><span>Ожидается <strong>{state.requests.length} ответов</strong></span><span>Оформление <strong>30 минут</strong></span></div><button className="primary-button full-width" disabled={plan.trim().length < 5} onClick={() => setSignatureStep(true)}>Перейти к подписи <FileSignature size={16} /></button></>}</Modal>}

    {modal === 'final' && <Modal title={signatureStep ? 'Подписать решение по делу' : 'Решение по делу № 001'} onClose={closeModal} wide={!signatureStep}>{signatureStep ? <SignaturePad title="Итоговое решение" initialName={state.profileName} onCancel={() => setSignatureStep(false)} onConfirm={(signature, mode) => { if (apply(current => finishCase(current, decision, selected, signature, mode), 'Решение подписано и сохранено.')) { closeModal(); setTab('overview'); } }} /> : <><p className="modal-copy">Выберите решение и материалы, на которых оно основано. Подписанный пакет получит самостоятельную оценку; недостаток доказательств останется в деле.</p><div className="decision-options">{[{ value: 'orlov', title: 'Направить материалы в отношении Орлова', text: 'Проверить его участие и достаточность собранных оснований.' }, { value: 'volkova', title: 'Направить материалы в отношении Волковой', text: 'В решении будут учтены и оправдывающие сведения.' }, { value: 'close', title: 'Закрыть проверку', text: 'Подписать вывод об отсутствии оснований для продолжения.' }].map(option => <label className={`decision-option ${decision === option.value ? 'selected' : ''}`} key={option.value}><input type="radio" name="decision" value={option.value} checked={decision === option.value} onChange={() => setDecision(option.value as Decision)} /><span><strong>{option.title}</strong><small>{option.text}</small></span></label>)}</div><div className="eyebrow sources-heading">ПРИЛОЖИТЬ МАТЕРИАЛЫ</div><div className="source-checkboxes">{EVIDENCE.filter(e => state.evidence[e.id]).map(e => <label key={e.id}><input type="checkbox" checked={selected.includes(e.id)} onChange={() => setSelected(current => current.includes(e.id) ? current.filter(id => id !== e.id) : [...current, e.id])} /><span>{e.id} · {e.title}</span></label>)}</div><div className="button-row"><button className="secondary-button" onClick={() => { closeModal(); openReport(); }}>Продолжить расследование</button><button className="primary-button" onClick={() => setSignatureStep(true)}>Подписать решение <FileSignature size={16} /></button></div></>}</Modal>}
  </div>;
}
