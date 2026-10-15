import { createInitialState, parseSave } from '../game/engine';
import type { GameState } from '../game/types';
import { CASES, CONTACTS, SKILLS, UPGRADES } from './content';
import type { CampaignAvailability, CampaignDocument, CampaignEvent, CampaignState, CareerGoal, CaseAssessment, CaseDefinition, CaseId, CaseProgress, ContactId, ContactSupport, Effects, FinanceEntry, SkillId, UpgradeId } from './types';

type Mode = 'typed' | 'drawn';
const CASE_IDS: CaseId[] = ['001', '002', '003', '004', '005'];
const SKILL_IDS: SkillId[] = ['forensics', 'psychology', 'law', 'leadership', 'fitness', 'attention', 'precision'];
const CONTACT_IDS: ContactId[] = ['volkova', 'lebedeva', 'mentor', 'danilov'];
const UPGRADE_IDS: UpgradeId[] = ['lamp', 'chair', 'scanner', 'safe', 'computer', 'books'];
const clone = (state: CampaignState) => structuredClone(state);
const unique = <T>(items: T[]) => [...new Set(items)];
const bounded = (n: number) => Math.max(0, Math.min(100, n));
const isCaseId = (id: string): id is CaseId => CASE_IDS.includes(id as CaseId);

export function getCase(id: string): CaseDefinition {
  const definition = CASES.find(item => item.id === id);
  if (!definition) throw new Error('Неизвестное дело.');
  return definition;
}

function progress(state: CampaignState, id: string) {
  getCase(id);
  return state.cases[id as CaseId];
}

function investigating(state: CampaignState, id: string) {
  const current = progress(state, id);
  if (id === '001') throw new Error('Первое расследование открывается через материалы дела «Последняя папка».');
  if (state.activeCase !== id || current.status !== 'investigating') throw new Error('Сначала откройте доступное расследование.');
  return current;
}

function ensureTime(current: CaseProgress, cost: number) {
  if (current.spent + cost > 15) throw new Error('Недостаточно времени: последние полчаса оставлены для итогового отчёта.');
}

function signatureValid(signature: string, mode: Mode) {
  if (!['typed', 'drawn'].includes(mode) || typeof signature !== 'string' || !signature.trim() || signature.length > 500000) throw new Error('Добавьте корректную подпись.');
  if (mode === 'typed' && signature.trim().length > 120) throw new Error('Текст подписи должен быть короче 120 символов.');
  if (mode === 'drawn' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(signature)) throw new Error('Не удалось прочитать изображение подписи. Нарисуйте её ещё раз.');
}

function log(state: CampaignState, caseId: CaseId, text: string) {
  state.journal.push({ id: `campaign-${state.journal.length + 1}`, caseId, day: state.cases[caseId].day, text });
}

function changeFunds(state: CampaignState, account: FinanceEntry['account'], amount: number, reason: string, opening = false) {
  if (!amount && !opening) return;
  if (!Number.isSafeInteger(amount) || state.stats[account] + amount < 0) throw new Error('Недопустимая финансовая операция.');
  state.stats[account] += amount;
  let ordinal = state.finances.length + 1;
  while (state.finances.some(entry => entry.id === `finance-${ordinal}`)) ordinal += 1;
  state.finances.push({ id: `finance-${ordinal}`, caseId: state.activeCase, day: state.cases[state.activeCase].day, account, amount, balance: state.stats[account], reason });
}

function applyEffects(state: CampaignState, effects: Effects = {}, financeReason?: string | Partial<Record<FinanceEntry['account'], string>>) {
  const beforeXp = state.stats.xp;
  for (const account of ['money', 'budget'] as const) {
    if (!effects[account]) continue;
    const reason = typeof financeReason === 'string' ? financeReason : financeReason?.[account];
    if (!reason) throw new Error('Для финансовой операции необходимо указать основание.');
    changeFunds(state, account, effects[account], reason);
  }
  for (const key of ['xp', 'reputation', 'integrity', 'corruption', 'stress', 'health', 'threat'] as const) {
    const amount = effects[key] ?? 0;
    state.stats[key] = key === 'xp' ? Math.max(0, state.stats[key] + amount) : bounded(state.stats[key] + amount);
  }
  state.stats.skillPoints += Math.max(0, Math.floor(state.stats.xp / 100) - Math.floor(beforeXp / 100));
  for (const id of CONTACT_IDS) state.relationships[id] = bounded(state.relationships[id] + (effects.relationships?.[id] ?? 0));
  state.flags = unique([...state.flags, ...(effects.flags ?? [])]);
}

function ensureFunds(state: CampaignState, effects: Effects = {}) {
  if (state.stats.money + (effects.money ?? 0) < 0) throw new Error('Недостаточно личных средств для этого решения.');
  if (state.stats.budget + (effects.budget ?? 0) < 0) throw new Error('Недостаточно средств служебного бюджета.');
}

function emptyCase(definition: CaseDefinition, available: boolean): CaseProgress {
  return { status: available ? 'investigating' : 'locked', day: 1, spent: 0, completedActions: [], evidence: [], selectedEvidence: [], pending: [], choices: {}, draft: Object.fromEntries(definition.formFields.map(field => [field.id, field.initial])), documents: [], result: null, courtAnswers: [], courtResult: null };
}

export function createCampaign(firstCase: GameState = createInitialState()): CampaignState {
  const state: CampaignState = {
    version: 2, profileName: firstCase.profileName, activeCase: '001', firstCase: structuredClone(firstCase),
    cases: Object.fromEntries(CASE_IDS.map(id => [id, emptyCase(getCase(id), id === '001')])) as Record<CaseId, CaseProgress>,
    stats: { money: 0, budget: 0, xp: 0, skillPoints: 3, reputation: 35, integrity: 70, corruption: 0, stress: 15, health: 90, threat: 5 },
    skills: Object.fromEntries(SKILL_IDS.map(id => [id, 1])) as Record<SkillId, number>,
    relationships: { volkova: 30, lebedeva: 30, mentor: 50, danilov: 30 }, upgrades: [], flags: [], contactVisits: [], events: [], journal: [], finances: [], chapterComplete: false,
  };
  changeFunds(state, 'money', 3000, 'Личные накопления к началу службы', true);
  changeFunds(state, 'budget', 2500, 'Начальное финансирование рабочего кабинета', true);
  return syncFirstCase(state, firstCase);
}

