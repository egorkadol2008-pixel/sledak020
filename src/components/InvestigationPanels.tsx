import { useState } from 'react';
import { ArrowDownUp, ArrowRight, Camera, Check, CheckCheck, Clock3, FileText, Fingerprint, FolderOpen, Info, LockKeyhole, MapPin, MessageSquare, Minus, Plus, ScanSearch, ShieldCheck, Users, X } from 'lucide-react';
import { ACTIONS, EVIDENCE } from '../game/content';
import { getAvailability } from '../game/engine';
import type { EvidenceId, GameState } from '../game/types';
import './investigation.css';

type PanelProps = { state: GameState; onAction: (id: string) => void };

function ActionControl({ state, onAction, id, compact = false }: PanelProps & { id: string; compact?: boolean }) {
  const action = ACTIONS.find((item) => item.id === id);
  if (!action) return null;
  const availability = getAvailability(state, id);
  const description = id === 'question-orlov' && state.evidence.E04?.stage !== 2 && state.evidence.E05?.stage !== 2
    ? 'Сопоставить объяснение с независимыми источниками.'
    : id === 'interview-volkova' && !state.evidence.E06
      ? 'Выслушать рассказ о последнем визите и запросить переписку.' : action.description;
  return (
    <div className={`investigation-action ${compact ? 'is-compact' : ''}`}>
      {!compact && <div className="investigation-action-copy"><strong>{action.title}</strong><p>{description}</p></div>}
      <button className={compact ? 'primary-button' : 'secondary-button'} aria-label={`${action.title}${availability.completed ? ' — выполнено' : ` — ${action.cost * 30} минут`}`} disabled={!availability.allowed} onClick={() => onAction(id)}>
        {availability.completed ? <Check size={15} /> : compact ? <ScanSearch size={16} /> : <ArrowRight size={15} />}
        <span>{availability.completed ? 'Выполнено' : compact ? action.title : 'Выполнить'}</span>
        {!availability.completed && <span className="action-duration"><Clock3 size={12} /> {action.cost * 30} мин</span>}
      </button>
      {availability.reason && !availability.completed && <small className="action-reason">{availability.reason}</small>}
    </div>
  );
}

