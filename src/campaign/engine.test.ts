import { describe, expect, it } from 'vitest';
import { createInitialState, endDay, finishCase, performAction, signDocument, updateDraft } from '../game/engine';
import type { EvidenceId, GameState } from '../game/types';
import { CASES, CONTACTS, UPGRADES } from './content';
import { advanceCampaignDay, answerCourt, assessCampaignCase, buyUpgrade, claimCareerGoal, contactCharacter, createCampaign, getCampaignActionAvailability, getCareerGoals, getChapterEnding, getContactSupport, getRank, getSubmittedEvidence, openCase, parseCampaignSave, performCampaignAction, requestContactSupport, resolveCampaignEvent, signCampaignDocument, submitCase, syncFirstCase, trainSkill, updateCampaignDraft } from './engine';
import type { CampaignState, CaseId, ContactId } from './types';

const signature = 'Алексей Морозов';
const nextLegacyDay = (state: GameState) => endDay(state, 'intervention', 'Проверить независимые источники.', signature, 'typed');

function finishFirstCase(): GameState {
  let state = createInitialState();
  for (const id of ['inspect', 'interview-volkova', 'preserve-camera', 'prepare-expert']) state = performAction(state, id);
  state = updateDraft(state, 'inspection', { patronymic: 'Андреевич', date: '2026-09-14', attachedPhotos: 4 });
  state = signDocument(state, 'inspection', signature, 'typed');
  state = signDocument(state, 'expert', signature, 'typed');
  for (const id of ['request-access', 'request-print', 'interview-guard', 'support-witness']) state = performAction(state, id);
  state = nextLegacyDay(state);
  for (const id of ['clarify-volkova', 'contact-accountant', 'verify-finance', 'question-orlov']) state = performAction(state, id);
  state = nextLegacyDay(state);
  state = performAction(state, 'reinterview-guard');
  state = nextLegacyDay(state);
  return finishCase(state, 'orlov', Object.keys(state.evidence) as EvidenceId[], signature, 'typed');
}

function court(state: CampaignState, quality: 'good' | 'bad' = 'good'): CampaignState {
  const definition = CASES.find(item => item.id === state.activeCase)!;
  for (const round of definition.court) {
    const options = round.options.filter(option => option.requiresEvidence?.every(id => getSubmittedEvidence(state, state.activeCase).includes(id)) ?? true);
    const option = [...options].sort((a, b) => quality === 'good' ? b.quality - a.quality : a.quality - b.quality)[0];
    state = answerCourt(state, state.activeCase, option.id);
  }
  return state;
}

function firstResolved() { return court(createCampaign(finishFirstCase())); }

function investigate(state: CampaignState, caseId: CaseId, preferFlag?: string): CampaignState {
  state = openCase(state, caseId);
  const definition = CASES.find(item => item.id === caseId)!;
  for (let day = 0; day < 8; day += 1) {
    for (const action of definition.actions) {
      if (!getCampaignActionAvailability(state, caseId, action.id).allowed) continue;
      const choice = action.choices?.find(item => preferFlag && item.effects?.flags?.includes(preferFlag)) ?? action.choices?.[0];
      state = performCampaignAction(state, caseId, action.id, choice?.id);
    }
    const current = state.cases[caseId];
    if (current.completedActions.length === definition.actions.length && !current.pending.length && current.day >= 2) break;
    state = advanceCampaignDay(state, caseId);
  }
  for (const field of definition.formFields) state = updateCampaignDraft(state, caseId, field.id, field.correct);
  if (state.cases[caseId].spent >= 15) state = advanceCampaignDay(state, caseId);
  state = signCampaignDocument(state, caseId, signature, 'typed');
  return state;
}

function submitStrong(state: CampaignState, caseId: CaseId) {
  const definition = CASES.find(item => item.id === caseId)!;
  return submitCase(state, caseId, definition.correctSuspect, state.cases[caseId].evidence, signature, 'typed');
}