export function syncFirstCase(state: CampaignState, firstCase: GameState): CampaignState {
  if (state.firstCase === firstCase || state.cases['001'].result) return state;
  const previous = state.cases['001'];
  const completeEvidence = Object.entries(firstCase.evidence).filter(([, item]) => item.stage === 2).map(([id]) => id);
  if (previous.day === firstCase.day && previous.spent === firstCase.spent && !!previous.result === !!firstCase.ending && JSON.stringify(previous.evidence) === JSON.stringify(completeEvidence) && JSON.stringify(state.firstCase) === JSON.stringify(firstCase)) return state;
  const next = clone(state);
  next.firstCase = structuredClone(firstCase);
  next.profileName = firstCase.profileName;
  const current = next.cases['001'];
  current.day = firstCase.day;
  current.spent = firstCase.spent;
  current.completedActions = [...firstCase.completedActions];
  current.evidence = completeEvidence;
  current.selectedEvidence = unique(firstCase.selectedEvidence.filter(id => completeEvidence.includes(id)));
  if (firstCase.ending && !current.result) {
    current.result = { kind: firstCase.ending.kind, title: firstCase.ending.title, text: firstCase.ending.description, issues: [...firstCase.ending.issues] };
    current.status = 'court';
    if (firstCase.witnessApproach === 'support') applyEffects(next, { flags: ['witness_supported'], relationships: { danilov: 10 }, integrity: 3 });
    if (firstCase.witnessApproach === 'pressure') applyEffects(next, { flags: ['witness_pressured'], relationships: { danilov: -15 }, integrity: -8, stress: 5 });
    log(next, '001', 'Расследование «Последняя папка» передано на судебную проверку. Вознаграждение будет начислено после рассмотрения материалов.');
  }
  return next;
}

function costFor(state: CampaignState, caseId: string, actionId: string) {
  const action = getCase(caseId).actions.find(item => item.id === actionId);
  if (!action) return 0;
  return Math.max(1, action.cost - (action.skill && state.skills[action.skill] >= 2 ? 1 : 0) - (action.category === 'research' && state.upgrades.includes('scanner') ? 1 : 0));
}

export function getCampaignActionAvailability(state: CampaignState, caseId: string, actionId: string): CampaignAvailability {
  const definition = getCase(caseId);
  const current = progress(state, caseId);
  const action = definition.actions.find(item => item.id === actionId);
  const cost = costFor(state, caseId, actionId);
  const deny = (reason: string): CampaignAvailability => ({ allowed: false, completed: false, cost, reason });
  if (!action) return deny('Неизвестное действие.');
  if (current.completedActions.includes(actionId)) return { allowed: false, completed: true, cost, reason: 'Действие уже выполнено; результат сохранён в материалах.' };
  if (caseId === '001') return deny('Откройте интерфейс первого расследования.');
  if (state.activeCase !== caseId || current.status !== 'investigating') return deny('Расследование не открыто.');
  if (current.day < action.minDay) return deny(`Доступно с ${action.minDay}-го дня.`);
  if (action.deadline !== undefined && current.day > action.deadline) return deny('Срок получения этого материала истёк. Проверьте другие источники.');
  if (action.requires?.some(id => !current.completedActions.includes(id) && !current.evidence.includes(id))) return deny('Сначала выполните предшествующие действия и получите необходимые материалы.');
  if (current.spent + cost > 15) return deny('Недостаточно времени с учётом получаса на итоговый отчёт.');
  return { allowed: true, completed: false, cost };
}

export function performCampaignAction(state: CampaignState, caseId: string, actionId: string, choiceId?: string): CampaignState {
  const availability = getCampaignActionAvailability(state, caseId, actionId);
  if (availability.completed) return state;
  if (!availability.allowed) throw new Error(availability.reason);
  const definition = getCase(caseId);
  const action = definition.actions.find(item => item.id === actionId)!;
  const choice = action.choices?.find(item => item.id === choiceId);
  if (action.choices?.length && !choice) throw new Error('Выберите способ действия.');
  if (choiceId && !choice) throw new Error('Неизвестный вариант действия.');
  ensureFunds(state, choice?.effects);
  const next = clone(state);
  const current = next.cases[definition.id];
  current.spent += availability.cost;
  current.completedActions.push(actionId);
  if (choice) current.choices[actionId] = choice.id;
  const evidence = unique([...action.grants, ...(choice?.grants ?? [])]);
  const delay = Math.max(0, (action.delay ?? 0) - (state.upgrades.includes('computer') ? 1 : 0));
  if (delay && evidence.length) current.pending.push({ actionId, dueDay: current.day + delay, evidence });
  else current.evidence = unique([...current.evidence, ...evidence]);
  const skillLevel = action.skill ? state.skills[action.skill] : 1;
  const baseStress = action.category === 'interview' ? 3 : 2;
  const practiceXp = 2 * (skillLevel - 1);
  const actionStress = Math.max(0, baseStress - Math.floor((skillLevel - 1) / 2));
  applyEffects(next, { stress: actionStress, xp: practiceXp });
  applyEffects(next, choice?.effects, `${action.title}: ${choice?.label ?? 'решение по действию'}`);
  log(next, definition.id, `${action.title}. ${action.result}${choice ? ` ${choice.response}` : ''}${delay && evidence.length ? ` Материалы поступят в день ${current.day + delay}.` : ''}${practiceXp ? ` Применение навыка: +${practiceXp} опыта.` : ''}`);
  maybeEvents(next, definition.id);
  return next;
}

export function advanceCampaignDay(state: CampaignState, caseId: string): CampaignState {
  const old = investigating(state, caseId);
  if (old.day > 9997) throw new Error('Достигнут предельный срок расследования.');
  const next = clone(state);
  const id = caseId as CaseId;
  const current = next.cases[id];
  log(next, id, `Итог дня ${current.day}: ${current.completedActions.length} действий, ${current.evidence.length} материалов, ${current.pending.length} ожидаемых ответов. Полчаса зарезервировано для отчёта.`);
  const hospital = state.stats.health < 30;
  current.day += hospital ? 2 : 1;
  current.spent = 0;
  applyEffects(next, { stress: -(hospital ? 25 : 10) - (state.upgrades.includes('chair') ? 8 : 0), health: hospital ? 50 - state.stats.health : state.stats.stress >= 70 ? -10 : 3, threat: state.upgrades.includes('safe') ? -5 : 0 });
  if (!hospital && state.stats.threat >= 75) applyEffects(next, { health: -5, stress: 5 });
  if (hospital) log(next, id, 'Из-за истощения потребовалось лечение. Здоровье восстановлено до 50, пропущен дополнительный рабочий день; сроки запросов продолжали идти.');
  const received = current.pending.filter(item => item.dueDay <= current.day);
  current.evidence = unique([...current.evidence, ...received.flatMap(item => item.evidence)]);
  current.pending = current.pending.filter(item => item.dueDay > current.day);
  for (const item of received) log(next, id, `Получен ответ: ${getCase(id).actions.find(action => action.id === item.actionId)?.title ?? item.actionId}. Материалы: ${item.evidence.join(', ')}.`);
  log(next, id, `Начат день ${current.day}. ${state.upgrades.includes('chair') ? 'Удобное кресло помогло восстановиться. ' : ''}${state.upgrades.includes('safe') ? 'Материалы хранятся в сейфе; риск угроз снижен.' : ''}`);
  maybeEvents(next, id);
  return next;
}