function OfficeIllustration() {
  return (
    <svg className="office-illustration" viewBox="0 0 900 460" role="img" aria-label="Кабинет Коренева: письменный стол с запиской, шкаф с пустым местом для папки, окно и разбросанные документы">
      <defs>
        <linearGradient id="officeWall" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#353d39" /><stop offset="1" stopColor="#202b28" /></linearGradient>
        <linearGradient id="officeFloor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3c4138" /><stop offset="1" stopColor="#232c26" /></linearGradient>
        <linearGradient id="officeWindow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c8ccba" /><stop offset="1" stopColor="#7f9383" /></linearGradient>
        <linearGradient id="deskLight" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dab878" stopOpacity=".35" /><stop offset="1" stopColor="#dab878" stopOpacity="0" /></linearGradient>
        <pattern id="officeGrain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".55" fill="#d9d7b4" opacity=".12" /><circle cx="6" cy="7" r=".5" fill="#000" opacity=".1" /></pattern>
      </defs>
      <rect width="900" height="460" fill="url(#officeWall)" />
      <path d="M0 305 900 285V460H0Z" fill="url(#officeFloor)" />
      <path d="M0 305 900 285M115 460 395 296M430 460 520 293M750 460 655 291" stroke="#717463" strokeOpacity=".25" />
      <rect x="70" y="41" width="251" height="218" rx="1" fill="#152521" />
      <rect x="78" y="49" width="235" height="202" fill="url(#officeWindow)" />
      <path d="M78 177V153H105V112H135V165H153V132H184V180H199V121H229V152H247V103H278V175H313V251H78Z" fill="#4c6258" opacity=".6" />
      <path d="M78 88H313M78 119H313M78 150H313M78 181H313M78 212H313" stroke="#2b3d34" strokeWidth="5" opacity=".65" />
      <path d="M196 49V251M78 243H313" stroke="#1e3129" strokeWidth="7" />
      <path d="M85 259 326 259 584 460H0Z" fill="#b4b792" opacity=".06" />
      <rect x="365" y="65" width="89" height="112" fill="#263129" stroke="#827c61" strokeWidth="4" />
      <rect x="375" y="75" width="69" height="92" fill="#b9b49a" />
      <path d="M380 143 396 118 408 133 422 104 439 143Z" fill="#5a7160" />
      <circle cx="392" cy="94" r="7" fill="#9c9169" />
      <rect x="645" y="52" width="193" height="253" fill="#151f1b" stroke="#6d705b" strokeWidth="3" />
      <path d="M656 63H826V294H656Z" fill="#333c31" /><path d="M652 131H832M652 213H832" stroke="#7e7c61" strokeWidth="5" />
      <g fill="#777e65"><path d="M664 79H681V128H664Z" /><path d="M686 76H704V128H686Z" /><path d="M708 81H724V128H708Z" /><path d="M751 74H769V128H751Z" /><path d="M774 77H794V128H774Z" /><path d="M799 72H816V128H799Z" /></g>
      <g fill="#929275"><path d="M663 151H682V210H663Z" /><path d="M687 148H709V210H687Z" /><path d="M764 153H785V210H764Z" /><path d="M789 151H813V210H789Z" /></g>
      <path d="M717 158H753V207H717Z" stroke="#c2b98a" strokeDasharray="4 4" fill="#202a24" />
      <text x="735" y="188" textAnchor="middle" fill="#9c9a79" fontSize="14" fontFamily="monospace">17</text>
      <rect x="668" y="233" width="142" height="48" fill="#525e4a" /><path d="M680 242H797M680 248H797M680 254H797" stroke="#79816a" />
      <ellipse cx="474" cy="405" rx="253" ry="29" fill="#141f1b" opacity=".5" />
      <g transform="rotate(-28 503 283)"><path d="M471 225Q475 180 506 178H548Q575 182 568 234L557 315H476Z" fill="#1b2722" stroke="#687361" strokeWidth="2" /><path d="M480 194H554M478 207H556M476 220H556" stroke="#3c4b3e" /></g>
      <path d="M273 308 661 285 709 347 280 378Z" fill="#8e8463" />
      <path d="M280 378 709 347V362L280 394Z" fill="#4f5542" /><path d="M292 392V446L310 445V390M663 366V420L680 418V364" fill="#555945" />
      <path d="M352 318 418 314 438 345 367 352Z" fill="#ded5b8" />
      <path d="M366 326 411 324M372 333 419 330M377 340 415 337" stroke="#7c816b" strokeWidth="2" />
      <path d="M444 310 506 306 522 327 454 334Z" fill="#343d31" />
      <ellipse cx="329" cy="330" rx="12" ry="4" fill="#444c39" /><path d="M320 315H338L336 330Q328 334 322 330Z" fill="#a2a28b" /><ellipse cx="329" cy="315" rx="9" ry="3" fill="#dad4b5" /><path d="M337 318Q348 317 345 324Q343 328 337 326" fill="none" stroke="#a2a28b" strokeWidth="2" />
      <ellipse cx="644" cy="316" rx="11" ry="4" fill="#444c39" /><path d="M636 302H652L651 315Q644 319 638 315Z" fill="#9b9f86" /><ellipse cx="644" cy="302" rx="8" ry="3" fill="#d4cfb0" />
      <path d="M508 278 581 275 590 311 513 315Z" fill="#111e19" stroke="#77816b" strokeWidth="2" /><path d="M520 287 574 284 578 302 524 305Z" fill="#455a48" />
      <path d="M515 315 591 311 612 323 527 330Z" fill="#7e826b" /><path d="M530 319 587 316" stroke="#354c3c" strokeWidth="3" />
      <path d="M608 321 613 245 585 217" fill="none" stroke="#b6aa7b" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="608" cy="325" rx="20" ry="5" fill="#a29c72" /><path d="M558 210Q582 191 599 211L611 227 550 230Z" fill="#8e9b73" stroke="#bac09a" strokeWidth="1.5" />
      <path d="M550 230 611 227 671 345 452 357Z" fill="url(#deskLight)" />
      <path d="M559 231 600 229" stroke="#e0cd91" strokeWidth="3" />
      <path d="M732 360 779 348 801 374 751 389Z" fill="#d8d0b3" opacity=".9" /><path d="M721 380 764 369 785 391 740 406Z" fill="#bdb99e" /><path d="M746 361 776 355M751 366 782 360M733 384 762 376" stroke="#777d67" strokeWidth="2" />
      <rect x="106" y="299" width="44" height="83" fill="#27382c" /><path d="M126 300Q82 257 88 221Q122 234 126 277Q132 225 157 203Q170 244 136 294Q165 259 187 261Q181 291 142 306" fill="#5b6b4b" />
      <path d="M126 306V239M132 306 159 229" stroke="#89906b" strokeWidth="2" opacity=".6" />
      <rect width="900" height="460" fill="url(#officeGrain)" />
      <path d="M22 41V22H41M859 22H878V41M22 419V438H41M859 438H878V419" stroke="#c9c8ad" strokeWidth="1" opacity=".6" fill="none" />
      <text x="35" y="426" fill="#bcc2ae" opacity=".65" fontSize="10" letterSpacing="3" fontFamily="monospace">МЕСТО ПРОИСШЕСТВИЯ / 01</text>
    </svg>
  );
}

