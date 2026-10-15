import { ACTIONS, EVIDENCE } from './content';
import type { ActionAvailability, Assessment, Decision, DocKind, DocumentDraft, EvidenceId, GameState, Hypothesis } from './types';

type Mode = 'drawn' | 'typed';
const IDS = EVIDENCE.map(item => item.id);
const DATE_BASE = Date.UTC(2026, 8, 14);
const dateFor = (day: number) => new Date(DATE_BASE + (day - 1) * 86400000).toISOString().slice(0, 10);
const copy = (state: GameState): GameState => structuredClone(state);
const latest = (state: GameState, kind: DocKind) => [...state.documents].reverse().find(doc => doc.kind === kind);
const done = (state: GameState, id: string) => state.completedActions.includes(id);
const full = (state: GameState, id: EvidenceId) => state.evidence[id]?.stage === 2 && state.evidence[id]?.verified === true;
const actionKey = (state: GameState, id: string) => ['consult', 'break'].includes(id) ? `${id}:day${state.day}` : id;

function addJournal(state: GameState, text: string) {
  state.journal.push({ id: `j-${state.journal.length + 1}`, day: state.day, time: getTime(state.spent), text });
}
function ensureOpen(state: GameState) { if (state.ending) throw new Error('Дело завершено. Начните новое расследование для других решений.'); }
function ensureTime(state: GameState, cost: number) {
  if (state.spent + cost > 15) throw new Error('Недостаточно времени: последние полчаса зарезервированы для итогового отчёта.');
}
function checkSignature(signature: string, mode: Mode) {
  if (mode !== 'drawn' && mode !== 'typed') throw new Error('Неизвестный способ подписи.');
  if (typeof signature !== 'string' || !signature.trim() || signature.length > 500000) throw new Error('Добавьте подпись перед сохранением документа.');
  if (mode === 'typed' && signature.trim().length > 120) throw new Error('Текст подписи должен быть короче 120 символов.');
  if (mode === 'drawn' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(signature)) throw new Error('Не удалось прочитать изображение подписи. Нарисуйте её ещё раз.');
}
function rememberSignature(state: GameState, signature: string, mode: Mode) {
  if (mode !== 'drawn' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(signature)) return;
  if (!state.signatureSamples.includes(signature)) state.signatureSamples = [...state.signatureSamples, signature].slice(-3);
}
function receive(state: GameState) {
  for (const request of state.requests.filter(item => item.dueDay <= state.day)) {
    const id: EvidenceId = ({ camera: 'E05', expert: 'E02', access: 'E04', print: 'E03', finance: 'E07' } as const)[request.key];
    const verified = request.key !== 'expert' || latest(state, 'expert')?.issues.length === 0;
    state.evidence[id] = { stage: 2, receivedDay: state.day, verified };
    addJournal(state, `Получен материал ${id}: ${EVIDENCE.find(item => item.id === id)!.title}.`);
  }
  state.requests = state.requests.filter(item => item.dueDay > state.day);
  if (state.day > 2 && !state.evidence.E05 && !state.requests.some(item => item.key === 'camera') && !state.cameraLost) {
    state.cameraLost = true;
    addJournal(state, 'Срок хранения камеры истёк. Запись утрачена. Продолжите проверку через журнал доступа, финансовые документы и независимую проверку показаний.');
  }
}