export function updateCampaignDraft(state: CampaignState, caseId: string, field: string, value: string): CampaignState {
  const current = investigating(state, caseId);
  if (!getCase(caseId).formFields.some(item => item.id === field)) throw new Error('Неизвестное поле документа.');
  if (typeof value !== 'string' || value.length > 4000) throw new Error('Текст поля не должен превышать 4000 символов.');
  if (current.draft[field] === value) return state;
  const next = clone(state);
  next.cases[caseId as CaseId].draft[field] = value;
  return next;
}

function protocolText(state: CampaignState, caseId: string) {
  const definition = getCase(caseId);
  return `${definition.formTitle}\n${definition.formFields.map(field => `${field.label}: ${state.cases[definition.id].draft[field.id]}`).join('\n')}`;
}

function latestProtocol(current: CaseProgress) { return [...current.documents].reverse().find(doc => doc.kind === 'protocol'); }

function addDocument(state: CampaignState, caseId: CaseId, doc: Omit<CampaignDocument, 'id' | 'caseId' | 'day'>) {
  const current = state.cases[caseId];
  current.documents.push({ id: `${caseId}-doc-${current.documents.length + 1}`, caseId, day: current.day, ...doc });
}

export function signCampaignDocument(state: CampaignState, caseId: string, signature: string, mode: Mode): CampaignState {
  const current = investigating(state, caseId);
  signatureValid(signature, mode);
  const definition = getCase(caseId);
  if (!definition.actions.some(action => action.category === 'scene' && current.completedActions.includes(action.id))) throw new Error('Сначала осмотрите место события.');
  const text = protocolText(state, caseId);
  if (latestProtocol(current)?.text === text) return state;
  ensureTime(current, 1);
  const issues = definition.formFields.filter(field => current.draft[field.id].trim() !== field.correct.trim()).map(field => `${field.label}: значение расходится с источником «${field.source}».`);
  const next = clone(state);
  next.cases[definition.id].spent += 1;
  addDocument(next, definition.id, { kind: 'protocol', title: `${definition.formTitle}${latestProtocol(current) ? ' · исправленная версия' : ''}`, text, signature, mode, issues });
  log(next, definition.id, `${definition.formTitle} подписан. ${issues.length ? `Замечаний: ${issues.length}. Исправления можно оформить отдельной версией.` : 'Реквизиты соответствуют источникам.'} Предыдущие версии сохранены.`);
  return next;
}

export function assessCampaignCase(state: CampaignState, caseId: string, selected?: string[]): CaseAssessment {
  const definition = getCase(caseId);
  const current = progress(state, caseId);
  const included = selected ?? current.evidence;
  const hasRole = (role: string) => definition.evidence.some(item => item.role === role && included.includes(item.id) && current.evidence.includes(item.id));
  const event = hasRole('event');
  const link = hasRole('link');
  const context = hasRole('context');
  const documents = caseId === '001' ? !!state.firstCase.ending && !state.firstCase.ending.issues.some(issue => issue.startsWith('Оформление:')) : latestProtocol(current)?.issues.length === 0;
  const issues: string[] = [];
  if (!event) issues.push('Не подтверждён характер события: включите проверенный материал о том, что произошло.');
  if (!link) issues.push('Не подтверждена связь выбранного лица с событием: нужен независимый проверенный источник.');
  if (!context) issues.push('Не проверена альтернативная версия: включите оправдывающий контекст.');
  if (!documents) issues.push('Оформление: подпишите протокол с реквизитами, соответствующими источникам.');
  if (included.some(id => !current.evidence.includes(id))) issues.push('В пакет включён неполученный материал.');
  return { event, link, context, documents, issues };
}

export function submitCase(state: CampaignState, caseId: string, suspectId: string | 'close', selected: string[], signature: string, mode: Mode): CampaignState {
  const existing = progress(state, caseId);
  if (existing.result) return state;
  const current = investigating(state, caseId);
  const definition = getCase(caseId);
  if (current.day < 2) throw new Error('Итоговое решение доступно со второго дня. Дайте время независимой проверке.');
  signatureValid(signature, mode);
  if (suspectId !== 'close' && !definition.suspects.some(item => item.id === suspectId)) throw new Error('Выберите участника дела или прекращение проверки.');
  if (!Array.isArray(selected) || selected.some(id => !current.evidence.includes(id))) throw new Error('Выберите только полученные материалы.');
  if (current.spent + 1 > 16) throw new Error('Для итогового решения не осталось времени.');
  const assessment = assessCampaignCase(state, caseId, unique(selected));
  const kind = suspectId === 'close' ? 'closed' : suspectId !== definition.correctSuspect ? 'wrong' : assessment.issues.length ? 'weak' : 'strong';
  const outcomes = {
    strong: { title: 'Пакет готов к судебной проверке', text: 'Характер события, связь лица и альтернативная версия проверены. Суд рассмотрит пределы этих оснований; решение следователя не устанавливает виновность.' },
    weak: { title: 'В пакете остались пробелы', text: 'Выбранная версия требует дополнительных оснований. В судебной проверке потребуется объяснить недостающие материалы.' },
    wrong: { title: 'Связь выбранного лица не подтверждена', text: 'Имеющиеся материалы не подтверждают указанную вами версию участия. Ошибка будет отражена в проверке и архиве.' },
    closed: { title: 'Проверка прекращена', text: 'Противоречия и подписанные документы остаются в архиве. Решение о прекращении также проходит проверку.' },
  };
  const issues = [...assessment.issues];
  if (kind === 'wrong') issues.unshift('Независимые материалы не связывают выбранного человека с событием.');
  const next = clone(state);
  const updated = next.cases[definition.id];
  updated.spent += 1;
  updated.result = { kind, ...outcomes[kind], issues };
  updated.status = 'court';
  updated.choices.decision = suspectId;
  updated.selectedEvidence = unique(selected);
  addDocument(next, definition.id, { kind: 'decision', title: 'Итоговое решение', text: `Решение: ${suspectId === 'close' ? 'прекратить проверку' : definition.suspects.find(item => item.id === suspectId)!.name}.\nМатериалы: ${unique(selected).join(', ') || 'не выбраны'}.\n${outcomes[kind].text}`, signature, mode, issues });
  log(next, definition.id, `${outcomes[kind].title}. Подписанный пакет передан на рассмотрение.`);
  return next;
}