const HOTSPOTS = [
  { id: 'note', number: '01', x: 44, y: 69, title: 'Напечатанная записка', icon: FileText, text: 'На столе обнаружен напечатанный лист. Почерка нет. Текст сам по себе не устанавливает, кто его составил; историю печати нужно запросить отдельно.', source: 'Зафиксировано в E03 · Записка и история печати' },
  { id: 'folder', number: '02', x: 81.7, y: 39, title: 'Место папки № 17', icon: FolderOpen, text: 'Между папками в шкафу — пустое место с номером 17. Что хранилось в папке и когда она исчезла, пока неизвестно. Это вопрос для проверки, а не готовый мотив.', source: 'Зафиксировано в E01 · Осмотр кабинета' },
  { id: 'photos', number: '03', x: 84, y: 81, title: 'Нарушенный порядок', icon: Camera, text: 'Документы лежат на полу. Обстановка снята на четыре фотографии. Фото № 4 доступно в материалах осмотра — проверьте, что оно приложено к протоколу.', source: 'E01 · Схема кабинета и 4 фотографии' },
  { id: 'desk', number: '04', x: 61, y: 60, title: 'Общий компьютер', icon: ScanSearch, text: 'Рабочий компьютер доступен нескольким сотрудникам. Данные о печати могут уточнить время появления записки, но не позволят автоматически установить её автора.', source: 'План проверки · Запросить историю печати' },
] as const;