export function getTime(spent: number): string {
  const minutes = 9 * 60 + Math.max(0, Math.min(16, Math.floor(spent))) * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function createInitialState(): GameState {
  const correct: DocumentDraft = { patronymic: 'Андреевич', date: '2026-09-14', photoCount: 4, attachedPhotos: 4, question: 'Установить причину и ориентировочное время смерти; проверить признаки внешнего воздействия.' };
  return {
    version: 1, day: 1, spent: 1, profileName: 'Алексей Морозов', completedActions: [],
    evidence: { E04: { stage: 1, receivedDay: 1, verified: false }, E08: { stage: 1, receivedDay: 1, verified: false } },
    drafts: { inspection: { ...correct, patronymic: 'Александрович', date: '2026-09-13', attachedPhotos: 3 }, expert: { ...correct } },
    documents: [], journal: [{ id: 'j-1', day: 1, time: '09:30', text: '14 сентября. Принято сообщение о смерти Павла Андреевича Коренева. Поступившая версия — самоубийство; обстоятельства требуют проверки. Камера соседнего офиса хранится до конца второго дня.' }],
    requests: [], signatureSamples: [], hypothesis: 'unknown', selectedEvidence: [], witnessApproach: null, cameraLost: false, ending: null,
  };
}

export function getAvailability(state: GameState, id: string): ActionAvailability {
  const action = ACTIONS.find(item => item.id === id);
  if (!action) return { allowed: false, completed: false, reason: 'Неизвестное действие.' };
  if (done(state, actionKey(state, id))) return { allowed: false, completed: true, reason: 'Действие уже выполнено.' };
  const fail = (reason: string): ActionAvailability => ({ allowed: false, completed: false, reason });
  if (state.ending) return fail('Дело завершено.');
  if (state.day < action.minDay) return fail(`Доступно с ${action.minDay}-го дня.`);
  if (id === 'preserve-camera' && (state.cameraLost || state.day > 2)) return fail('Срок хранения записи истёк. Доступен другой путь проверки.');
  if (['prepare-expert', 'request-print', 'contact-accountant'].includes(id) && !state.evidence.E01) return fail('Сначала осмотрите кабинет.');
  if (id === 'clarify-volkova' && !done(state, 'interview-volkova')) return fail('Сначала проведите первый опрос Волковой.');
  if (id === 'verify-finance' && !state.evidence.E07) return fail('Сначала получите копии у бухгалтера.');
  if (['support-witness', 'pressure-witness', 'reinterview-guard'].includes(id) && !done(state, 'interview-guard')) return fail('Сначала опросите охранника.');
  if (['reinterview-guard', 'question-orlov'].includes(id) && !full(state, 'E04') && !full(state, 'E05')) return fail('Нужен полученный резервный журнал или запись камеры.');
  if (id === 'pressure-witness' && state.witnessApproach === 'support') return fail('Вы уже выбрали спокойную проверку показаний.');
  if (state.spent + action.cost > 15) return fail('Недостаточно времени с учётом получаса на итоговый отчёт.');
  return { allowed: true, completed: false };
}

export function performAction(state: GameState, id: string): GameState {
  const availability = getAvailability(state, id);
  if (availability.completed) return state;
  if (!availability.allowed) throw new Error(availability.reason);
  const next = copy(state);
  const action = ACTIONS.find(item => item.id === id)!;
  next.spent += action.cost;
  next.completedActions.push(actionKey(state, id));
  const evidence = (key: EvidenceId, stage: 1 | 2, verified: boolean) => { next.evidence[key] = { stage, verified, receivedDay: next.day }; };
  const request = (key: 'camera' | 'access' | 'print' | 'finance') => next.requests.push({ key, requestedDay: next.day, dueDay: next.day + 1 });
  let detail = '';
  switch (id) {
    case 'inspect': evidence('E01', 1, false); evidence('E03', 1, true); detail = 'Получены четыре фотографии; фото № 4 нужно приложить к протоколу. Обстановка допускает несколько объяснений.'; break;
    case 'interview-volkova': evidence('E06', 1, false); detail = 'Сохранены исходные слова: «ушла в 20:00». Сообщение «Я ещё у Павла» отправлено в 20:18. Это вопрос для проверки, а не готовый вывод.'; break;
    case 'preserve-camera': request('camera'); detail = 'Копия сохранена до перезаписи. Передача ожидается завтра.'; break;
    case 'prepare-expert': next.drafts.expert.date = dateFor(next.day); detail = 'Проект поручения готов. Подпишите его в документах, чтобы запустить исследование.'; break;
    case 'request-access': request('access'); detail = 'Резервную копию передадут завтра.'; break;
    case 'request-print': request('print'); detail = 'Историю печати передадут завтра.'; break;
    case 'clarify-volkova': evidence('E06', 2, true); detail = 'Полный разговор касается прекращения договора. Волкова уточнила уход около 20:25. Её участие в нападении не подтверждено.'; break;
    case 'interview-guard': detail = 'Данилов боится потерять работу и избегает вопросов о посетителях. Для повторного опроса нужны независимые сведения о проходах.'; break;
    case 'reinterview-guard': evidence('E08', 2, next.witnessApproach !== 'pressure'); detail = 'Данилов узнал Орлова во время конфликта в 21:06 и рассказал об угрозе. Пределы его наблюдений отмечены.'; break;
    case 'contact-accountant': evidence('E07', 1, false); detail = 'Получены финансовые копии и сообщение Коренева в 20:49. Происхождение копий следует проверить.'; break;
    case 'verify-finance': request('finance'); detail = 'Подтверждение происхождения копий ожидается завтра.'; break;
    case 'support-witness': next.witnessApproach = 'support'; if (next.evidence.E08?.stage === 2) next.evidence.E08.verified = true; detail = 'Опасения свидетеля зафиксированы. Рассказ проверяется спокойно; прежний способ получения остаётся в архиве.'; break;
    case 'pressure-witness': next.witnessApproach = 'pressure'; if (next.evidence.E08) next.evidence.E08.verified = false; detail = 'Давление зафиксировано. Показание нельзя считать независимо проверенным без повторной спокойной проверки.'; break;
    case 'question-orlov': detail = 'Орлов признаёт возвращение в 20:52: «Пришёл за бумагами. Павел был жив». Изменение рассказа не заменяет доказательства участия в нападении.'; break;
    case 'consult': detail = 'Наставник: «Отдельно проверь характер события, участие человека и пригодность оснований. Мотив и ложь ещё не доказывают убийство». '; break;
    case 'break': detail = 'Полчаса тишины. Материалы и сроки остались прежними.'; break;
  }
  addJournal(next, `${action.title}. ${detail}`);
  return next;
}

export function updateDraft(state: GameState, kind: DocKind, patch: Partial<DocumentDraft>): GameState {
  ensureOpen(state);
  if (!['inspection', 'expert'].includes(kind)) throw new Error('Неизвестный документ.');
  const allowed = ['patronymic', 'date', 'photoCount', 'attachedPhotos', 'question'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Неизвестное поле документа.');
  for (const [key, value] of Object.entries(patch)) {
    if (['photoCount', 'attachedPhotos'].includes(key)) {
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 99) throw new Error('Количество приложений должно быть целым числом от 0 до 99.');
    } else if (typeof value !== 'string' || value.length > 4000) throw new Error('Некорректный текст документа.');
  }
  const next = copy(state); next.drafts[kind] = { ...next.drafts[kind], ...patch }; return next;
}

function documentIssues(state: GameState, kind: DocKind): string[] {
  const draft = state.drafts[kind];
  const issues: string[] = [];
  if (draft.patronymic.trim() !== 'Андреевич') issues.push('Отчество погибшего расходится с карточкой: Павел Андреевич Коренев.');
  const expectedDate = dateFor(kind === 'inspection' ? state.evidence.E01!.receivedDay : state.day);
  if (draft.date !== expectedDate) issues.push(`Дата документа расходится с датой действия: ${expectedDate}.`);
  if (kind === 'inspection' && (draft.photoCount !== 4 || draft.attachedPhotos !== 4)) issues.push('Осмотр содержит четыре фотографии; опись и приложения должны соответствовать источнику.');
  if (kind === 'expert' && (!draft.question.trim() || /подтвердить\s+самоубийство|доказать\s+виновность/i.test(draft.question))) issues.push('Вопрос эксперту должен проверять обстоятельства, а не требовать заранее выбранного ответа.');
  return issues;
}

export function signDocument(state: GameState, kind: DocKind, signature: string, mode: Mode): GameState {
  ensureOpen(state); checkSignature(signature, mode);
  if (!['inspection', 'expert'].includes(kind)) throw new Error('Неизвестный документ.');
  if (!state.evidence.E01) throw new Error('Сначала проведите осмотр.');
  if (kind === 'expert' && !done(state, 'prepare-expert')) throw new Error('Сначала подготовьте исследование.');
  const draft = state.drafts[kind];
  const title = kind === 'inspection' ? 'Протокол осмотра' : 'Поручение на исследование';
  const text = `${title}\nПавел ${draft.patronymic} Коренев\nДата: ${draft.date}\n${kind === 'inspection' ? `Фотографий в описи: ${draft.photoCount}. Приложено: ${draft.attachedPhotos}.\nМесто: кабинет предпринимателя. Обстановка и записка зафиксированы.` : `Вопрос: ${draft.question}`}`;
  if (latest(state, kind)?.text === text) return state;
  ensureTime(state, 1);
  const next = copy(state); next.spent += 1;
  const issues = documentIssues(state, kind);
  const amendment = !!latest(state, kind);
  next.documents.push({ id: `doc-${next.documents.length + 1}`, kind, day: next.day, time: getTime(next.spent), title: `${title}${amendment ? ' · уточнённая версия' : ''}`, text, signature, signatureMode: mode, issues });
  rememberSignature(next, signature, mode);
  if (kind === 'inspection') {
    next.evidence.E01!.verified = issues.length === 0;
    next.evidence.E01!.stage = issues.length === 0 ? 2 : 1;
  }
  if (kind === 'expert') {
    if (next.evidence.E02) next.evidence.E02.verified = issues.length === 0;
    else if (!next.requests.some(item => item.key === 'expert')) next.requests.push({ key: 'expert', requestedDay: next.day, dueDay: next.day + 2 });
  }
  addJournal(next, `${title} подписан${amendment ? ' в новой версии; прежняя сохранена в архиве' : ''}. ${kind === 'expert' && !next.evidence.E02 ? 'Результат исследования поступит после одного полного следующего дня.' : 'Содержание и подпись сохранены.'}`);
  return next;
}

export function endDay(state: GameState, hypothesis: Hypothesis, plan: string, signature: string, mode: Mode): GameState {
  ensureOpen(state); checkSignature(signature, mode);
  if (!['unknown', 'intervention', 'suicide'].includes(hypothesis)) throw new Error('Выберите рабочую версию.');
  if (typeof plan !== 'string' || !plan.trim() || plan.length > 4000) throw new Error('Добавьте короткий план следующего дня.');
  if (state.spent > 15) throw new Error('Для отчёта не осталось времени.');
  const next = copy(state); next.spent += 1; next.hypothesis = hypothesis;
  const labels = { unknown: 'Данных пока недостаточно', intervention: 'Проверить внешнее вмешательство', suicide: 'Проверить версию самоубийства' };
  next.documents.push({ id: `doc-${next.documents.length + 1}`, kind: 'report', day: next.day, time: getTime(next.spent), title: `Итоговый отчёт · день ${next.day}`, text: `Рабочая версия: ${labels[hypothesis]}.\nПлан: ${plan.trim()}\nНеисполненные запросы: ${next.requests.length}.`, signature, signatureMode: mode, issues: [] });
  rememberSignature(next, signature, mode);
  addJournal(next, `День завершён. ${labels[hypothesis]}. План сохранён; текст плана сам по себе не отправляет запросы.`);
  next.day += 1; next.spent = 0;
  addJournal(next, `Начат день ${next.day}. Проверьте поступившие материалы и сроки.`);
  receive(next);
  return next;
}

export function assessCase(state: GameState, selected: EvidenceId[] = Object.keys(state.evidence) as EvidenceId[]): Assessment {
  const has = (id: EvidenceId) => selected.includes(id) && !!state.evidence[id];
  const verified = (id: EvidenceId) => has(id) && full(state, id);
  const issues: string[] = [];
  const event = has('E01') && state.evidence.E01?.verified === true && verified('E02');
  if (!event) issues.push('Характер события: нужны оформленный осмотр E01 и проверенное экспертное заключение E02.');
  const identity = verified('E08') && (verified('E05') || (verified('E04') && verified('E07')));
  if (!identity) issues.push('Участие лица: нужны проверенные показания E08 и независимое подтверждение присутствия — E05 либо сочетание E04 и E07.');
  const docsValid = ['inspection', 'expert'].every(kind => latest(state, kind as DocKind)?.issues.length === 0);
  const unknown = selected.some(id => !IDS.includes(id) || !state.evidence[id]);
  const unverified = selected.filter(id => state.evidence[id] && !state.evidence[id]!.verified);
  const alternatives = verified('E06');
  const integrity = docsValid && !unknown && unverified.length === 0 && alternatives && state.witnessApproach !== 'pressure';
  if (!docsValid) issues.push('Оформление: проверьте последнюю подписанную версию осмотра и поручения; исправления сохраняются отдельной версией.');
  if (unknown) issues.push('В пакет включён ещё не полученный материал.');
  if (unverified.length) issues.push(`Происхождение или проверка не завершены: ${unverified.join(', ')}.`);
  if (!alternatives) issues.push('Оправдывающий контекст E06 следует получить, проверить и включить в пакет.');
  if (state.witnessApproach === 'pressure') issues.push('Показания получены под давлением; нужна спокойная повторная проверка.');
  return { event, identity, integrity, issues };
}

export function finishCase(state: GameState, decision: Decision, selected: EvidenceId[], signature: string, mode: Mode): GameState {
  ensureOpen(state); checkSignature(signature, mode);
  if (state.day < 4) throw new Error('Итоговое решение доступно с четвёртого дня. До этого сохраняйте рабочую версию в отчёте.');
  if (!['orlov', 'volkova', 'close'].includes(decision)) throw new Error('Выберите итоговое решение.');
  if (!Array.isArray(selected) || selected.some(id => !IDS.includes(id) || !state.evidence[id])) throw new Error('Выберите только полученные материалы.');
  if (state.spent + 1 > 16) throw new Error('Для итогового решения не осталось времени. Завершите день отчётом.');
  const next = copy(state); next.spent += 1; next.selectedEvidence = [...new Set(selected)];
  const assessment = assessCase(state, next.selectedEvidence);
  const sufficient = assessment.event && assessment.identity && assessment.integrity;
  const kind = decision === 'close' ? 'closed' : decision === 'volkova' ? 'wrong' : sufficient ? 'strong' : 'weak';
  const outcomes = {
    strong: { title: 'Материалы выдержали проверку', description: 'Версия об участии Орлова опирается на независимые источники. Пакет принят для дальнейшего рассмотрения. Судебная оценка и исход ещё впереди.', epilogue: 'Шесть месяцев спустя. Данилова вызывают повторно. Ваша подпись и сохранённые версии позволяют восстановить основания решения. Защита оспаривает пределы наблюдений; суд ещё не вынес окончательного решения.' },
    weak: { title: 'Версия сильнее материалов', description: 'Вы указали Орлова, но пакет требует доработки. Уверенность в версии не заменяет недостающие основания.', epilogue: 'Шесть месяцев спустя. При повторной проверке открывают подписанный вами пакет. Неустранённые пробелы задержали дело; дальнейший исход зависит от новых материалов, а не от правильной догадки.' },
    wrong: { title: 'Обвинение не подтверждено', description: 'Материалы не связывают Волкову с нападением. Жалоба требует проверки ошибочной версии; контекст переписки нельзя подменить подозрением.', epilogue: 'Шесть месяцев спустя. Волкова подала жалобу. Проверка сопоставляет ваш подписанный выбор с материалами, которые были доступны в тот день. Честная ошибка и сознательное сокрытие сведений оцениваются отдельно.' },
    closed: { title: 'Проверка прекращена', description: 'Вы подписали решение о прекращении проверки. Оставшиеся противоречия и содержание архива сохраняются.', epilogue: 'Шесть месяцев спустя. Поступили новые сведения, и материалы поднимают из архива. Проверяющий читает именно ваше решение и оценивает, какие обстоятельства вы знали в момент его подписания.' },
  };
  const outcome = outcomes[kind];
  const issues = [...assessment.issues];
  if (kind === 'wrong') issues.unshift('В имеющихся материалах отсутствует связь Волковой с нападением.');
  if (kind === 'closed' && (state.evidence.E02 || full(state, 'E04'))) issues.unshift('Закрытие оставляет выявленные противоречия без окончательной проверки.');
  next.ending = { kind, ...outcome, issues };
  next.documents.push({ id: `doc-${next.documents.length + 1}`, kind: 'decision', day: next.day, time: getTime(next.spent), title: 'Итоговое решение', text: `Решение: ${decision === 'orlov' ? 'направить материалы в отношении Орлова' : decision === 'volkova' ? 'направить материалы в отношении Волковой' : 'прекратить проверку'}.\nОснования: ${next.selectedEvidence.join(', ') || 'не выбраны'}.\n${outcome.description}`, signature, signatureMode: mode, issues });
  rememberSignature(next, signature, mode);
  addJournal(next, `Подписано итоговое решение. ${outcome.title}. Архив сохранён для последующей проверки.`);
  return next;
}

export function parseSave(raw: string): GameState {
  const fail = (): never => { throw new Error('Сохранение повреждено или имеет неподдерживаемый формат.'); };
  if (typeof raw !== 'string' || raw.length > 10000000) return fail();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fail(); }
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v: unknown, max = 4000): v is string => typeof v === 'string' && v.length <= max;
  const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  const list = (v: unknown, test: (item: unknown) => boolean, max = 5000): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(test);
  const enumOf = (v: unknown, values: readonly unknown[]) => values.includes(v);
  if (!object(value) || value.version !== 1 || !int(value.day, 1, 10000) || !int(value.spent, 0, 16) || !str(value.profileName, 120)) return fail();
  const day = value.day;
  const validSignature = (v: unknown, mode: unknown) => { try { checkSignature(v as string, mode as Mode); return true; } catch { return false; } };
  const actionValid = (v: unknown) => str(v, 100) && (ACTIONS.some(action => action.id === v) || /^(consult|break):day\d+$/.test(v));
  if (!list(value.completedActions, actionValid) || new Set(value.completedActions).size !== value.completedActions.length) return fail();
  if (!object(value.evidence) || Object.entries(value.evidence).some(([id, item]) => !IDS.includes(id as EvidenceId) || !object(item) || !enumOf(item.stage, [1, 2]) || typeof item.verified !== 'boolean' || !int(item.receivedDay, 1, day))) return fail();
  const validDraft = (v: unknown) => object(v) && str(v.patronymic, 4000) && str(v.date, 30) && int(v.photoCount, 0, 99) && int(v.attachedPhotos, 0, 99) && str(v.question, 4000);
  if (!object(value.drafts) || !validDraft(value.drafts.inspection) || !validDraft(value.drafts.expert)) return fail();
  if (!list(value.documents, item => object(item) && str(item.id, 100) && enumOf(item.kind, ['inspection', 'expert', 'report', 'decision']) && int(item.day, 1, day) && str(item.time, 5) && /^\d{2}:\d{2}$/.test(item.time) && str(item.title) && str(item.text, 20000) && validSignature(item.signature, item.signatureMode) && list(item.issues, issue => str(issue), 100))) return fail();
  if (!list(value.journal, item => object(item) && str(item.id, 100) && int(item.day, 1, day) && str(item.time, 5) && str(item.text, 20000))) return fail();
  if (!list(value.requests, item => object(item) && enumOf(item.key, ['camera', 'expert', 'access', 'print', 'finance']) && int(item.requestedDay, 1, day) && int(item.dueDay, day + 1, day + 2), 5)) return fail();
  if (new Set(value.requests.map(item => (item as { key: string }).key)).size !== value.requests.length) return fail();
  if (!list(value.signatureSamples, item => str(item, 500000), 3) || !enumOf(value.hypothesis, ['unknown', 'intervention', 'suicide']) || !list(value.selectedEvidence, item => IDS.includes(item as EvidenceId), 8)) return fail();
  if (!enumOf(value.witnessApproach, ['support', 'pressure', null]) || typeof value.cameraLost !== 'boolean') return fail();
  if (value.ending !== null && (!object(value.ending) || !enumOf(value.ending.kind, ['strong', 'weak', 'wrong', 'closed']) || !str(value.ending.title) || !str(value.ending.description) || !str(value.ending.epilogue) || !list(value.ending.issues, item => str(item), 100))) return fail();
  if (value.spent === 16 && value.ending === null) return fail();
  return value as unknown as GameState;
}