export function getSubmittedEvidence(state: CampaignState, caseId: string): string[] {
  const current = progress(state, caseId);
  return current.selectedEvidence.filter(id => current.evidence.includes(id));
}

export function answerCourt(state: CampaignState, caseId: string, optionId: string): CampaignState {
  const definition = getCase(caseId);
  const current = progress(state, caseId);
  if (current.courtAnswers.some(item => item.optionId === optionId) || current.status === 'resolved') return state;
  if (state.activeCase !== caseId || current.status !== 'court' || !current.result) throw new Error('Сначала передайте дело на судебную проверку.');
  const round = definition.court[current.courtAnswers.length];
  if (!round) throw new Error('Судебная проверка уже завершена.');
  const option = round.options.find(item => item.id === optionId);
  if (!option) throw new Error('Выберите ответ на текущий вопрос суда.');
  const submitted = getSubmittedEvidence(state, caseId);
  if (option.requiresEvidence?.some(id => !submitted.includes(id))) throw new Error('Для этого ответа нужны материалы, включённые в подписанный пакет.');
  const legalHelp = state.skills.law >= 3 && option.quality === 0 && !current.choices.law_assistance;
  const quality = legalHelp ? 1 : option.quality;
  const next = clone(state);
  const updated = next.cases[definition.id];
  if (legalHelp) updated.choices.law_assistance = round.id;
  updated.courtAnswers.push({ roundId: round.id, optionId, quality, response: `${option.response}${legalHelp ? ' Знание права помогло уточнить пределы ответа; бонус использован один раз за дело.' : ''}` });
  log(next, definition.id, `${round.speaker}: ${round.question} Ответ: ${option.label}. ${updated.courtAnswers.at(-1)!.response}`);
  if (updated.courtAnswers.length === definition.court.length) {
    const accepted = current.result.kind === 'strong' && updated.courtAnswers.reduce((sum, item) => sum + item.quality, 0) >= 2;
    const dismissed = ['wrong', 'closed'].includes(current.result.kind);
    const kind = accepted ? 'accepted' : dismissed ? 'dismissed' : 'returned';
    const courtResults = {
      accepted: { title: 'Материалы приняты к рассмотрению', text: 'Судебная проверка признала основания пригодными для дальнейшего рассмотрения. Обвинительный приговор этой проверкой не выносится.' },
      returned: { title: 'Материалы возвращены с замечаниями', text: 'Пробелы в основаниях или ответах зафиксированы. Дело передано для дополнительной проверки, а вы получаете следующее назначение.' },
      dismissed: { title: 'Решение не подтвердило обвинение', text: 'Проверка не установила достаточных оснований для обвинения. Подписанное решение и замечания сохраняются; новые дела доступны.' },
    };
    updated.courtResult = { kind, ...courtResults[kind] };
    updated.status = 'resolved';
    const xp = Math.round(definition.reward.xp * (accepted ? 1 : dismissed ? 0.5 : 0.75)) + (next.upgrades.includes('books') ? 20 : 0);
    applyEffects(next, { money: definition.reward.money, budget: definition.reward.budget, xp, reputation: accepted ? 10 : dismissed ? -10 : -4, stress: accepted ? -8 : 8, integrity: current.result.kind === 'wrong' ? -5 : accepted ? 2 : 0 }, { money: `Зарплата после завершения дела № ${definition.id} «${definition.title}»`, budget: `Пополнение служебного бюджета после дела № ${definition.id} «${definition.title}»` });
    log(next, definition.id, `${courtResults[kind].title}. Начислено: зарплата ${definition.reward.money} ₽, бюджет ${definition.reward.budget} ₽, опыт ${xp}. ${definition.link}`);
    const index = CASE_IDS.indexOf(definition.id);
    if (index < CASE_IDS.length - 1) next.cases[CASE_IDS[index + 1]].status = 'available';
    else { next.chapterComplete = true; log(next, definition.id, getChapterEnding(next).text); }
  }
  return next;
}

const EVENT_DEFINITIONS: CampaignEvent[] = [
  { id: 'witness-thanks', caseId: '004', title: 'Свидетель снова выходит на связь', text: 'Свидетель помнит спокойную проверку и поддержку. Он готов помочь восстановить доверие к следствию; прежняя помощь вернулась в новом деле.', selected: null, response: null, choices: [
    { id: 'safe-channel', label: 'Договориться о безопасной связи', response: 'Порядок связи согласован. Данилов доверяет вам; риск давления на свидетелей уменьшился.', effects: { threat: -10, relationships: { danilov: 12 }, integrity: 4, flags: ['trusted_witness_network'] } },
    { id: 'take-break', label: 'Поблагодарить и спокойно поговорить', response: 'Разговор вернул уверенность и помог снизить напряжение.', effects: { stress: -15, relationships: { danilov: 6 }, health: 4 } },
  ] },
  { id: 'bribe-audit', caseId: '005', title: 'Служебная проверка перевода', text: 'В деле № 003 вы приняли деньги. Платёж попал в служебную проверку. Теперь придётся ответить за прежнее решение.', selected: null, response: null, choices: [
    { id: 'restitute', label: 'Признать перевод и вернуть доступные средства', response: 'Признание и возврат зафиксированы. Полное доверие не восстановлено: проверка продолжится, но сокрытия не произошло.', effects: { integrity: 12, corruption: -20, reputation: -5, stress: 5, flags: ['bribe_disclosed'] } },
    { id: 'conceal', label: 'Скрыть происхождение денег', response: 'Проверка обнаружила противоречия. Репутация и доверие коллег пострадали; риск давления вырос.', effects: { integrity: -20, corruption: 20, reputation: -15, threat: 20, stress: 15, relationships: { mentor: -15 }, flags: ['audit_concealed'] } },
  ] },
  { id: 'threat-confrontation', caseId: '004', title: 'Давление у здания отдела', text: 'Накопившиеся угрозы перешли в прямой разговор у отдела. Выбор повлияет на безопасность и здоровье.', selected: null, response: null, choices: [
    { id: 'report', label: 'Вызвать дежурного и зафиксировать угрозу', response: 'Угроза оформлена; дежурный обеспечил сопровождение.', effects: { threat: -20, stress: 5, integrity: 3, flags: ['threat_logged'] } },
    { id: 'confront', label: 'Разобраться самостоятельно', response: 'Столкновение удалось прекратить, но оно потребовало сил. Физическая подготовка определяет последствия для здоровья.', effects: { threat: -5, stress: 12, flags: ['threat_confronted'] } },
  ] },
];

