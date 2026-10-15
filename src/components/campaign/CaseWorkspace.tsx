import { useEffect, useId, useState } from 'react';
import { ArrowRight, Archive, Check, ChevronRight, Clock3, FileCheck2, FileText, Gavel, MapPin, MessageSquare, Microscope, Moon, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { CaseAction, CaseDefinition, CaseEvidence, CaseId, CampaignDocument, CampaignState } from '../../campaign/types';
import { advanceCampaignDay, answerCourt, assessCampaignCase, getCampaignActionAvailability, getCase, getSubmittedEvidence, performCampaignAction, signCampaignDocument, submitCase, updateCampaignDraft } from '../../campaign/engine';
import SignaturePad from '../SignaturePad';
import Modal from './Modal';
import './case-workspace.css';

interface Props {
  state: CampaignState;
  onChange: (next: CampaignState) => void;
  onNotify: (message: string) => void;
  onOpenLegacy: () => void;
}

type Tab = 'scene' | 'evidence' | 'documents' | 'court';
const categoryNames = { scene: 'На месте', interview: 'Беседы', research: 'Запросы и экспертизы' };
const evidenceRoles = { event: 'Событие', link: 'Связь с лицом', context: 'Обстоятельства', motive: 'Мотив', background: 'Справочный материал' };

function SceneArt({ id }: { id: CaseId }) {
  const unique = useId().replace(/:/g, '');
  const sky = `case-sky-${unique}`;
  const light = `case-light-${unique}`;
  return (
    <svg className="case-scene-art" viewBox="0 0 1000 430" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#65716b" /><stop offset=".55" stopColor="#374a40" /><stop offset="1" stopColor="#152c27" /></linearGradient>
        <radialGradient id={light}><stop stopColor="#e5cea2" stopOpacity=".52" /><stop offset="1" stopColor="#b7b59a" stopOpacity="0" /></radialGradient>
        <pattern id={`rain-${unique}`} width="48" height="53" patternUnits="userSpaceOnUse"><path d="M8 2L3 15M36 28L31 42" stroke="#d8ded1" strokeOpacity=".08" /></pattern>
      </defs>
      <rect width="1000" height="430" fill={`url(#${sky})`} />
      {id === '002' ? <>
        <path d="M330 283V135L667 52 1000 141V335Z" fill="#293c34" stroke="#899182" strokeOpacity=".3" />
        <path d="M330 135L666 44 1000 136 989 151 667 70 339 151Z" fill="#192e27" />
        <path d="M463 139V324M635 97V344M815 120V362M982 160V368" stroke="#607267" strokeWidth="5" />
        <path d="M345 177L994 201M344 225L993 251M343 270L992 301" stroke="#728074" strokeOpacity=".2" />
        <path d="M699 180H900V357H699Z" fill="#172923" stroke="#66756b" strokeWidth="4" />
        <path d="M706 193H892M706 211H892M706 229H892M706 247H892M706 265H892M706 283H892M706 301H892M706 319H892" stroke="#728074" strokeOpacity=".35" />
        <rect x="510" y="161" width="91" height="63" fill="#899780" opacity=".5" /><path d="M555 161V224M510 193H601" stroke="#2c3e32" strokeWidth="5" />
        <path d="M0 360L1000 325V430H0Z" fill="#263c34" /><path d="M440 430L720 345M750 430L795 348" stroke="#9da18b" strokeOpacity=".2" strokeWidth="3" />
        <path d="M350 320H440V378H350ZM365 303H426V320H365Z" fill="#596550" stroke="#8e9378" strokeOpacity=".4" />
        <circle cx="681" cy="151" r="100" fill={`url(#${light})`} /><path d="M669 142H694L688 151H675Z" fill="#dfcc9d" />
        <path d="M190 355L990 377" stroke="#b8ac70" strokeWidth="10" /><path d="M230 352L240 363M290 354L300 365M350 356L360 367M410 358L420 369M470 360L480 371M530 362L540 373M590 364L600 375M650 366L660 377M710 368L720 379M770 370L780 381M830 372L840 383M890 374L900 385" stroke="#354334" strokeWidth="8" />
      </> : id === '004' ? <>
        <path d="M0 226L150 184 230 211 374 169 505 202 657 166 837 207 1000 176V430H0Z" fill="#30463d" />
        <path d="M0 281Q320 260 540 289T1000 272V430H0Z" fill="#20382f" />
        <path d="M0 316L1000 244V274L0 350Z" fill="#7a8170" /><path d="M0 301L1000 229M0 280L1000 208" stroke="#9aa08b" strokeWidth="4" />
        {[50, 160, 270, 380, 490, 600, 710, 820, 930].map(x => <path key={x} d={`M${x} ${280 - x * .072}V${314 - x * .072}`} stroke="#a2a18a" strokeWidth="3" />)}
        <path d="M260 328V430H300V326M695 292V422H729V289" fill="#536557" />
        <path d="M430 279V105M430 108Q450 93 477 103" fill="none" stroke="#798a78" strokeWidth="5" /><circle cx="476" cy="107" r="120" fill={`url(#${light})`} /><path d="M464 103H488L485 112H468Z" fill="#dbc99a" />
        <path d="M390 366L564 354M667 386L800 378M483 407L710 391M814 348L980 338" stroke="#829580" strokeOpacity=".18" strokeWidth="2" />
        <path d="M846 252L923 247 911 226 864 228Z" fill="#1b2f28" /><circle cx="866" cy="254" r="8" fill="#172a23" /><circle cx="910" cy="250" r="8" fill="#172a23" />
      </> : id === '005' ? <>
        <path d="M360 0H1000V430H360Z" fill="#29392f" /><path d="M350 0L555 90V430L350 430Z" fill="#465144" />
        {[0, 1, 2].map(column => <g key={column} transform={`translate(${570 + column * 145} 58)`}>
          <path d="M0 0H125V350H0Z" fill="#20352b" stroke="#737f68" strokeWidth="6" />
          {[0, 1, 2, 3].map(row => <g key={row} transform={`translate(8 ${14 + row * 83})`}>
            <path d="M0 65H107" stroke="#73816b" strokeWidth="5" />
            {[0, 1, 2, 3, 4].map(file => <g key={file} transform={`translate(${file * 21} ${file % 2 ? 9 : 2})`}><rect width="17" height={file % 2 ? 53 : 60} fill={file % 3 ? '#8c917b' : '#596e58'} /><rect x="4" y="15" width="8" height="20" fill="#ccceb3" opacity=".55" /></g>)}
          </g>)}
        </g>)}
        <path d="M357 0L561 86M354 430L561 407" stroke="#89947e" strokeOpacity=".4" /><circle cx="520" cy="65" r="150" fill={`url(#${light})`} />
        <path d="M476 0V53M448 57H506L495 70H459Z" fill="#d7c696" stroke="#859079" strokeWidth="3" />
        <path d="M0 405L427 332 651 430H0Z" fill="#354a3b" /><path d="M375 371L451 357 500 377 421 394Z" fill="#c3c1a1" /><path d="M391 373L453 363M400 379L463 369" stroke="#626e57" strokeWidth="2" />
      </> : <>
        <path d="M397 0H1000V343H397Z" fill="#3d4d3f" /><path d="M615 25H899V246H615Z" fill="#8a9580" stroke="#1f382d" strokeWidth="13" />
        <path d="M757 27V247M615 134H900" stroke="#2c4334" strokeWidth="9" /><path d="M624 224L655 160 688 193 718 117 748 200 778 154 810 186 853 115 890 176V235H624Z" fill="#526b58" />
        <path d="M0 389L625 277 1000 342V430H0Z" fill="#263b2e" /><path d="M428 361L657 323 770 365 535 412Z" fill="#c2bea0" />
        <path d="M469 360L631 333M483 368L671 338M504 376L691 347M526 386L683 361" stroke="#6f785f" strokeOpacity=".65" strokeWidth="2" />
        <path d="M801 313V189L742 146" fill="none" stroke="#72816a" strokeWidth="8" /><path d="M718 126L763 141 751 177 693 156Z" fill="#58715b" /><path d="M694 157L751 177 656 338 488 311Z" fill="#d4c998" opacity=".07" /><circle cx="720" cy="204" r="130" fill={`url(#${light})`} />
        <ellipse cx="804" cy="318" rx="43" ry="11" fill="#708064" /><path d="M867 297H923V329H867Z" fill="#d2c9a5" /><path d="M923 303Q945 299 942 315Q940 325 924 322" fill="none" stroke="#c6c09f" strokeWidth="5" />
      </>}
      <rect width="1000" height="430" fill={`url(#rain-${unique})`} />
    </svg>
  );
}

function EvidenceDetail({ evidence }: { evidence: CaseEvidence }) {
  return <article className="case-evidence-detail">
    <span className="eyebrow">{evidence.id} · {evidenceRoles[evidence.role]}</span>
    <p className="case-evidence-body">{evidence.body}</p>
    <div className="case-source-note"><FileText size={18} /><div><strong>Источник</strong><p>{evidence.source}</p></div></div>
    <div className="case-evidence-limitation"><ShieldCheck size={18} /><div><strong>Границы вывода</strong><p>{evidence.limitation}</p></div></div>
  </article>;
}

export default function CaseWorkspace({ state, onChange, onNotify, onOpenLegacy }: Props) {
  const caseId = state.activeCase;
  const definition = getCase(caseId);
  const progress = state.cases[caseId];
  const documents: CampaignDocument[] = caseId === '001' ? [...state.firstCase.documents.map(document => ({ ...document, id: `legacy-${document.id}`, caseId, kind: document.kind === 'decision' ? 'decision' as const : 'protocol' as const, mode: document.signatureMode })), ...progress.documents] : progress.documents;
  const [tab, setTab] = useState<Tab>(progress.result ? 'court' : 'scene');
  const [action, setAction] = useState<CaseAction | null>(null);
  const [reading, setReading] = useState<CaseEvidence | null>(null);
  const [result, setResult] = useState<{ title: string; text: string } | null>(null);
  const [signatureFor, setSignatureFor] = useState<'protocol' | 'decision' | null>(null);
  const [suspect, setSuspect] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const acquired = definition.evidence.filter(item => progress.evidence.includes(item.id));
  const editable = !progress.result && progress.status !== 'locked';
  const sceneInspected = definition.actions.some(item => item.category === 'scene' && progress.completedActions.includes(item.id));
  const assessment = assessCampaignCase(state, caseId);
  const clock = `${String(9 + Math.floor(progress.spent / 2)).padStart(2, '0')}:${progress.spent % 2 ? '30' : '00'}`;

  useEffect(() => {
    setTab(progress.result ? 'court' : 'scene');
    setAction(null); setReading(null); setResult(null); setSignatureFor(null); setSuspect(''); setSelected([]);
  }, [caseId]);

  function commit(change: () => CampaignState, success?: string) {
    try { onChange(change()); if (success) onNotify(success); return true; }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Действие не удалось выполнить.'); return false; }
  }

  function describeAction(item: CaseAction) {
    return item.delay ? item.description.replace(/\s*Ответ через\s+\d+\s+(?:день|дня|дней)\.?/g, '').trim() : item.description;
  }

  function responseTiming(item: CaseAction) {
    const delay = Math.max(0, (item.delay ?? 0) - (state.upgrades.includes('computer') ? 1 : 0));
    return delay ? `Ответ через ${delay} дн.` : 'Ответ в текущий день · рабочая станция';
  }

  function perform(chosen?: string) {
    if (!action) return;
    const active = action;
    try {
      const next = performCampaignAction(state, caseId, active.id, chosen);
      onChange(next);
      setAction(null);
      const choiceText = active.choices?.find(choice => choice.id === chosen)?.response;
      const due = next.cases[caseId].pending.find(request => request.actionId === active.id);
      const resultText = active.delay && !due ? 'Ответ получен и добавлен в материалы дела. Изучите первоисточник перед тем, как делать выводы.' : active.result;
      setResult({ title: active.title, text: `${resultText}${choiceText ? `\n\n${choiceText}` : ''}${due ? `\n\nОтвет ожидается на ${due.dueDay}-й день расследования. Запрос добавлен в контроль сроков.` : ''}` });
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Действие не удалось выполнить.'); }
  }

  function openSource(source: string) {
    const referenced = [...source.matchAll(/\bE(\d+)\b/g)].map(match => caseId === '001' ? `E${match[1].padStart(2, '0')}` : `${caseId}-E${Number(match[1])}`);
    const item = acquired.find(evidence => referenced.includes(evidence.id) || evidence.id === source || evidence.title === source);
    if (item) setReading(item);
    else if (source.includes('Поручение')) setReading({ id: `ПОРУЧЕНИЕ № ${caseId}`, title: 'Поручение о проверке', body: definition.briefing, source: 'Входящие материалы районного следственного отдела', limitation: 'Вводные сведения определяют направления проверки. Обвинение требует независимых подтверждений.', role: 'background' });
    else onNotify('Этот источник ещё не получен. Проведите соответствующее действие в плане расследования.');
  }

  function hasFieldSource(source: string) {
    return source.includes('Поручение') || acquired.some(item => item.id === source || item.title === source) || [...source.matchAll(/\bE(\d+)\b/g)].some(match => progress.evidence.includes(caseId === '001' ? `E${match[1].padStart(2, '0')}` : `${caseId}-E${Number(match[1])}`));
  }

  function confirmSignature(signature: string, mode: 'drawn' | 'typed') {
    const isDecision = signatureFor === 'decision';
    if (commit(() => isDecision ? submitCase(state, caseId, suspect, selected, signature, mode) : signCampaignDocument(state, caseId, signature, mode), isDecision ? 'Постановление подписано. Дело передано на рассмотрение.' : 'Подписанная версия сохранена в архиве.')) {
      setSignatureFor(null);
      if (isDecision) setTab('court');
    }
  }

  if (progress.status === 'locked') return <section className="panel case-locked"><Archive size={32} /><h2>Дело пока не передано в производство</h2><p>Завершите судебное рассмотрение предыдущего дела, чтобы получить следующие материалы.</p></section>;

  if (caseId === '001' && !progress.result) return <section className="case-workbench">
    <div className="case-location-hero case-legacy-hero"><SceneArt id="001" /><div className="case-scene-shade" /><div className="case-location-copy"><span className="eyebrow">Первое расследование · дело № 001</span><h2>{definition.title}</h2><p>{definition.summary}</p><button className="case-hero-cta" onClick={onOpenLegacy}>Продолжить первое дело <ArrowRight size={17} /></button></div></div>
    <div className="panel case-legacy-note"><FileText size={22} /><div><h3>Ваши материалы уже на столе</h3><p>Осмотр кабинета, показания сотрудников, сверка документов и итоговое постановление — в рабочем столе первого расследования. После решения откроется судебное заседание и следующий эпизод кампании.</p></div></div>
  </section>;

  return <section className="case-workbench">
    <div className="case-workbench-heading"><div><span className="eyebrow">{definition.chapterLabel} · Производство № {caseId} / 2026</span></div><span className={`badge case-status-${progress.status}`}>{progress.status === 'resolved' ? 'Дело рассмотрено' : progress.status === 'court' ? 'В суде' : 'В производстве'}</span></div>
    <nav className="case-tabs" aria-label="Разделы расследования">
      {([['scene', Search, 'Расследование'], ['evidence', Archive, 'Материалы'], ['documents', FileText, 'Документы'], ['court', Gavel, 'Решение и суд']] as const).map(([key, Icon, label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}><Icon size={17} /><span>{label}</span>{key === 'evidence' && <small>{acquired.length}</small>}{key === 'court' && progress.status === 'court' && <i className="case-tab-dot" />}</button>)}
    </nav>
    <div className="case-workbench-grid">
      <div className="case-workbench-main">
        {tab === 'scene' && <>
          <div className="case-location-hero"><SceneArt id={caseId} /><div className="case-scene-shade" /><div className="case-location-copy"><span className="eyebrow"><MapPin size={12} /> {definition.location}</span><h2>Каждая деталь<br />имеет значение.</h2><p>{definition.summary}</p></div><span className="case-scene-index">МАТЕРИАЛЫ {caseId} / ЗАРЕЧЕНСК</span></div>
          <article className="panel case-briefing"><div className="case-section-title"><FileText size={18} /><h2>Вводная по делу</h2><span>01 / ПОРУЧЕНИЕ</span></div><p>{definition.briefing}</p></article>
          <section className="case-action-plan"><div className="case-section-title"><h2>План расследования</h2><span>{progress.completedActions.length} / {definition.actions.length}</span></div><p className="case-section-intro">Выберите следующее действие. Показания и результаты экспертиз появятся в материалах.</p>
            {(['scene', 'interview', 'research'] as const).map(category => {
              const actions = definition.actions.filter(item => item.category === category);
              if (!actions.length) return null;
              const Icon = category === 'scene' ? Search : category === 'interview' ? MessageSquare : Microscope;
              return <div key={category} className="case-action-group"><h3><Icon size={15} />{categoryNames[category]}</h3>{actions.map(item => {
                const availability = getCampaignActionAvailability(state, caseId, item.id);
                const request = progress.pending.find(pending => pending.actionId === item.id);
                return <button key={item.id} type="button" className={`case-action-row ${availability.completed ? 'is-complete' : ''}`} disabled={!availability.allowed} onClick={() => setAction(item)}>
                  <span className="case-action-check">{availability.completed ? <Check size={15} /> : <Icon size={16} />}</span><span className="case-action-text"><strong>{item.title}</strong><span>{request ? `Запрос в работе · ответ в день ${request.dueDay}` : availability.completed ? item.delay ? 'Ответ получен. Материал доступен в описи.' : item.result : describeAction(item)}</span>{!availability.completed && availability.reason && <small>{availability.reason}</small>}{!availability.completed && Boolean(item.delay) && <small>{responseTiming(item)}</small>}</span><span className="case-action-cost">{availability.completed ? request ? <Clock3 size={16} /> : <Check size={16} /> : <>{availability.cost * 30} мин.<ChevronRight size={15} /></>}</span>
                </button>;
              })}</div>;
            })}
          </section>
          <section className="case-journal"><div className="case-section-title"><h2>Журнал расследования</h2><span>ПОСЛЕДНИЕ ЗАПИСИ</span></div>{state.journal.filter(entry => entry.caseId === caseId).slice(-6).reverse().map(entry => <article key={entry.id}><span>День {entry.day}</span><p>{entry.text}</p></article>)}{!state.journal.some(entry => entry.caseId === caseId) && <p className="case-section-intro">Здесь сохраняются ваши действия, ответы собеседников и поступившие результаты.</p>}</section>
        </>}

        {tab === 'evidence' && <section className="case-materials"><div className="case-section-title"><h2>Опись материалов</h2><span>{acquired.length} ПОЛУЧЕНО</span></div><p className="case-section-intro">Читайте первоисточники, сопоставляйте детали и проверяйте границы выводов. Изучение материалов не расходует время.</p>{acquired.length ? <div className="case-evidence-grid">{acquired.map((item, index) => <button key={item.id} type="button" className="case-evidence-card" onClick={() => setReading(item)}><div className="case-evidence-top"><FileText size={22} /><span>{String(index + 1).padStart(2, '0')}</span></div><small>{evidenceRoles[item.role]}</small><h3>{item.title}</h3><p>{item.source}</p><span className="case-evidence-read">Открыть материал <ArrowRight size={15} /></span></button>)}</div> : <div className="panel case-empty"><Archive size={34} /><h3>Папка ещё пуста</h3><p>Начните с осмотра или беседы в плане расследования.</p><button className="secondary-button" onClick={() => setTab('scene')}>Перейти к действиям <ArrowRight size={15} /></button></div>}{progress.pending.length > 0 && <div className="case-incoming-note"><Clock3 size={19} /><p>Ожидается {progress.pending.length} ответов. Их сроки указаны в рабочем дне справа.</p></div>}</section>}

        {tab === 'documents' && <section className="case-document-workspace"><div className="case-section-title"><h2>Процессуальные документы</h2><span>{documents.length} В АРХИВЕ</span></div>{caseId !== '001' && <><p className="case-section-intro">В черновике могут быть неточности. Сверьте каждое поле с источником и внесите исправления до подписи. Каждая подпись сохраняет отдельную версию.</p><article className="paper case-form"><div className="case-form-letterhead"><span>СЛЕДСТВЕННЫЙ ОТДЕЛ<br />ПО ГОРОДУ ЗАРЕЧЕНСКУ</span><span>Дело № {caseId}<br />День {progress.day}</span></div><h3>{definition.formTitle}</h3><p className="case-form-caption">Материалы расследования «{definition.title}»</p>{definition.formFields.map(field => <div key={field.id} className="case-form-field"><label className="field" htmlFor={`case-field-${caseId}-${field.id}`}><span>{field.label}</span><input id={`case-field-${caseId}-${field.id}`} value={progress.draft[field.id] ?? field.initial} disabled={!editable} maxLength={500} onChange={event => commit(() => updateCampaignDraft(state, caseId, field.id, event.target.value))} /></label><button type="button" className="case-source-button" disabled={!hasFieldSource(field.source)} onClick={() => openSource(field.source)}><Search size={13} />{hasFieldSource(field.source) ? 'Сверить с источником' : 'Источник ещё не получен'}</button>{state.upgrades.includes('lamp') && hasFieldSource(field.source) && <p className="case-lamp-hint"><Sparkles size={12} />{field.source}</p>}</div>)}<div className="case-form-signature-line"><span>Следователь</span><span>{state.profileName}</span><span>_________________</span></div><div className="case-form-footer"><span><Clock3 size={14} />Оформление: 30 мин.</span><button type="button" className="primary-button" disabled={!editable || !sceneInspected || progress.spent >= 15} onClick={() => setSignatureFor('protocol')}><FileCheck2 size={16} />{progress.documents.some(doc => doc.kind === 'protocol') ? 'Подписать дополнение' : 'Подписать протокол'}</button></div>{editable && !sceneInspected && <p className="case-under-button">Для оформления протокола сначала проведите осмотр.</p>}{editable && progress.spent >= 15 && <p className="case-under-button">Время на оформление закончилось. Продолжите в следующий рабочий день.</p>}</article></>}
          <div className="case-document-archive"><h3><Archive size={18} /> Архив подписанных версий</h3>{documents.length ? documents.map((document, index) => <details key={document.id} className="case-archive-entry"><summary><FileCheck2 size={17} /><span><strong>{document.title}</strong><small>День {document.day} · версия {index + 1}</small></span><ChevronRight size={15} /></summary><div className="case-archive-content"><pre>{document.text}</pre>{document.mode === 'drawn' ? <img className="case-saved-signature" src={document.signature} alt="Подпись следователя" /> : <p className="case-typed-signature">{document.signature}</p>}{document.issues.length > 0 && <ul className="case-issues">{document.issues.map((issue, issueIndex) => <li key={issueIndex}>{issue}</li>)}</ul>}<span className="eyebrow">Сохранённая версия · только для чтения</span></div></details>) : <p className="case-section-intro">Подпишите протокол, чтобы сохранить первую версию в деле.</p>}</div>
        </section>}

        {tab === 'court' && <section className="case-court-workspace">
          {!progress.result ? <><div className="case-section-title"><h2>Итоговое постановление</h2><Gavel size={19} /></div><p className="case-section-intro">Вы определяете, какие выводы подтверждают материалы. Неполное расследование тоже можно передать в суд — оно повлияет на рассмотрение и вашу репутацию.</p><div className="paper case-decision-form"><span className="eyebrow">Дело № {caseId} · Решение следователя</span><h3>Кому предъявить обвинение?</h3><div className="case-suspects">{definition.suspects.map(person => <label key={person.id} className={suspect === person.id ? 'selected' : ''}><input type="radio" name={`suspect-${caseId}`} value={person.id} checked={suspect === person.id} onChange={() => setSuspect(person.id)} /><span><strong>{person.name}</strong><small>{person.role}</small></span></label>)}<label className={suspect === 'close' ? 'selected' : ''}><input type="radio" name={`suspect-${caseId}`} value="close" checked={suspect === 'close'} onChange={() => setSuspect('close')} /><span><strong>Прекратить производство</strong><small>Достаточных оснований для обвинения не установлено</small></span></label></div><h4>Приложить материалы</h4><p className="case-section-intro">Выберите доказательства, на которых основано решение.</p><div className="case-evidence-selection">{acquired.map(item => <div key={item.id}><label><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(value => value !== item.id))} /><span>{item.title}</span></label><button type="button" aria-label={`Прочитать: ${item.title}`} onClick={() => setReading(item)}><Search size={15} /></button></div>)}</div>{!acquired.length && <p className="case-section-intro">В деле пока нет полученных материалов.</p>}<div className="case-decision-note"><ShieldCheck size={17} /><p>Подписанное решение завершает сбор доказательств. Суд проверит документы, доказательства и ваши ответы на возражения.</p></div><button className="primary-button full-width" disabled={!suspect || progress.day < 2} onClick={() => setSignatureFor('decision')}><Gavel size={16} />Подписать и передать в суд</button>{progress.day < 2 && <p className="case-under-button">Постановление доступно со второго дня расследования.</p>}</div></> : <>
            <div className="panel case-submitted"><div className="case-submitted-icon"><FileCheck2 size={22} /></div><div><span className="eyebrow">Следствие завершено</span><h3>{progress.result.title}</h3><p>{progress.result.text}</p>{progress.result.issues.length > 0 && <details><summary>Замечания к расследованию · {progress.result.issues.length}</summary><ul className="case-issues">{progress.result.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}</div></div>
            {!progress.courtResult ? <CourtSession definition={definition} state={state} onAnswer={optionId => commit(() => answerCourt(state, caseId, optionId))} onRead={setReading} /> : <article className={`case-verdict case-verdict-${progress.courtResult.kind}`}><span className="case-verdict-seal"><Gavel size={31} /></span><span className="eyebrow">Судебное рассмотрение завершено</span><h2>{progress.courtResult.title}</h2><p>{progress.courtResult.text}</p><div className="case-verdict-link"><span className="eyebrow">Нить расследования</span><p>{definition.link}</p></div><div className="case-verdict-rewards"><div><span>Зарплата</span><strong>+{definition.reward.money.toLocaleString('ru-RU')} ₽</strong></div><div><span>Бюджет отдела</span><strong>+{definition.reward.budget.toLocaleString('ru-RU')} ₽</strong></div></div><div className="case-verdict-footer"><Check size={17} /><span>Результат и вознаграждение учтены в карьере. {caseId === '005' ? 'Первая глава завершена.' : 'Следующее дело доступно в кампании.'}</span></div></article>}
            {progress.courtAnswers.length > 0 && <section className="case-court-transcript"><h3><Archive size={17} /> Протокол заседания</h3>{progress.courtAnswers.map((answer, index) => { const round = definition.court.find(item => item.id === answer.roundId); const option = round?.options.find(item => item.id === answer.optionId); return <article key={answer.roundId}><span className="eyebrow">Раунд {index + 1} · {round?.speaker}</span><h4>{round?.question}</h4><p className="case-court-your-answer">Ваш ответ: {option?.label}</p><p>{answer.response}</p></article>; })}</section>}
          </>}
        </section>}
      </div>
      <aside className="case-workbench-aside">
        <section className="panel case-time-panel"><div className="case-section-title"><h2>{progress.result ? 'Материалы дела' : `Рабочий день ${progress.day}`}</h2><Clock3 size={17} /></div><div className="case-clock">{clock}<span>/ 17:00</span></div><div className="case-time-blocks" aria-label={`Использовано ${progress.spent * 30} минут рабочего дня`}>{Array.from({ length: 16 }, (_, index) => <i key={index} className={index === 15 ? 'reserved' : index < progress.spent ? 'spent' : ''} />)}</div><div className="case-time-labels"><span>09:00</span><span>30 мин. на итог дня</span></div><div className="case-time-facts"><div><span>Материалы</span><strong>{acquired.length}</strong></div><div><span>Подписано версий</span><strong>{documents.length}</strong></div></div>{editable && <><button type="button" className="primary-button full-width" onClick={() => commit(() => advanceCampaignDay(state, caseId), 'Рабочий день завершён. Проверьте поступившие ответы.')}><Moon size={16} />Завершить день<ArrowRight size={16} /></button><p className="case-under-button">Итог дня · 30 минут<br />Незавершённые действия остаются в плане.</p></>}{progress.result && <button className="secondary-button full-width" onClick={() => setTab('court')}><Gavel size={16} />{progress.courtResult ? 'Итог рассмотрения' : 'Перейти в суд'}</button>}</section>
        {progress.pending.length > 0 && <section className="panel case-pending-panel"><div className="case-section-title"><h2>Контроль сроков</h2><Clock3 size={16} /></div>{progress.pending.map(request => <div key={request.actionId}><p>{definition.actions.find(item => item.id === request.actionId)?.title ?? 'Ответ на запрос'}</p><span>День {request.dueDay}</span></div>)}</section>}
        <section className="case-readiness"><span className="eyebrow">Полнота материалов</span>{([['event', 'Событие установлено'], ['link', 'Связь с лицом'], ['context', 'Обстоятельства проверены'], ['documents', 'Документы оформлены']] as const).map(([key, label]) => <div key={key}><span className={assessment[key] ? 'ready' : ''}>{assessment[key] ? <Check size={12} /> : '·'}</span>{label}</div>)}<p>Эти отметки помогают проверить комплектность. Окончательные выводы делаете вы.</p></section>
        <blockquote className="case-aside-quote">«Сначала установи, что произошло. Потом — кто за это отвечает».<cite>Из записей наставника</cite></blockquote>
      </aside>
    </div>

    {action && <Modal title={action.title} onClose={() => setAction(null)}><p className="case-modal-copy">{describeAction(action)}</p><div className="case-modal-cost"><Clock3 size={17} /><span>Действие займёт {getCampaignActionAvailability(state, caseId, action.id).cost * 30} минут</span>{Boolean(action.delay) && <span>{responseTiming(action)}</span>}</div>{action.choices?.length ? <div className="case-choice-list"><p>Как вы поступите?</p>{action.choices.map(choice => <button type="button" key={choice.id} onClick={() => perform(choice.id)}><span>{choice.label}</span><ArrowRight size={17} /></button>)}</div> : <div className="button-row"><button className="secondary-button" onClick={() => setAction(null)}>Вернуться к плану</button><button className="primary-button" onClick={() => perform()}>Выполнить действие <ArrowRight size={15} /></button></div>}</Modal>}
    {reading && <Modal title={reading.title} onClose={() => setReading(null)} wide><EvidenceDetail evidence={reading} /></Modal>}
    {result && <Modal title={result.title} onClose={() => setResult(null)} wide><div className="case-action-result"><Sparkles size={23} /><p>{result.text}</p></div><div className="button-row"><button className="secondary-button" onClick={() => { setResult(null); setTab('evidence'); }}>Открыть материалы</button><button className="primary-button" onClick={() => setResult(null)}>Продолжить расследование <ArrowRight size={15} /></button></div></Modal>}
    {signatureFor && <Modal title={signatureFor === 'decision' ? 'Подписание постановления' : 'Подписание документа'} onClose={() => setSignatureFor(null)} wide><SignaturePad initialName={state.profileName} title={signatureFor === 'decision' ? 'Итоговое решение по делу' : definition.formTitle} onCancel={() => setSignatureFor(null)} onConfirm={confirmSignature} /></Modal>}
  </section>;
}

function CourtSession({ definition, state, onAnswer, onRead }: { definition: CaseDefinition; state: CampaignState; onAnswer: (id: string) => void; onRead: (item: CaseEvidence) => void }) {
  const progress = state.cases[definition.id];
  const round = definition.court[progress.courtAnswers.length];
  if (!round) return null;
  const available = definition.evidence.filter(item => progress.evidence.includes(item.id));
  const submitted = getSubmittedEvidence(state, definition.id);
  return <section className="case-court-session"><div className="case-court-head"><span className="eyebrow"><Gavel size={14} /> Зал судебного заседания</span><span>Раунд {progress.courtAnswers.length + 1} / {definition.court.length}</span></div><div className="case-court-progress">{definition.court.map((item, index) => <i key={item.id} className={index < progress.courtAnswers.length ? 'answered' : index === progress.courtAnswers.length ? 'current' : ''} />)}</div><div className="case-court-question" aria-live="polite"><span>{round.speaker}</span><h2>{round.question}</h2></div><div className="case-court-options">{round.options.map((option, index) => { const missing = option.requiresEvidence?.filter(id => !submitted.includes(id)) ?? []; return <button type="button" key={option.id} disabled={missing.length > 0} onClick={() => onAnswer(option.id)}><span className="case-answer-letter">{String.fromCharCode(1040 + index)}</span><span>{option.label}{missing.length > 0 && <small>Необходимый материал не включён в подписанный пакет</small>}</span><ArrowRight size={17} /></button>; })}</div>{available.length > 0 && <details className="case-court-references"><summary><Archive size={15} /> Свериться с материалами дела <ChevronRight size={15} /></summary><div>{available.map(item => <button type="button" key={item.id} onClick={() => onRead(item)}><FileText size={14} />{item.title}<ChevronRight size={14} /></button>)}</div></details>}<p className="case-court-rule">Ответ записывается в протокол сразу. Изучение приложений не ограничено по времени.</p></section>;
}