export function ScenePanel({ state, onAction }: PanelProps) {
  const [activeSpot, setActiveSpot] = useState<string | null>(null);
  const inspected = state.completedActions.includes('inspect');
  const spot = HOTSPOTS.find((item) => item.id === activeSpot);
  return (
    <section className="investigation-section scene-section">
      <div className="section-heading"><div><p className="eyebrow">ВЫЕЗД НА МЕСТО</p><h2>Кабинет Коренева</h2></div><span className="scene-location"><MapPin size={14} /> Офис строительной фирмы</span></div>
      <div className="scene-layout">
        <div className="scene-visual-wrap"><div className="scene-visual"><OfficeIllustration />
          <div className="scene-status"><span className={`status-dot ${inspected ? 'is-complete' : ''}`} />{inspected ? 'Осмотр проведён' : 'Осмотр ещё не проведён'}</div>
          {inspected && HOTSPOTS.map((item) => <button key={item.id} className={`scene-hotspot ${activeSpot === item.id ? 'is-selected' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-label={`Осмотреть: ${item.title}`} aria-pressed={activeSpot === item.id} onClick={() => setActiveSpot(item.id)}><span>{item.number}</span><Plus size={13} /></button>)}
        </div><div className="scene-caption"><Camera size={14} /><span>{inspected ? 'Нажмите на метки, чтобы изучить детали. Повторный просмотр не расходует время.' : 'Обстановка до осмотра. Сначала зафиксируйте материалы.'}</span><span className="scene-caption-index">01 / 01</span></div></div>
        <aside className="scene-side paper"><p className="eyebrow">{spot && inspected ? `ТОЧКА ${spot.number}` : 'ПЕРВИЧНОЕ СООБЩЕНИЕ'}</p>
          {spot && inspected ? <><spot.icon className="scene-detail-icon" size={28} strokeWidth={1.5} /><h3>{spot.title}</h3><p>{spot.text}</p><div className="source-note"><Fingerprint size={15} /><span>{spot.source}</span></div><button className="text-button" onClick={() => setActiveSpot(null)}><X size={14} /> Закрыть деталь</button></> : <><h3>В комнате остались вопросы.</h3><p>Павел Андреевич Коренев найден в своём кабинете. Рядом — записка. В шкафу не хватает папки, на полу разбросаны бумаги.</p><p className="muted">Зафиксируйте обстановку прежде, чем выбирать версию.</p>{inspected ? <div className="scene-complete"><CheckCheck size={20} /><div><strong>Материалы получены</strong><span>E01 и E03 добавлены в дело. Четыре точки доступны для изучения.</span></div></div> : <ActionControl state={state} onAction={onAction} id="inspect" compact />}</>}
        </aside>
      </div>
      <div className="scene-followups panel"><div className="followup-heading"><span className="eyebrow">СОХРАНИТЬ И ПРОВЕРИТЬ</span><p>Следы полезны, пока у них есть источник.</p></div><div className="scene-action-grid"><ActionControl state={state} onAction={onAction} id="preserve-camera" /><ActionControl state={state} onAction={onAction} id="request-access" /><ActionControl state={state} onAction={onAction} id="request-print" /></div></div>
    </section>
  );
}

const PEOPLE = [
  { id: 'volkova', name: 'Анастасия Волкова', role: 'Консультант фирмы', initials: 'АВ', label: 'СВИДЕТЕЛЬ', tone: 'sand', description: '26 лет. Сотрудничала с фирмой Коренева. Накануне приезжала в офис по рабочему вопросу.', actions: ['interview-volkova', 'clarify-volkova'], evidence: 'E06' as EvidenceId },
  { id: 'danilov', name: 'Сергей Данилов', role: 'Охранник', initials: 'СД', label: 'СВИДЕТЕЛЬ', tone: 'sage', description: 'Дежурил вечером 13 сентября. Сообщил об обнаружении тела в 21:30. Его первоначальное объяснение уже в деле.', actions: ['interview-guard', 'support-witness', 'pressure-witness', 'reinterview-guard'], evidence: 'E08' as EvidenceId },
  { id: 'lebedeva', name: 'Марина Лебедева', role: 'Бухгалтер', initials: 'МЛ', label: 'СВИДЕТЕЛЬ', tone: 'rose', description: 'Ведёт финансовые документы фирмы. Может помочь разобраться в назначении отсутствующей папки № 17.', actions: ['contact-accountant', 'verify-finance'], evidence: 'E07' as EvidenceId },
  { id: 'orlov', name: 'Илья Орлов', role: 'Деловой партнёр', initials: 'ИО', label: 'УЧАСТНИК ПРОВЕРКИ', tone: 'gray', description: 'Партнёр Коренева по строительному бизнесу. Утверждает, что ушёл из офиса в 19:00 и больше не возвращался.', actions: ['question-orlov'], evidence: 'E04' as EvidenceId },
] as const;

function PersonPortrait({ person }: { person: typeof PEOPLE[number] }) {
  const female = person.id === 'volkova' || person.id === 'lebedeva';
  const older = person.id === 'danilov' || person.id === 'lebedeva';
  return <svg viewBox="0 0 160 140" aria-hidden="true" className={`person-portrait portrait-${person.tone}`}><path d="M0 112 160 63V140H0Z" fill="currentColor" opacity=".05" /><circle cx="80" cy="58" r="39" fill="currentColor" opacity=".06" /><path d={female ? 'M52 61Q45 20 79 19Q113 20 109 69L119 94H42Z' : 'M53 47Q50 20 79 20Q111 20 108 50L98 74H63Z'} fill="currentColor" opacity=".7" /><path d="M65 80V97L53 102 80 123 106 102 95 97V80Z" fill="#c0b299" /><path d="M55 51Q55 38 80 36Q105 37 105 51V66Q103 89 80 95Q57 87 55 66Z" fill="#d4c5aa" /><path d={female ? 'M52 53Q52 25 80 26Q106 27 108 57Q86 48 78 36Q72 49 52 53Z' : 'M53 52 57 33 80 26 103 32 108 52 96 42 75 43 66 40Z'} fill="currentColor" opacity=".85" /><path d="M65 58H74M88 58H97" stroke="#696652" strokeWidth="2" /><path d="M80 62 77 73H83M73 81Q80 84 87 81" fill="none" stroke="#a49376" strokeWidth="1.5" />{older && <path d="M60 57H77V67H60ZM85 57H102V67H85ZM77 60H85" fill="none" stroke="#636854" strokeWidth="1.5" />}<path d="M23 140Q25 110 52 102L64 96 80 111 96 96 109 102Q136 110 138 140Z" fill="currentColor" opacity=".8" /><path d="M64 96 80 111 96 96 91 140H70Z" fill="#e4dfcf" /><path d="M53 102 65 99 72 124 64 128 70 140M107 102 95 99 88 124 96 128 90 140" fill="none" stroke="currentColor" strokeWidth="2" opacity=".6" />{!female && person.id !== 'danilov' && <path d="M76 112H84L82 120 85 140H75L78 120Z" fill="#676e59" />}</svg>;
}

function PersonStatement({ state, person }: { state: GameState; person: typeof PEOPLE[number] }) {
  const entry = state.evidence[person.evidence];
  if (person.id === 'orlov') return <><p className="eyebrow">{state.completedActions.includes('question-orlov') ? 'УТОЧНЁННАЯ ПОЗИЦИЯ' : 'ПЕРВОНАЧАЛЬНАЯ ПОЗИЦИЯ'}</p><blockquote>{state.completedActions.includes('question-orlov') ? '«Да, я вернулся. Забрал бумаги. Когда я уходил, Павел был жив». ' : '«В семь я уехал из офиса. Больше в тот вечер не возвращался». '}</blockquote><p className="statement-limit">{state.completedActions.includes('question-orlov') ? 'Изменение объяснения зафиксировано. Оно требует сопоставления с другими источниками.' : 'Время первого ухода можно проверить по журналу доступа. Остальная часть объяснения требует проверки.'}</p></>;
  const definition = EVIDENCE.find((item) => item.id === person.evidence);
  if (!entry || !definition) return <div className="person-awaiting"><MessageSquare size={28} strokeWidth={1.3} /><h4>Разговор ещё впереди</h4><p>Назначьте опрос, чтобы получить объяснение и зафиксировать источник сведений.</p></div>;
  return <><p className="eyebrow">{entry.stage === 2 ? 'ДОПОЛНЕННОЕ ОБЪЯСНЕНИЕ' : 'ПОЛУЧЕННЫЕ СВЕДЕНИЯ'} · {definition.id}</p><p className="person-statement">{entry.stage === 2 ? definition.full : definition.initial}</p>{person.id === 'danilov' && entry.stage === 1 && state.completedActions.includes('interview-guard') && <p className="person-statement">При опросе Данилов говорит, что боится потерять работу, и избегает вопросов о посетителях. Для следующего разговора нужны независимые сведения о проходах.</p>}<p className="statement-limit">{definition.id === 'E06' && entry.stage === 1 ? 'Неточное время и резкая фраза сами по себе не доказывают участие в смерти. Нужно запросить полный контекст.' : definition.limitation}</p></>;
}

export function PeoplePanel({ state, onAction }: PanelProps) {
  const [selected, setSelected] = useState('volkova');
  const person = PEOPLE.find((item) => item.id === selected) ?? PEOPLE[0];
  return <section className="investigation-section people-section"><div className="section-heading"><div><p className="eyebrow">ОБЪЯСНЕНИЯ И ПОКАЗАНИЯ</p><h2>Люди в деле</h2></div><span className="scene-location"><Users size={15} /> 4 участника</span></div>
    <div className="people-cards">{PEOPLE.map((item) => <button className={`person-card ${selected === item.id ? 'is-selected' : ''}`} key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}><div className="portrait-wrap"><PersonPortrait person={item} /><span className="portrait-initials">{item.initials}</span></div><div className="person-card-copy"><span className="person-role">{item.role}</span><strong>{item.name}</strong><span className="person-open">Открыть досье <ArrowRight size={14} /></span></div></button>)}</div>
    <div className="person-dossier panel" key={person.id}><div className="person-summary"><p className="eyebrow">{person.label}</p><h3>{person.name}</h3><p>{person.description}</p><div className="source-note"><Fingerprint size={15} /><span>Источник {person.evidence} · Слова участника проверяются отдельно.</span></div>{person.id === 'danilov' && <div className="witness-approach"><ShieldCheck size={20} /><div><strong>{state.witnessApproach === 'support' ? 'Выбран бережный подход' : state.witnessApproach === 'pressure' ? 'Давление зафиксировано' : 'Способ разговора имеет значение'}</strong><p>{state.witnessApproach === 'support' ? 'Опасения свидетеля учтены. Его рассказ всё равно нужно проверить по независимым данным.' : state.witnessApproach === 'pressure' ? 'Полученные слова требуют повторного опроса без давления и независимой проверки.' : 'Можно обсудить опасения свидетеля или настоять на ответе. Давление снижает пригодность полученных показаний.'}</p></div></div>}</div>
      <div className="person-record"><PersonStatement state={state} person={person} /><div className="person-action-list">{person.actions.map((id) => <ActionControl key={id} id={id} state={state} onAction={onAction} />)}</div></div>
    </div>
  </section>;
}

const EVIDENCE_ACTIONS: Partial<Record<EvidenceId, string[]>> = {
  E01: ['inspect'], E02: ['prepare-expert'], E03: ['request-print'], E04: ['request-access'], E05: ['preserve-camera'], E06: ['interview-volkova', 'clarify-volkova'], E07: ['contact-accountant', 'verify-finance'], E08: ['interview-guard', 'reinterview-guard'],
};

export function EvidencePanel({ state, onAction, initialEvidence }: PanelProps & { initialEvidence?: EvidenceId }) {
  const [selected, setSelected] = useState<EvidenceId>(initialEvidence ?? 'E04');
  const [compare, setCompare] = useState(false);
  const [otherId, setOtherId] = useState<EvidenceId>('E08');
  const evidence = EVIDENCE.find((item) => item.id === selected) ?? EVIDENCE[0];
  const progress = state.evidence[evidence.id];
  const count = EVIDENCE.filter((item) => state.evidence[item.id]).length;
  const collected = EVIDENCE.filter((item) => state.evidence[item.id]);
  const compareOptions = collected.filter((item) => item.id !== evidence.id);
  const other = compareOptions.find((item) => item.id === otherId) ?? compareOptions[0];
  const otherProgress = other && state.evidence[other.id];
  return <section className="investigation-section evidence-section"><div className="section-heading"><div><p className="eyebrow">РЕЕСТР ИСТОЧНИКОВ</p><h2>Материалы дела</h2></div><span className="evidence-count"><strong>{count}</strong> / 8 получено</span></div>
    <div className="evidence-workspace"><nav className="evidence-list" aria-label="Материалы расследования">{EVIDENCE.map((item) => { const itemProgress = state.evidence[item.id]; return <button key={item.id} className={`evidence-row ${selected === item.id ? 'is-selected' : ''} ${!itemProgress ? 'is-locked' : ''}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span className="evidence-number">{item.id}</span><span className="evidence-row-text"><strong>{item.title}</strong><small>{itemProgress ? itemProgress.stage === 2 ? itemProgress.verified ? 'Дополнено и проверено' : 'Дополнено · к проверке' : 'Первичные сведения' : item.id === 'E05' && state.cameraLost ? 'Источник утрачен' : 'Ожидает получения'}</small></span><span className="evidence-row-icon">{!itemProgress ? <LockKeyhole size={14} /> : itemProgress.verified ? <CheckCheck size={16} /> : <ArrowRight size={15} />}</span></button>; })}</nav>
      <article className="evidence-detail paper"><header className="evidence-detail-header"><div><span className="eyebrow">ИСТОЧНИК {evidence.id} · {evidence.category}</span><h3>{evidence.title}</h3></div><span className={`material-stamp ${progress?.verified ? 'is-verified' : ''}`}>{progress ? progress.verified ? 'ПРОВЕРЕНО' : 'К ПРОВЕРКЕ' : 'НЕТ В ДЕЛЕ'}</span></header>
        {progress ? <><div className="evidence-metadata"><span><Fingerprint size={14} />{evidence.source}</span><span><Clock3 size={14} />Получено: день {progress.receivedDay}</span></div><div className="material-body"><p className="eyebrow">{progress.stage === 2 ? 'АКТУАЛЬНЫЕ СВЕДЕНИЯ' : 'ПЕРВИЧНЫЕ СВЕДЕНИЯ'}</p><p>{progress.stage === 2 ? evidence.full : evidence.initial}</p></div>{progress.stage === 2 && evidence.initial !== evidence.full && <details className="original-record"><summary>Первоначальная запись сохранена <Plus size={14} /></summary><p>{evidence.initial}</p></details>}<div className="material-limitation"><Info size={18} /><div><strong>Границы этого источника</strong><p>{evidence.id === 'E06' && progress.stage === 1 ? 'Неточное время и резкая фраза сами по себе не доказывают участие в смерти. Нужно запросить полный контекст.' : evidence.limitation}</p></div></div></> : <div className="locked-material"><LockKeyhole size={30} strokeWidth={1.2} /><h4>{evidence.id === 'E05' && state.cameraLost ? 'Запись больше недоступна' : 'Материал ещё не получен'}</h4><p>{evidence.id === 'E05' && state.cameraLost ? 'Срок хранения истёк. Продолжайте проверку по журналу доступа и показаниям свидетеля.' : 'Содержание появится после получения источника. Ниже указаны действия, которые помогут его запросить или проверить.'}</p></div>}
        <div className="material-actions">{EVIDENCE_ACTIONS[evidence.id]?.map((id) => <ActionControl key={id} id={id} state={state} onAction={onAction} />)}</div>
        {progress && collected.length > 1 && <div className="comparison-section"><button className="comparison-toggle" aria-expanded={compare} onClick={() => setCompare(!compare)}><ArrowDownUp size={16} /><span>Сопоставить с другим источником</span>{compare ? <Minus size={15} /> : <Plus size={15} />}</button>{compare && <div className="comparison-content"><label htmlFor="comparison-source">Второй источник</label><select id="comparison-source" value={other?.id ?? otherId} onChange={(event) => setOtherId(event.target.value as EvidenceId)}>{compareOptions.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select>{other && otherProgress && <><p>{otherProgress.stage === 2 ? other.full : other.initial}</p><small>{other.id === 'E06' && otherProgress.stage === 1 ? 'Неточное время и резкая фраза сами по себе не доказывают участие в смерти. Нужно запросить полный контекст.' : other.limitation}</small></>}<div className="comparison-prompt">Проверьте время, происхождение и то, какие утверждения источники подтверждают независимо.</div></div>}</div>}
      </article>
    </div>
  </section>;
}