function maybeEvents(state: CampaignState, caseId: CaseId) {
  const add = (id: string) => {
    if (!state.events.some(item => item.id === id)) {
      const event = structuredClone(EVENT_DEFINITIONS.find(item => item.id === id)!);
      event.caseId = caseId;
      state.events.push(event);
      log(state, caseId, `Новое событие: ${event.title}.`);
    }
  };
  if (caseId === '004' && state.flags.includes('witness_supported')) add('witness-thanks');
  if (caseId === '005' && state.flags.includes('accepted_bribe')) add('bribe-audit');
  if (state.stats.threat >= 50) add('threat-confrontation');
}

export function openCase(state: CampaignState, caseId: string): CampaignState {
  const current = progress(state, caseId);
  if (state.activeCase === caseId && current.status !== 'locked' && current.status !== 'available') return state;
  if (current.status !== 'available') throw new Error('Дело пока недоступно. Сначала завершите судебную проверку предыдущего дела.');
  const index = CASE_IDS.indexOf(caseId as CaseId);
  if (index > 0 && state.cases[CASE_IDS[index - 1]].status !== 'resolved') throw new Error('Сначала завершите предыдущее дело.');
  const next = clone(state);
  next.activeCase = caseId as CaseId;
  next.cases[next.activeCase].status = 'investigating';
  log(next, next.activeCase, `Открыто дело № ${caseId}: ${getCase(caseId).title}. ${getCase(caseId).briefing}`);
  maybeEvents(next, next.activeCase);
  return next;
}

export function trainSkill(state: CampaignState, skillId: string): CampaignState {
  const definition = SKILLS.find(item => item.id === skillId);
  if (!definition) throw new Error('Неизвестный навык.');
  if (state.skills[definition.id] >= 5) throw new Error('Навык уже достиг пятого уровня.');
  if (state.stats.skillPoints < 1) throw new Error('Нет свободных очков навыка. Новое очко выдаётся за каждые 100 опыта.');
  const next = clone(state);
  next.stats.skillPoints -= 1;
  next.skills[definition.id] += 1;
  log(next, next.activeCase, `${definition.name}: уровень ${next.skills[definition.id]}. Потрачено одно очко навыка.`);
  return next;
}

export function buyUpgrade(state: CampaignState, upgradeId: string): CampaignState {
  const definition = UPGRADES.find(item => item.id === upgradeId);
  if (!definition) throw new Error('Неизвестное улучшение кабинета.');
  if (state.upgrades.includes(definition.id)) return state;
  if (state.stats[definition.account] < definition.price) throw new Error(definition.account === 'money' ? 'Недостаточно личных средств.' : 'Недостаточно средств служебного бюджета.');
  const next = clone(state);
  changeFunds(next, definition.account, -definition.price, `Покупка для кабинета: ${definition.name}`);
  next.upgrades.push(definition.id);
  log(next, next.activeCase, `Куплено: ${definition.name}, ${definition.price} ₽ (${definition.account === 'money' ? 'личные средства' : 'служебный бюджет'}). ${definition.effect}`);
  return next;
}

export function contactCharacter(state: CampaignState, contactId: string, choiceId: string): CampaignState {
  const definition = CONTACTS.find(item => item.id === contactId);
  if (!definition) throw new Error('Неизвестный контакт.');
  if (state.contactVisits.some(key => key.startsWith(`${state.activeCase}:${contactId}:`))) return state;
  const choice = definition.choices.find(item => item.id === choiceId);
  if (!choice) throw new Error('Выберите тему разговора.');
  const current = state.cases[state.activeCase];
  const costsTime = state.activeCase !== '001' && current.status === 'investigating';
  if (costsTime) ensureTime(current, 1);
  ensureFunds(state, choice.effects);
  const next = clone(state);
  if (costsTime) next.cases[next.activeCase].spent += 1;
  next.contactVisits.push(`${state.activeCase}:${contactId}:${choiceId}`);
  next.cases[next.activeCase].choices[`contact:${contactId}`] = choiceId;
  applyEffects(next, choice.effects, `${definition.name}: ${choice.label}`);
  log(next, next.activeCase, `${definition.name}: ${choice.label}. ${choice.response}`);
  maybeEvents(next, next.activeCase);
  return next;
}

export function getCareerGoals(state: CampaignState): CareerGoal[] {
  const goals = [
    { id: 'first-case', title: 'Первое назначение', description: 'Завершите одно расследование вместе с судебной проверкой.', progress: CASE_IDS.filter(id => state.cases[id].status === 'resolved').length, target: 1, rewardText: '+500 ₽ личных средств' },
    { id: 'trusted-work', title: 'Надёжные основания', description: 'Подготовьте два сильных пакета, принятых судом.', progress: CASE_IDS.filter(id => state.cases[id].result?.kind === 'strong' && state.cases[id].courtResult?.kind === 'accepted').length, target: 2, rewardText: '+1 000 ₽ служебного бюджета' },
    { id: 'equipped-office', title: 'Рабочее место', description: 'Установите три улучшения кабинета.', progress: state.upgrades.length, target: 3, rewardText: '+30 опыта' },
    { id: 'reliable-circle', title: 'Люди рядом', description: 'Достигните доверия 50 у двух персонажей.', progress: CONTACT_IDS.filter(id => state.relationships[id] >= 50).length, target: 2, rewardText: '+30 опыта · −10 стресса' },
  ];
  return goals.map(goal => ({ ...goal, progress: Math.min(goal.progress, goal.target), claimed: state.flags.includes(`career:${goal.id}`) }));
}