describe('первая половина кампании', () => {
  it('сохраняет первое расследование и проходит пять последовательных дел до итогов главы', () => {
    const first = finishFirstCase();
    let state = createCampaign(first);
    expect(state.firstCase).toEqual(first);
    expect(state.cases['001'].status).toBe('court');
    expect(state.stats.xp).toBe(0);
    expect(() => openCase(state, '002')).toThrow('предыдущего');
    expect(syncFirstCase(state, structuredClone(first))).toBe(state);
    state = court(state);
    expect(state.cases['001'].courtResult?.kind).toBe('accepted');
    for (const id of ['002', '003', '004', '005'] as CaseId[]) {
      state = investigate(state, id);
      expect(assessCampaignCase(state, id).issues).toEqual([]);
      state = submitStrong(state, id);
      expect(state.cases[id].result?.kind).toBe('strong');
      state = court(state);
      expect(state.cases[id].courtResult?.kind).toBe('accepted');
      expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
    }
    expect(state.chapterComplete).toBe(true);
    expect(getChapterEnding(state).title).toBe('Доверие к подписи');
    expect(state.stats.skillPoints).toBe(3 + Math.floor(state.stats.xp / 100));
    expect(getRank(state)).not.toContain('Стажёр');
    expect(state.events.some(item => item.id === 'witness-thanks')).toBe(true);
  });

  it('не начисляет награды повторно и не принимает повторный ответ за следующий раунд', () => {
    let state = createCampaign(finishFirstCase());
    const round = CASES[0].court[0];
    const option = round.options.find(item => item.quality === 1)!;
    const before = JSON.stringify(state);
    const answered = answerCourt(state, '001', option.id);
    expect(JSON.stringify(state)).toBe(before);
    expect(answerCourt(answered, '001', option.id)).toBe(answered);
    expect(answered.cases['001'].courtAnswers).toHaveLength(1);
    state = court(state);
    const finalOption = CASES[0].court[2].options[0].id;
    expect(answerCourt(state, '001', finalOption)).toBe(state);
    expect(syncFirstCase(state, structuredClone(state.firstCase))).toBe(state);
    expect(syncFirstCase(state, createInitialState())).toBe(state);
  });

  it('не раскрывает полные тексты по предварительным материалам первого дела', () => {
    const initial = createCampaign();
    expect(initial.cases['001'].evidence).toEqual([]);
    expect(initial.firstCase.evidence.E04?.stage).toBe(1);
    const inspected = performAction(initial.firstCase, 'inspect');
    const bridged = syncFirstCase(initial, inspected);
    expect(bridged.cases['001'].evidence).not.toContain('E01');
    expect(bridged.cases['001'].evidence).not.toContain('E03');
    expect(bridged.firstCase.evidence.E01).toEqual(inspected.evidence.E01);
    expect(parseCampaignSave(JSON.stringify(bridged))).toEqual(bridged);
  });

  it('возвращает слабый пакет и продолжает кампанию после ошибки и прекращения проверки', () => {
    const prepared = investigate(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const withoutContext = prepared.cases['002'].evidence.filter(id => definition.evidence.find(item => item.id === id)?.role !== 'context');
    const weak = submitCase(prepared, '002', definition.correctSuspect, withoutContext, signature, 'typed');
    expect(weak.cases['002'].result?.kind).toBe('weak');
    expect(court(weak).cases['002'].courtResult?.kind).toBe('returned');
    const wrongPerson = definition.suspects.find(item => item.id !== definition.correctSuspect)!;
    const wrong = court(submitCase(prepared, '002', wrongPerson.id, prepared.cases['002'].evidence, signature, 'typed'));
    expect(wrong.cases['002'].courtResult?.kind).toBe('dismissed');
    expect(wrong.cases['003'].status).toBe('available');
    const closed = court(submitCase(prepared, '002', 'close', [], signature, 'typed'));
    expect(closed.cases['002'].courtResult?.kind).toBe('dismissed');
    expect(openCase(closed, '003').activeCase).toBe('003');
  });

  it('сохраняет оригинал подписанного протокола и требует новую подпись для исправленной версии', () => {
    let state = openCase(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const scene = definition.actions.find(item => item.category === 'scene')!;
    state = performCampaignAction(state, '002', scene.id, scene.choices?.[0]?.id);
    const signed = signCampaignDocument(state, '002', signature, 'typed');
    const original = structuredClone(signed.cases['002'].documents[0]);
    expect(original.issues.length).toBeGreaterThan(0);
    let edited = signed;
    for (const field of definition.formFields) edited = updateCampaignDraft(edited, '002', field.id, field.correct);
    expect(edited.cases['002'].documents[0]).toEqual(original);
    expect(assessCampaignCase(edited, '002').documents).toBe(false);
    const amended = signCampaignDocument(edited, '002', 'Исправленная подпись', 'typed');
    expect(amended.cases['002'].documents).toHaveLength(2);
    expect(amended.cases['002'].documents[0]).toEqual(original);
    expect(assessCampaignCase(amended, '002').documents).toBe(true);
    expect(signCampaignDocument(amended, '002', signature, 'typed')).toBe(amended);
    expect(() => signCampaignDocument(state, '002', 'data:image/svg+xml,<script/>', 'drawn')).toThrow('изображение');
    expect(parseCampaignSave(JSON.stringify(amended))).toEqual(amended);
  });

  it('позволяет ссылаться в суде только на материалы подписанного пакета и сохраняет исключения при миграции', () => {
    const prepared = investigate(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const firstRound = definition.court[0];
    const factual = firstRound.options.find(item => item.quality === 1)!;
    const omitted = factual.requiresEvidence![0];
    const selected = prepared.cases['002'].evidence.filter(id => id !== omitted);
    const submitted = submitCase(prepared, '002', definition.correctSuspect, selected, signature, 'typed');
    expect(submitted.cases['002'].evidence).toContain(omitted);
    expect(getSubmittedEvidence(submitted, '002')).not.toContain(omitted);
    expect(submitted.cases['002'].result?.kind).toBe('weak');
    expect(() => answerCourt(submitted, '002', factual.id)).toThrow('подписанный пакет');
    expect(court(submitted).cases['002'].courtResult?.kind).toBe('returned');
    expect(parseCampaignSave(JSON.stringify(submitted))).toEqual(submitted);
    const changedSelection = structuredClone(submitted);
    changedSelection.cases['002'].selectedEvidence.push(omitted);
    expect(() => parseCampaignSave(JSON.stringify(changedSelection))).toThrow('Сохранение');
    const older = JSON.parse(JSON.stringify(submitted));
    for (const id of Object.keys(older.cases)) delete older.cases[id].selectedEvidence;
    const migrated = parseCampaignSave(JSON.stringify(older));
    expect(migrated.cases['002'].selectedEvidence).toEqual(selected);
    expect(getSubmittedEvidence(migrated, '002')).not.toContain(omitted);
    expect(() => answerCourt(migrated, '002', factual.id)).toThrow('подписанный пакет');
    const decision = older.cases['002'].documents.find((doc: { kind: string }) => doc.kind === 'decision');
    decision.text = decision.text.replace(selected.join(', '), 'unknown-evidence');
    expect(() => parseCampaignSave(JSON.stringify(older))).toThrow('Сохранение');
  });

  it('расходует очки навыков и нужный кошелёк, применяет улучшения без повторной покупки', () => {
    let state = createCampaign();
    const original = JSON.stringify(state);
    state = trainSkill(state, 'law');
    expect(state.skills.law).toBe(2);
    expect(state.stats.skillPoints).toBe(2);
    expect(JSON.stringify(createCampaign())).toBe(original);
    state = trainSkill(trainSkill(state, 'law'), 'attention');
    expect(() => trainSkill(state, 'fitness')).toThrow('очков');
    const affordable = UPGRADES.find(item => item.price <= state.stats[item.account])!;
    const balance = state.stats[affordable.account];
    const purchased = buyUpgrade(state, affordable.id);
    expect(purchased.stats[affordable.account]).toBe(balance - affordable.price);
    expect(buyUpgrade(purchased, affordable.id)).toBe(purchased);
    expect(() => buyUpgrade({ ...state, stats: { ...state.stats, money: 0, budget: 0 } }, affordable.id)).toThrow('Недостаточно');
    expect(parseCampaignSave(JSON.stringify(purchased))).toEqual(purchased);
  });

  it('даёт опыт и снижает усталость за применение развитого навыка без повторного начисления', () => {
    const beginner = openCase(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const action = definition.actions.find(item => item.category === 'scene' && item.skill)!;
    let expert = beginner;
    for (let level = 1; level < 5; level += 1) expert = trainSkill(expert, action.skill!);
    expect(expert.skills[action.skill!]).toBe(5);
    const practiced = performCampaignAction(expert, '002', action.id);
    const inexperienced = performCampaignAction(beginner, '002', action.id);
    expect(inexperienced.stats.xp - beginner.stats.xp).toBe(0);
    expect(inexperienced.stats.stress - beginner.stats.stress).toBe(2);
    expect(practiced.stats.xp - expert.stats.xp).toBe(8);
    expect(practiced.stats.stress - expert.stats.stress).toBe(0);
    expect(performCampaignAction(practiced, '002', action.id)).toBe(practiced);
    expect(practiced.journal.at(-1)?.text).toContain('+8 опыта');
    expect(parseCampaignSave(JSON.stringify(practiced))).toEqual(practiced);
  });

  it('резервирует время отчёта, исключает повторное действие и ждёт ответы экспертизы', () => {
    let state = openCase(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const scene = definition.actions.find(item => item.category === 'scene')!;
    state = performCampaignAction(state, '002', scene.id, scene.choices?.[0]?.id);
    expect(performCampaignAction(state, '002', scene.id, scene.choices?.[0]?.id)).toBe(state);
    const research = definition.actions.find(item => item.delay && getCampaignActionAvailability(state, '002', item.id).allowed)!;
    const requested = performCampaignAction(state, '002', research.id, research.choices?.[0]?.id);
    expect(requested.cases['002'].pending).toHaveLength(1);
    expect(requested.cases['002'].evidence).not.toContain(research.grants[0]);
    const tomorrow = advanceCampaignDay(requested, '002');
    expect(tomorrow.cases['002'].evidence).toContain(research.grants[0]);
    const fullDay = structuredClone(state);
    fullDay.cases['002'].spent = 15;
    expect(getCampaignActionAvailability(fullDay, '002', research.id).allowed).toBe(false);
    expect(() => performCampaignAction(fullDay, '002', research.id)).toThrow('получаса');
    expect(advanceCampaignDay(fullDay, '002').cases['002'].spent).toBe(0);
    expect(() => submitCase(state, '002', definition.correctSuspect, [], signature, 'typed')).toThrow('второго');
  });

  it('снижает стоимость действий навыком и сканером, а компьютер ускоряет запрос', () => {
    let state = openCase(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const scene = definition.actions.find(item => item.category === 'scene')!;
    state = performCampaignAction(state, '002', scene.id, scene.choices?.[0]?.id);
    const research = definition.actions.find(item => item.delay && getCampaignActionAvailability(state, '002', item.id).allowed)!;
    const enhanced = structuredClone(state);
    enhanced.upgrades = ['scanner', 'computer'];
    if (research.skill) enhanced.skills[research.skill] = 2;
    expect(getCampaignActionAvailability(enhanced, '002', research.id).cost).toBe(Math.max(1, research.cost - 1 - (research.skill ? 1 : 0)));
    const received = performCampaignAction(enhanced, '002', research.id, research.choices?.[0]?.id);
    expect(received.cases['002'].pending).toHaveLength(0);
    expect(received.cases['002'].evidence).toContain(research.grants[0]);
  });

  it('закрывает окно личного разговора после срока, сохраняя путь к основным материалам', () => {
    let state = openCase(firstResolved(), '002');
    const definition = CASES.find(item => item.id === '002')!;
    const limited = definition.actions.find(item => item.deadline)!;
    expect(limited.grants).toEqual([]);
    for (const id of limited.requires ?? []) {
      const prerequisite = definition.actions.find(item => item.id === id)!;
      state = performCampaignAction(state, '002', id, prerequisite.choices?.[0]?.id);
    }
    expect(getCampaignActionAvailability(state, '002', limited.id).allowed).toBe(true);
    while (state.cases['002'].day <= limited.deadline!) state = advanceCampaignDay(state, '002');
    expect(getCampaignActionAvailability(state, '002', limited.id).reason).toContain('истёк');
    expect(() => performCampaignAction(state, '002', limited.id, limited.choices?.[0]?.id)).toThrow('истёк');
    const scene = definition.actions.find(item => item.category === 'scene')!;
    state = performCampaignAction(state, '002', scene.id);
    const recording = definition.actions.find(item => item.grants.some(id => definition.evidence.find(evidence => evidence.id === id)?.role === 'link'))!;
    expect(getCampaignActionAvailability(state, '002', recording.id).allowed).toBe(true);
  });

  it('применяет юридическую помощь только один раз и начисляет опыт библиотеки один раз за дело', () => {
    const base = createCampaign(finishFirstCase());
    let skilled = buyUpgrade(trainSkill(trainSkill(base, 'law'), 'law'), 'books');
    let unskilled = base;
    const definition = CASES[0];
    definition.court.forEach((round, index) => {
      const option = round.options.find(item => item.quality === (index === 2 ? 1 : 0))!;
      skilled = answerCourt(skilled, '001', option.id);
      unskilled = answerCourt(unskilled, '001', option.id);
    });
    expect(skilled.cases['001'].courtAnswers.map(item => item.quality)).toEqual([1, 0, 1]);
    expect(skilled.cases['001'].courtResult?.kind).toBe('accepted');
    expect(unskilled.cases['001'].courtResult?.kind).toBe('returned');
    expect(skilled.stats.xp).toBe(definition.reward.xp + 20);
    expect(parseCampaignSave(JSON.stringify(skilled))).toEqual(skilled);
  });

  it('учитывает здоровье, стресс, сейф и кресло при смене дня', () => {
    const state = openCase(firstResolved(), '002');
    const exhausted = structuredClone(state);
    exhausted.stats.health = 20;
    exhausted.stats.stress = 80;
    exhausted.stats.threat = 60;
    exhausted.upgrades = ['chair', 'safe'];
    const recovered = advanceCampaignDay(exhausted, '002');
    expect(recovered.cases['002'].day).toBe(3);
    expect(recovered.stats).toMatchObject({ health: 50, stress: 47, threat: 55 });
    expect(recovered.events.some(item => item.id === 'threat-confrontation')).toBe(true);
    const careful = resolveCampaignEvent(recovered, 'threat-confrontation', 'report');
    expect(careful.stats.threat).toBe(35);
    expect(resolveCampaignEvent(careful, 'threat-confrontation', 'confront')).toBe(careful);
    const reckless = resolveCampaignEvent(recovered, 'threat-confrontation', 'confront');
    expect(reckless.stats.health).toBe(25);
  });

  it('не даёт повторно улучшать отношения одним разговором и сохраняет ответ', () => {
    let state = openCase(firstResolved(), '002');
    const contact = CONTACTS[0];
    const choice = contact.choices.find(item => !item.effects?.money || item.effects.money >= -state.stats.money)!;
    const previous = state.cases['002'].spent;
    state = contactCharacter(state, contact.id, choice.id);
    expect(state.cases['002'].spent).toBe(previous + 1);
    expect(state.cases['002'].choices[`contact:${contact.id}`]).toBe(choice.id);
    expect(state.contactVisits).toContain(`002:${contact.id}:${choice.id}`);
    expect(contactCharacter(state, contact.id, contact.choices[1].id)).toBe(state);
    expect(state.journal.at(-1)?.text).toContain(choice.response);
    expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
  });

  it('возвращает взятку последующим событием и не повторяет списание денег', () => {
    let state = court(submitStrong(investigate(firstResolved(), '002'), '002'));
    state = court(submitStrong(investigate(state, '003', 'accepted_bribe'), '003'));
    expect(state.flags).toContain('accepted_bribe');
    expect(state.finances.find(entry => entry.amount === 6000)).toMatchObject({ account: 'money', caseId: '003' });
    expect(state.finances.find(entry => entry.amount === 6000)?.reason).toContain('разобраться тихо');
    state = court(submitStrong(investigate(state, '004'), '004'));
    state = openCase(state, '005');
    expect(state.events.some(item => item.id === 'bribe-audit')).toBe(true);
    const money = state.stats.money;
    const disclosed = resolveCampaignEvent(state, 'bribe-audit', 'restitute');
    expect(disclosed.stats.money).toBe(money - Math.min(money, 6000));
    expect(disclosed.finances.at(-1)).toMatchObject({ account: 'money', amount: -Math.min(money, 6000), balance: disclosed.stats.money });
    expect(disclosed.finances.at(-1)?.reason).toContain('Возврат незаконного перевода');
    expect(disclosed.flags).toContain('bribe_disclosed');
    expect(resolveCampaignEvent(disclosed, 'bribe-audit', 'restitute')).toBe(disclosed);
    const concealed = resolveCampaignEvent(state, 'bribe-audit', 'conceal');
    expect(concealed.stats.reputation).toBeLessThan(state.stats.reputation);
    expect(concealed.flags).toContain('audit_concealed');
    expect(parseCampaignSave(JSON.stringify(disclosed))).toEqual(disclosed);
    const ignored = court(submitStrong(investigate(state, '005'), '005'));
    expect(getChapterEnding(ignored).title).toBe('Цена компромисса');
    const betrayed = court(submitStrong(investigate(disclosed, '005', 'evidence_concealed'), '005'));
    expect(betrayed.finances.find(entry => entry.amount === 4000 && entry.reason.includes('скрыть сведения'))).toMatchObject({ account: 'money', caseId: '005' });
    expect(betrayed.cases['005'].courtResult?.kind).toBe('accepted');
    expect(getChapterEnding(betrayed).title).toBe('Цена компромисса');
  });

  it('мигрирует старые сохранения и отклоняет повреждённые вложенные данные без изменения прогресса', () => {
    for (const first of [createInitialState(), finishFirstCase()]) {
      const migrated = parseCampaignSave(JSON.stringify(first));
      expect(migrated.firstCase).toEqual(first);
      expect(migrated.stats.xp).toBe(0);
      expect(parseCampaignSave(JSON.stringify(migrated))).toEqual(migrated);
    }
    const state = investigate(firstResolved(), '002');
    const bad: unknown[] = ['{', null, {}, { ...state, stats: { ...state.stats, health: 101 } }, { ...state, skills: { ...state.skills, law: 0 } }, { ...state, firstCase: {} }, { ...state, activeCase: '005' }];
    const wrongEvidence = structuredClone(state);
    wrongEvidence.cases['002'].evidence.push('fake-evidence');
    bad.push(wrongEvidence);
    const wrongDoc = structuredClone(state);
    wrongDoc.cases['002'].documents[0].signature = '<script/>';
    wrongDoc.cases['002'].documents[0].mode = 'drawn';
    bad.push(wrongDoc);
    const wrongRound = structuredClone(state);
    wrongRound.cases['001'].courtAnswers[1].roundId = 'fake-round';
    bad.push(wrongRound);
    const repeated = structuredClone(state);
    repeated.cases['002'].completedActions.push(repeated.cases['002'].completedActions[0]);
    bad.push(repeated);
    for (const value of bad) expect(() => parseCampaignSave(typeof value === 'string' ? value : JSON.stringify(value))).toThrow('Сохранение');
    expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
  });

  it('выдаёт награды за завершённые дела и кабинет один раз при выполнении фактических условий', () => {
    const initial = createCampaign();
    expect(() => claimCareerGoal(initial, 'first-case')).toThrow('условия');
    expect(() => claimCareerGoal(initial, 'unknown')).toThrow('Неизвестная');
    expect(getCareerGoals(createCampaign(finishFirstCase())).find(goal => goal.id === 'first-case')?.progress).toBe(0);
    const resolved = firstResolved();
    let state = claimCareerGoal(resolved, 'first-case');
    expect(state.stats.money).toBe(resolved.stats.money + 500);
    expect(state.stats.budget).toBe(resolved.stats.budget);
    expect(state.finances.at(-1)).toMatchObject({ account: 'money', amount: 500, balance: state.stats.money });
    expect(claimCareerGoal(state, 'first-case')).toBe(state);
    expect(() => claimCareerGoal(state, 'trusted-work')).toThrow('условия');
    state = court(submitStrong(investigate(state, '002'), '002'));
    const beforeBudget = state.stats.budget;
    state = claimCareerGoal(state, 'trusted-work');
    expect(state.stats.budget).toBe(beforeBudget + 1000);
    expect(state.finances.at(-1)).toMatchObject({ account: 'budget', amount: 1000 });
    expect(claimCareerGoal(state, 'trusted-work')).toBe(state);
    state = buyUpgrade(buyUpgrade(state, 'lamp'), 'chair');
    expect(() => claimCareerGoal(state, 'equipped-office')).toThrow('условия');
    state = buyUpgrade(state, 'scanner');
    const beforeXp = state.stats.xp;
    const beforePoints = state.stats.skillPoints;
    state = claimCareerGoal(state, 'equipped-office');
    expect(state.stats.xp).toBe(beforeXp + 30);
    expect(state.stats.skillPoints).toBe(beforePoints + Math.floor(state.stats.xp / 100) - Math.floor(beforeXp / 100));
    expect(claimCareerGoal(state, 'equipped-office')).toBe(state);
    expect(getCareerGoals(state).filter(goal => goal.claimed)).toHaveLength(3);
    expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
  });

  it('сохраняет награду за круг доверия после последующей потери отношений', () => {
    let state = contactCharacter(firstResolved(), 'danilov', 'danilov-check');
    state = openCase(state, '002');
    expect(getCareerGoals(state).find(goal => goal.id === 'reliable-circle')?.progress).toBe(1);
    expect(() => claimCareerGoal(state, 'reliable-circle')).toThrow('условия');
    state = contactCharacter(state, 'danilov', 'danilov-check');
    expect(state.relationships.danilov).toBe(52);
    const before = state.stats;
    state = claimCareerGoal(state, 'reliable-circle');
    expect(state.stats.xp).toBe(before.xp + 30);
    expect(state.stats.stress).toBe(Math.max(0, before.stress - 10));
    state = performCampaignAction(state, '002', '002-witness');
    state = performCampaignAction(state, '002', '002-support', 'dismiss');
    expect(state.relationships.danilov).toBe(47);
    expect(getCareerGoals(state).find(goal => goal.id === 'reliable-circle')).toMatchObject({ progress: 1, claimed: true });
    const restored = parseCampaignSave(JSON.stringify(state));
    expect(claimCareerGoal(restored, 'reliable-circle')).toBe(restored);
  });

  it('поддержка учитывает доверие 50 и 75, даёт реальный эффект и не создаёт доказательств', () => {
    const start = openCase(firstResolved(), '002');
    const effects: [ContactId, 'stress' | 'xp' | 'threat', number][] = [['volkova', 'stress', -12], ['lebedeva', 'xp', 10], ['mentor', 'xp', 20], ['danilov', 'threat', -10]];
    for (const [contactId, stat, amount] of effects) {
      const locked = structuredClone(start);
      locked.relationships[contactId] = 49;
      expect(getContactSupport(locked, contactId)).toMatchObject({ available: false, requiredTrust: 50, cost: 1, used: false });
      expect(() => requestContactSupport(locked, contactId)).toThrow('доверие 50');
      for (const trust of [50, 74, 75]) {
        const before = structuredClone(start);
        before.relationships[contactId] = trust;
        before.stats.stress = 60;
        before.stats.threat = 40;
        const original = JSON.stringify(before);
        const supported = requestContactSupport(before, contactId);
        expect(supported.stats[stat] - before.stats[stat]).toBe(amount * (trust >= 75 ? 2 : 1));
        expect(supported.cases['002'].spent).toBe(before.cases['002'].spent + 1);
        expect(supported.cases['002'].evidence).toEqual(before.cases['002'].evidence);
        expect(supported.cases['002'].pending).toEqual(before.cases['002'].pending);
        expect(supported.flags).toContain(`support:002:${contactId}`);
        expect(getContactSupport(supported, contactId)).toMatchObject({ available: false, used: true });
        expect(requestContactSupport(supported, contactId)).toBe(supported);
        expect(JSON.stringify(before)).toBe(original);
        expect(parseCampaignSave(JSON.stringify(supported))).toEqual(supported);
      }
    }
  });

  it('резервирует полчаса на отчёт при поддержке и открывает новую помощь только в следующем расследовании', () => {
    const first = firstResolved();
    expect(getContactSupport(first, 'mentor').available).toBe(false);
    expect(() => requestContactSupport(first, 'mentor')).toThrow('002–005');
    const active = openCase(first, '002');
    const full = structuredClone(active);
    full.cases['002'].spent = 15;
    expect(getContactSupport(full, 'mentor').available).toBe(false);
    expect(() => requestContactSupport(full, 'mentor')).toThrow('полчаса');
    full.cases['002'].spent = 14;
    const supported = requestContactSupport(full, 'mentor');
    expect(supported.cases['002'].spent).toBe(15);
    const tomorrow = advanceCampaignDay(supported, '002');
    expect(requestContactSupport(tomorrow, 'mentor')).toBe(tomorrow);
    const prepared = investigate(tomorrow, '002');
    const submitted = submitStrong(prepared, '002');
    const unhelped = structuredClone(submitted);
    unhelped.flags = unhelped.flags.filter(flag => flag !== 'support:002:mentor');
    expect(() => requestContactSupport(unhelped, 'mentor')).toThrow('002–005');
    const nextCase = openCase(court(submitted), '003');
    expect(getContactSupport(nextCase, 'mentor').available).toBe(true);
    const helpedAgain = requestContactSupport(nextCase, 'mentor');
    expect(helpedAgain.stats.xp).toBe(nextCase.stats.xp + 20);
    expect(helpedAgain.flags).toEqual(expect.arrayContaining(['support:002:mentor', 'support:003:mentor']));
    expect(parseCampaignSave(JSON.stringify(helpedAgain))).toEqual(helpedAgain);
  });

  it('ведёт отдельные цепочки денег и бюджета для зарплаты, покупок, встреч и наград', () => {
    let state = createCampaign(finishFirstCase());
    expect(state.finances.map(entry => [entry.account, entry.amount, entry.balance])).toEqual([['money', 3000, 3000], ['budget', 2500, 2500]]);
    state = buyUpgrade(state, 'lamp');
    state = buyUpgrade(state, 'scanner');
    state = contactCharacter(state, 'volkova', 'volkova-coffee');
    state = claimCareerGoal(court(state), 'first-case');
    expect(state.finances.filter(entry => entry.account === 'money').map(entry => entry.amount)).toEqual([3000, -600, -250, 2000, 500]);
    expect(state.finances.filter(entry => entry.account === 'budget').map(entry => entry.amount)).toEqual([2500, -1800, 1500]);
    expect(state.stats.money).toBe(4650);
    expect(state.stats.budget).toBe(2200);
    expect(state.finances.find(entry => entry.amount === -600)?.reason).toContain('Настольная лампа');
    expect(state.finances.find(entry => entry.amount === -250)?.reason).toContain('Волкова');
    expect(state.finances.find(entry => entry.amount === 2000)?.reason).toContain('Зарплата');
    expect(state.finances.find(entry => entry.amount === 1500)?.reason).toContain('служебного бюджета');
    expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
  });

  it('мигрирует старую кампанию в текущие остатки без выдуманной финансовой истории', () => {
    const state = contactCharacter(buyUpgrade(openCase(firstResolved(), '002'), 'lamp'), 'lebedeva', 'lebedeva-lunch');
    const old = JSON.parse(JSON.stringify(state));
    delete old.finances;
    const migrated = parseCampaignSave(JSON.stringify(old));
    expect(migrated.finances).toHaveLength(2);
    expect(migrated.finances).toEqual(['money', 'budget'].map((account, index) => ({ id: `finance-${index + 1}`, caseId: '002', day: state.cases['002'].day, account, amount: state.stats[account as 'money' | 'budget'], balance: state.stats[account as 'money' | 'budget'], reason: 'Остаток при переносе сохранения' })));
    expect(migrated.stats).toEqual(state.stats);
    expect(parseCampaignSave(JSON.stringify(buyUpgrade(migrated, 'chair'))).stats.money).toBe(state.stats.money - 1200);
    old.stats.money = 0;
    old.stats.budget = 0;
    const emptyAccounts = parseCampaignSave(JSON.stringify(old));
    expect(emptyAccounts.finances.map(entry => entry.amount)).toEqual([0, 0]);
    expect(parseCampaignSave(JSON.stringify(emptyAccounts))).toEqual(emptyAccounts);
  });

  it('отклоняет повреждённые счета, числа, даты, цепочки остатков и итоги финансового журнала', () => {
    const state = buyUpgrade(openCase(firstResolved(), '002'), 'lamp');
    const corruptions: ((copy: CampaignState) => void)[] = [
      copy => { copy.finances = []; },
      copy => { copy.finances[0].account = 'unknown' as 'money'; },
      copy => { copy.finances[0].amount = 3000.5; },
      copy => { copy.finances[0].amount = Infinity; },
      copy => { copy.finances[0].balance = -1; },
      copy => { copy.finances[0].day = 0; },
      copy => { copy.finances[0].day = copy.cases['001'].day + 1; },
      copy => { copy.finances[0].caseId = '005'; },
      copy => { copy.finances[0].reason = ' '; },
      copy => { copy.finances[1].id = copy.finances[0].id; },
      copy => { copy.finances[2].balance += 1; },
      copy => { copy.finances[2].amount += 1; },
      copy => { copy.stats.money += 1; },
      copy => { copy.finances[0].day = 4; },
      copy => { copy.finances.splice(-1); },
    ];
    for (const corrupt of corruptions) {
      const copy = structuredClone(state);
      corrupt(copy);
      expect(() => parseCampaignSave(JSON.stringify(copy))).toThrow('Сохранение');
    }
    expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
  });
});