export function claimCareerGoal(state: CampaignState, goalId: string): CampaignState {
  const goal = getCareerGoals(state).find(item => item.id === goalId);
  if (!goal) throw new Error('Неизвестная цель развития.');
  if (goal.claimed) return state;
  if (goal.progress < goal.target) throw new Error('Сначала выполните условия цели развития.');
  const rewards: Record<string, Effects> = {
    'first-case': { money: 500 },
    'trusted-work': { budget: 1000 },
    'equipped-office': { xp: 30 },
    'reliable-circle': { xp: 30, stress: -10 },
  };
  const next = clone(state);
  applyEffects(next, { ...rewards[goalId], flags: [`career:${goalId}`] }, `Награда за цель развития «${goal.title}»`);
  log(next, next.activeCase, `Цель развития «${goal.title}» выполнена. Получено: ${goal.rewardText}.`);
  return next;
}

const SUPPORT: Record<ContactId, { title: string; description: string; stat: 'stress' | 'xp' | 'threat'; amount: number; label: string }> = {
  volkova: { title: 'Спокойный разговор', description: 'Анастасия помогает перевести дух после напряжённой работы.', stat: 'stress', amount: -12, label: 'стресса' },
  lebedeva: { title: 'Совет по расчётам', description: 'Марина делится общими приёмами организации расчётов. Этот разговор не добавляет доказательств по делу.', stat: 'xp', amount: 10, label: 'опыта' },
  mentor: { title: 'Разбор практики', description: 'Громов разбирает с вами учебный пример и помогает закрепить профессиональные навыки.', stat: 'xp', amount: 20, label: 'опыта' },
  danilov: { title: 'Безопасная связь', description: 'Сергей помогает согласовать безопасный порядок связи и снизить риск давления.', stat: 'threat', amount: -10, label: 'угрозы' },
};

export function getContactSupport(state: CampaignState, contactId: string): ContactSupport {
  if (!CONTACT_IDS.includes(contactId as ContactId)) throw new Error('Неизвестный контакт.');
  const id = contactId as ContactId;
  const definition = SUPPORT[id];
  const current = state.cases[state.activeCase];
  const requiredTrust = 50;
  const cost = 1;
  const used = state.flags.includes(`support:${state.activeCase}:${id}`);
  const amount = definition.amount * (state.relationships[id] >= 75 ? 2 : 1);
  const reason = used ? 'Поддержка уже получена в этом деле.'
    : state.activeCase === '001' || current.status !== 'investigating' ? 'Поддержка доступна во время расследования дел № 002–005.'
    : state.relationships[id] < requiredTrust ? `Необходимо доверие ${requiredTrust}. Сейчас: ${state.relationships[id]}.`
    : current.spent + cost > 15 ? 'Недостаточно времени: последние полчаса оставлены для итогового отчёта.'
    : undefined;
  return { title: definition.title, description: definition.description, effectText: `${amount > 0 ? '+' : '−'}${Math.abs(amount)} ${definition.label}`, requiredTrust, available: !reason, used, reason, cost };
}

export function requestContactSupport(state: CampaignState, contactId: string): CampaignState {
  const support = getContactSupport(state, contactId);
  if (support.used) return state;
  if (!support.available) throw new Error(support.reason);
  const id = contactId as ContactId;
  const definition = SUPPORT[id];
  const next = clone(state);
  next.cases[next.activeCase].spent += support.cost;
  applyEffects(next, { [definition.stat]: definition.amount * (state.relationships[id] >= 75 ? 2 : 1), flags: [`support:${state.activeCase}:${id}`] });
  log(next, next.activeCase, `${CONTACTS.find(contact => contact.id === id)!.name}: ${support.title}. ${support.description} Получено: ${support.effectText}. Затрачено 30 минут.`);
  return next;
}

export function resolveCampaignEvent(state: CampaignState, eventId: string, choiceId: string): CampaignState {
  const event = state.events.find(item => item.id === eventId);
  if (!event) throw new Error('Событие не найдено.');
  if (event.selected) return state;
  const choice = event.choices.find(item => item.id === choiceId);
  if (!choice) throw new Error('Выберите решение события.');
  ensureFunds(state, choice.effects);
  const next = clone(state);
  const updated = next.events.find(item => item.id === eventId)!;
  updated.selected = choiceId;
  updated.response = choice.response;
  applyEffects(next, choice.effects, `${event.title}: ${choice.label}`);
  if (eventId === 'bribe-audit' && choiceId === 'restitute') {
    const repay = Math.min(next.stats.money, 6000);
    changeFunds(next, 'money', -repay, 'Возврат незаконного перевода по результатам служебной проверки');
    updated.response += ` Возвращено ${repay} ₽ из личных средств.`;
    if (repay < 6000) { applyEffects(next, { reputation: -3, flags: ['audit_debt'] }); updated.response += ' Непогашенный остаток зафиксирован в служебной проверке.'; }
  }
  if (eventId === 'threat-confrontation' && choiceId === 'confront') applyEffects(next, { health: next.skills.fitness >= 3 ? -5 : -25 });
  log(next, event.caseId, `${event.title}. ${choice.label}. ${updated.response}`);
  return next;
}

export function getRank(state: CampaignState): string {
  if (state.stats.xp >= 650) return 'Старший следователь';
  if (state.stats.xp >= 350) return 'Следователь';
  if (state.stats.xp >= 100) return 'Младший следователь';
  return 'Стажёр следственного отдела';
}

export function getChapterEnding(state: CampaignState): { title: string; text: string } {
  const accepted = CASE_IDS.filter(id => state.cases[id].courtResult?.kind === 'accepted').length;
  if (!state.chapterComplete) return { title: 'Первая половина истории', text: `Судебную проверку прошли ${CASE_IDS.filter(id => state.cases[id].status === 'resolved').length} из пяти дел. Предыдущие решения будут влиять на следующие встречи.` };
  if (state.flags.includes('audit_concealed') || state.flags.includes('evidence_concealed') || (state.flags.includes('accepted_bribe') && !state.flags.includes('bribe_disclosed')) || state.stats.corruption >= 40) return { title: 'Цена компромисса', text: `Первая половина кампании завершена. Принято пакетов: ${accepted} из 5. Скрытые платежи и уступки оставили след, а служебные вопросы требуют ответа. Во второй половине придётся отвечать за сохранённые решения.` };
  if (accepted >= 4 && state.stats.integrity >= 65 && !state.flags.includes('audit_debt') && !state.flags.includes('pressure_unreported')) return { title: 'Доверие к подписи', text: `Первая половина кампании завершена. Принято пакетов: ${accepted} из 5. Коллеги доверяют вашему архиву, свидетели готовы снова говорить. Связь дел приводит к следующему уровню расследования; окончательный исход ещё впереди.` };
  return { title: 'Незакрытые вопросы', text: `Первая половина кампании завершена. Принято пакетов: ${accepted} из 5. Возвраты, ошибки и сохранённые версии вошли в служебный архив. Следующая глава продолжит историю с этими последствиями.` };
}

export function parseCampaignSave(raw: string): CampaignState {
  const fail = (): never => { throw new Error('Сохранение кампании повреждено или имеет неподдерживаемый формат.'); };
  if (typeof raw !== 'string' || raw.length > 25000000) return fail();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fail(); }
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = (v: unknown, max = 4000): v is string => typeof v === 'string' && v.length <= max;
  const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  const list = (v: unknown, test: (item: unknown) => boolean, max = 5000): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(test);
  const ids = (v: unknown, valid: readonly string[], max = 1000) => list(v, item => typeof item === 'string' && valid.includes(item), max) && new Set(v).size === v.length;
  const enumOf = (v: unknown, options: readonly unknown[]) => options.includes(v);
  const recordKeys = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
  const validSignature = (v: unknown, mode: unknown) => { try { signatureValid(v as string, mode as Mode); return true; } catch { return false; } };
  if (!object(value)) return fail();
  if (value.version === 1) return createCampaign(parseSave(raw));
  if (value.version !== 2 || !str(value.profileName, 120) || !enumOf(value.activeCase, CASE_IDS) || typeof value.chapterComplete !== 'boolean') return fail();
  let firstCase: GameState;
  try { firstCase = parseSave(JSON.stringify(value.firstCase)); } catch { return fail(); }
  if (!object(value.stats) || !recordKeys(value.stats, ['money', 'budget', 'xp', 'skillPoints', 'reputation', 'integrity', 'corruption', 'stress', 'health', 'threat'])) return fail();
  for (const key of ['money', 'budget', 'xp', 'skillPoints']) if (!int(value.stats[key], 0, 1000000000)) return fail();
  for (const key of ['reputation', 'integrity', 'corruption', 'stress', 'health', 'threat']) if (!int(value.stats[key], 0, 100)) return fail();
  if (!object(value.skills) || !recordKeys(value.skills, SKILL_IDS) || SKILL_IDS.some(id => !int((value.skills as Record<string, unknown>)[id], 1, 5))) return fail();
  if (!object(value.relationships) || !recordKeys(value.relationships, CONTACT_IDS) || CONTACT_IDS.some(id => !int((value.relationships as Record<string, unknown>)[id], 0, 100))) return fail();
  if (!ids(value.upgrades, UPGRADE_IDS, 6) || !list(value.flags, item => str(item, 100), 200) || new Set(value.flags).size !== value.flags.length) return fail();
  const validVisit = (v: unknown) => {
    if (!str(v, 200)) return false;
    const [caseId, contactId, choiceId, extra] = v.split(':');
    return isCaseId(caseId) && !extra && !!CONTACTS.find(contact => contact.id === contactId)?.choices.some(choice => choice.id === choiceId);
  };
  if (!list(value.contactVisits, validVisit, 20) || new Set(value.contactVisits.map(item => (item as string).split(':').slice(0, 2).join(':'))).size !== value.contactVisits.length) return fail();
  if (!object(value.cases) || !recordKeys(value.cases, CASE_IDS)) return fail();
  for (const caseId of CASE_IDS) {
    const current = value.cases[caseId];
    const definition = getCase(caseId);
    if (!object(current) || !enumOf(current.status, ['locked', 'available', 'investigating', 'court', 'resolved']) || !int(current.day, 1, 10000) || !int(current.spent, 0, 16)) return fail();
    const day = current.day;
    const evidenceIds = caseId === '001' ? ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08'] : definition.evidence.map(item => item.id);
    const actionIds = caseId === '001' ? firstCase.completedActions : definition.actions.map(item => item.id);
    if (!ids(current.completedActions, actionIds) || !ids(current.evidence, evidenceIds, 30)) return fail();
    if (!object(current.draft) || !recordKeys(current.draft, definition.formFields.map(item => item.id)) || Object.values(current.draft).some(item => !str(item))) return fail();
    if (!object(current.choices) || Object.keys(current.choices).length > 50 || Object.entries(current.choices).some(([key, item]) => !str(key, 100) || !str(item, 100))) return fail();
    for (const [key, choiceId] of Object.entries(current.choices)) {
      if (key === 'decision') { if (choiceId !== 'close' && !definition.suspects.some(item => item.id === choiceId)) return fail(); }
      else if (key === 'law_assistance') { if (!definition.court.some(item => item.id === choiceId)) return fail(); }
      else if (key.startsWith('contact:')) { if (!CONTACTS.find(contact => contact.id === key.slice(8))?.choices.some(choice => choice.id === choiceId)) return fail(); }
      else if (!definition.actions.find(action => action.id === key)?.choices?.some(choice => choice.id === choiceId)) return fail();
    }
    if (!list(current.pending, item => object(item) && str(item.actionId, 100) && definition.actions.some(action => action.id === item.actionId) && (current.completedActions as string[]).includes(item.actionId) && int(item.dueDay, day + 1, day + 20) && ids(item.evidence, evidenceIds, 30), 20)) return fail();
    if (new Set(current.pending.map(item => (item as { actionId: string }).actionId)).size !== current.pending.length) return fail();
    if (!list(current.documents, doc => object(doc) && str(doc.id, 100) && doc.caseId === caseId && enumOf(doc.kind, ['protocol', 'decision', 'court']) && int(doc.day, 1, day) && str(doc.title) && str(doc.text, 25000) && validSignature(doc.signature, doc.mode) && list(doc.issues, item => str(item), 100))) return fail();
    if (new Set(current.documents.map(item => (item as { id: string }).id)).size !== current.documents.length) return fail();
    let signedSelection: string[] = [];
    if (caseId === '001') signedSelection = unique(firstCase.selectedEvidence.filter(id => (current.evidence as string[]).includes(id)));
    else if (current.result !== null) {
      const decision = [...current.documents].reverse().find(item => (item as CampaignDocument).kind === 'decision') as CampaignDocument | undefined;
      const selectedLine = decision?.text.match(/^Материалы: (.*)\.$/m)?.[1];
      if (!selectedLine) return fail();
      signedSelection = selectedLine === 'не выбраны' ? [] : selectedLine.split(', ').map(id => id.trim());
    }
    if (current.selectedEvidence === undefined) current.selectedEvidence = signedSelection;
    if (!ids(current.selectedEvidence, evidenceIds, 30) || (current.selectedEvidence as string[]).some(id => !(current.evidence as string[]).includes(id))) return fail();
    if (JSON.stringify(current.selectedEvidence) !== JSON.stringify(signedSelection)) return fail();
    if (current.result === null && (current.selectedEvidence as string[]).length) return fail();
    if (current.result !== null && (!object(current.result) || !enumOf(current.result.kind, ['strong', 'weak', 'wrong', 'closed']) || !str(current.result.title) || !str(current.result.text, 20000) || !list(current.result.issues, item => str(item), 100))) return fail();
    if (!list(current.courtAnswers, answer => object(answer) && str(answer.roundId, 100) && str(answer.optionId, 100) && str(answer.response, 20000) && int(answer.quality, -1, 1), 3)) return fail();
    for (let index = 0; index < current.courtAnswers.length; index += 1) {
      const answer = current.courtAnswers[index] as Record<string, unknown>;
      const round = definition.court[index];
      const option = round?.options.find(item => item.id === answer.optionId);
      if (answer.roundId !== round?.id || !option || (answer.quality !== option.quality && !(option.quality === 0 && answer.quality === 1 && current.choices.law_assistance === round.id))) return fail();
      if (option.requiresEvidence?.some(id => !(current.selectedEvidence as string[]).includes(id))) return fail();
    }
    if (current.courtResult !== null && (!object(current.courtResult) || !enumOf(current.courtResult.kind, ['accepted', 'returned', 'dismissed']) || !str(current.courtResult.title) || !str(current.courtResult.text, 20000))) return fail();
    const finished = current.status === 'resolved';
    if (finished !== (current.courtResult !== null) || finished !== (current.courtAnswers.length === definition.court.length)) return fail();
    if ((current.status === 'court' || finished) !== (current.result !== null)) return fail();
    if (!current.result && current.courtAnswers.length) return fail();
    if (current.spent === 16 && !current.result) return fail();
    if (caseId === '001' && (!!firstCase.ending !== (current.result !== null) || current.day !== firstCase.day || current.spent !== firstCase.spent || JSON.stringify(current.evidence) !== JSON.stringify(Object.entries(firstCase.evidence).filter(([, item]) => item.stage === 2).map(([id]) => id)))) return fail();
    if (caseId === '001' && JSON.stringify(current.selectedEvidence) !== JSON.stringify(unique(firstCase.selectedEvidence.filter(id => (current.evidence as string[]).includes(id))))) return fail();
  }
  const cases = value.cases as unknown as CampaignState['cases'];
  for (let index = 1; index < CASE_IDS.length; index += 1) {
    const unlocked = cases[CASE_IDS[index]].status !== 'locked';
    if (unlocked !== (cases[CASE_IDS[index - 1]].status === 'resolved')) return fail();
  }
  if (CASE_IDS.filter(id => ['investigating', 'court'].includes(cases[id].status)).length > 1 || ['locked', 'available'].includes(cases[value.activeCase as CaseId].status)) return fail();
  if (CASE_IDS.some(id => ['investigating', 'court'].includes(cases[id].status) && value.activeCase !== id)) return fail();
  if (value.chapterComplete !== (cases['005'].status === 'resolved')) return fail();
  if (value.finances === undefined) {
    value.finances = (['money', 'budget'] as const).map((account, index) => ({ id: `finance-${index + 1}`, caseId: value.activeCase, day: cases[value.activeCase as CaseId].day, account, amount: (value.stats as Record<string, number>)[account], balance: (value.stats as Record<string, number>)[account], reason: 'Остаток при переносе сохранения' }));
  }
  if (!list(value.finances, entry => object(entry) && str(entry.id, 100) && !!entry.id.trim() && enumOf(entry.caseId, CASE_IDS) && int(entry.day, 1, cases[entry.caseId as CaseId].day) && enumOf(entry.account, ['money', 'budget']) && int(entry.amount, -1000000000, 1000000000) && int(entry.balance, 0, 1000000000) && str(entry.reason) && !!entry.reason.trim(), 10000)) return fail();
  const finances = value.finances as unknown as FinanceEntry[];
  if (new Set(finances.map(entry => entry.id)).size !== finances.length) return fail();
  const balances = { money: 0, budget: 0 };
  const accounts = new Set<string>();
  let previousDate = 0;
  for (const entry of finances) {
    const caseIndex = CASE_IDS.indexOf(entry.caseId);
    const date = caseIndex * 10001 + entry.day;
    if (caseIndex > CASE_IDS.indexOf(value.activeCase as CaseId) || date < previousDate || ['locked', 'available'].includes(cases[entry.caseId].status)) return fail();
    previousDate = date;
    balances[entry.account] += entry.amount;
    if (balances[entry.account] !== entry.balance || balances[entry.account] < 0) return fail();
    accounts.add(entry.account);
  }
  if (accounts.size !== 2 || balances.money !== value.stats.money || balances.budget !== value.stats.budget) return fail();
  if (!list(value.journal, item => object(item) && str(item.id, 100) && enumOf(item.caseId, CASE_IDS) && int(item.day, 1, cases[item.caseId as CaseId].day) && str(item.text, 25000), 15000)) return fail();
  if (!list(value.events, item => {
    if (!object(item) || !str(item.id, 100) || !enumOf(item.caseId, CASE_IDS) || !str(item.title) || !str(item.text, 20000) || !(item.response === null || str(item.response, 20000))) return false;
    const original = EVENT_DEFINITIONS.find(event => event.id === item.id);
    if (!original || !Array.isArray(item.choices) || JSON.stringify(item.choices) !== JSON.stringify(original.choices)) return false;
    return item.selected === null ? item.response === null : original.choices.some(choice => choice.id === item.selected) && typeof item.response === 'string';
  }, 3) || new Set(value.events.map(item => (item as { id: string }).id)).size !== value.events.length) return fail();
  return { ...value, firstCase } as unknown as CampaignState;
}
