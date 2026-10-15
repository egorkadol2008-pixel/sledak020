import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { CASES, CONTACTS, UPGRADES } from '../src/campaign/content';
import { advanceCampaignDay, answerCourt, createCampaign, getCampaignActionAvailability, openCase, parseCampaignSave, performCampaignAction, signCampaignDocument, submitCase, updateCampaignDraft } from '../src/campaign/engine';
import type { CampaignState, CaseAction, CaseId } from '../src/campaign/types';
import { createInitialState, endDay, finishCase, performAction, signDocument, updateDraft } from '../src/game/engine';
import type { EvidenceId, GameState } from '../src/game/types';

const SAVE_KEY = 'sk-materialy-dela-campaign-v2';
const LEGACY_KEY = 'sk-materialy-dela-v1';
const signature = 'Алексей Морозов';

// The old prototype already has its own complete browser walkthrough. This
// fixture represents that player's actual export, before campaign migration.
function finishedLegacy(): GameState {
  let state = createInitialState();
  const nextDay = () => { state = endDay(state, 'intervention', 'Проверить независимые источники.', signature, 'typed'); };
  for (const id of ['inspect', 'interview-volkova', 'preserve-camera', 'prepare-expert']) state = performAction(state, id);
  state = updateDraft(state, 'inspection', { patronymic: 'Андреевич', date: '2026-09-14', attachedPhotos: 4 });
  state = signDocument(state, 'inspection', signature, 'typed');
  state = signDocument(state, 'expert', signature, 'typed');
  for (const id of ['request-access', 'request-print', 'interview-guard', 'support-witness']) state = performAction(state, id);
  nextDay();
  for (const id of ['clarify-volkova', 'contact-accountant', 'verify-finance', 'question-orlov']) state = performAction(state, id);
  nextDay();
  state = performAction(state, 'reinterview-guard');
  nextDay();
  return finishCase(state, 'orlov', Object.keys(state.evidence) as EvidenceId[], signature, 'typed');
}

async function seed(page: Page, state: GameState | CampaignState) {
  await page.goto('/');
  await page.evaluate(({ key, raw }) => {
    localStorage.removeItem('sk-materialy-dela-campaign-v2');
    localStorage.removeItem('sk-materialy-dela-v1');
    localStorage.setItem(key, raw);
  }, { key: state.version === 1 ? LEGACY_KEY : SAVE_KEY, raw: JSON.stringify(state) });
  await page.reload();
  await expect.poll(async () => (await saved(page)).version).toBe(2);
}

async function saved(page: Page): Promise<CampaignState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), SAVE_KEY);
}

async function capture(page: Page, filename: string) {
  const dismiss = page.getByRole('button', { name: 'Скрыть уведомление', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `test-results/${filename}`, fullPage: true });
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

async function navigate(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Кампания и развитие', exact: true }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

async function caseTab(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Разделы расследования', exact: true }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

async function sign(page: Page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Ввести имя', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Имя или инициалы следователя', exact: true }).fill(signature);
  await dialog.getByRole('button', { name: 'Подписать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function perform(page: Page, action: CaseAction, preferredFlag?: string) {
  await page.getByRole('button', { name: new RegExp(`^${action.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
  const dialog = page.getByRole('dialog', { name: action.title, exact: true });
  const choice = action.choices?.find(item => preferredFlag && item.effects?.flags?.includes(preferredFlag)) ?? action.choices?.[0];
  await dialog.getByRole('button', { name: choice?.label ?? 'Выполнить действие', exact: true }).click();
  await expect(dialog).toContainText(action.result);
  await dialog.getByRole('button', { name: 'Продолжить расследование', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function finishCourtUI(page: Page, caseId: CaseId, screenshot = false) {
  const definition = CASES.find(item => item.id === caseId)!;
  for (const [index, round] of definition.court.entries()) {
    await expect(page.getByRole('heading', { name: round.question, exact: true })).toBeVisible();
    if (screenshot && index === 0) await capture(page, 'court.png');
    const option = round.options.find(item => item.quality === 1)!;
    // The letter preceding the option is part of its accessible name.
    await page.getByRole('button').filter({ hasText: option.label }).click();
    await expect.poll(async () => (await saved(page)).cases[caseId].courtAnswers.length).toBe(index + 1);
  }
  const state = await saved(page);
  expect(state.cases[caseId].courtResult?.kind).toBe('accepted');
  expect(state.cases[caseId].status).toBe('resolved');
  expect(parseCampaignSave(JSON.stringify(state))).toEqual(state);
}

async function openCaseUI(page: Page, caseId: CaseId) {
  await navigate(page, 'Кампания');
  await page.getByRole('button', { name: `Открыть: ${CASES.find(item => item.id === caseId)!.title}`, exact: true }).click();
  await expect.poll(async () => (await saved(page)).activeCase).toBe(caseId);
}

async function investigateUI(page: Page, caseId: CaseId, preferredFlag?: string) {
  const definition = CASES.find(item => item.id === caseId)!;
  await caseTab(page, 'Расследование');
  for (let day = 0; day < 8; day += 1) {
    for (const action of definition.actions) {
      const button = page.getByRole('button').filter({ has: page.locator('strong', { hasText: action.title }) });
      if (await button.isEnabled()) await perform(page, action, preferredFlag);
    }
    const current = (await saved(page)).cases[caseId];
    if (current.completedActions.length === definition.actions.length && !current.pending.length && current.day >= 2) break;
    await page.getByRole('button', { name: 'Завершить день', exact: true }).click();
    await expect.poll(async () => (await saved(page)).cases[caseId].day).toBeGreaterThan(current.day);
  }
  const investigated = (await saved(page)).cases[caseId];
  expect(investigated.completedActions).toHaveLength(definition.actions.length);
  expect(investigated.evidence).toHaveLength(definition.evidence.length);
  expect(investigated.pending).toEqual([]);

  await caseTab(page, 'Материалы');
  const source = definition.evidence[0];
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: source.title, exact: true }) }).click();
  await expect(page.getByRole('dialog', { name: source.title, exact: true })).toContainText(source.body);
  await page.getByRole('button', { name: 'Закрыть окно', exact: true }).click();
  if (investigated.spent >= 15) await page.getByRole('button', { name: 'Завершить день', exact: true }).click();
  await caseTab(page, 'Документы');
  for (const field of definition.formFields) await page.getByRole('textbox', { name: field.label, exact: true }).fill(field.correct);
  await page.getByRole('button', { name: 'Подписать протокол', exact: true }).click();
  await sign(page);
  const protocol = (await saved(page)).cases[caseId].documents[0];
  expect(protocol.signature).toBe(signature);
  expect(protocol.issues).toEqual([]);
  await caseTab(page, 'Решение и суд');
  const suspect = definition.suspects.find(item => item.id === definition.correctSuspect)!;
  await page.getByRole('radio', { name: new RegExp(suspect.name) }).check();
  for (const evidence of definition.evidence) await page.getByRole('checkbox', { name: evidence.title, exact: true }).check();
  await page.getByRole('button', { name: 'Подписать и передать в суд', exact: true }).click();
  await sign(page);
  expect((await saved(page)).cases[caseId].result?.kind).toBe('strong');
  await finishCourtUI(page, caseId);
}

function resolveFixtureCourt(state: CampaignState): CampaignState {
  for (const round of CASES.find(item => item.id === state.activeCase)!.court) state = answerCourt(state, state.activeCase, round.options.find(option => option.quality === 1)!.id);
  return state;
}

// Isolated entry point for the corruption branch; main test walks every new
// investigation through the browser. This fixture only skips cases 001–002.
function beforeThirdCase(): CampaignState {
  let state = openCase(resolveFixtureCourt(createCampaign(finishedLegacy())), '002');
  const definition = CASES[1];
  for (let day = 0; day < 8; day += 1) {
    for (const action of definition.actions) if (getCampaignActionAvailability(state, '002', action.id).allowed) state = performCampaignAction(state, '002', action.id, action.choices?.[0]?.id);
    if (state.cases['002'].completedActions.length === definition.actions.length && !state.cases['002'].pending.length && state.cases['002'].day >= 2) break;
    state = advanceCampaignDay(state, '002');
  }
  for (const field of definition.formFields) state = updateCampaignDraft(state, '002', field.id, field.correct);
  if (state.cases['002'].spent >= 15) state = advanceCampaignDay(state, '002');
  state = signCampaignDocument(state, '002', signature, 'typed');
  return resolveFixtureCourt(submitCase(state, '002', definition.correctSuspect, state.cases['002'].evidence, signature, 'typed'));
}

async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

test('кампания: миграция первого дела, четыре новых расследования и пятнадцать судебных раундов', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const legacy = finishedLegacy();
  await seed(page, legacy);
  expect((await saved(page)).firstCase).toEqual(legacy);
  expect((await saved(page)).cases['001'].status).toBe('court');
  await expect(page.getByRole('button', { name: `Недоступно: ${CASES[1].title}`, exact: true })).toBeDisabled();
  await capture(page, 'campaign-desktop.png');
  await page.getByRole('button', { name: 'Перейти к судебному заседанию', exact: true }).click();
  await finishCourtUI(page, '001', true);
  for (const caseId of ['002', '003', '004', '005'] as CaseId[]) {
    await openCaseUI(page, caseId);
    await investigateUI(page, caseId);
  }
  await page.getByRole('button', { name: 'Итоги главы', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Доверие к подписи', exact: true })).toBeVisible();
  const completed = await saved(page);
  expect(completed.chapterComplete).toBe(true);
  expect(completed.events.some(event => event.id === 'witness-thanks')).toBe(true);
  expect(Object.values(completed.cases).every(item => item.courtAnswers.length === 3 && item.status === 'resolved')).toBe(true);
  await page.reload();
  expect(await saved(page)).toEqual(completed);
  await navigate(page, 'Личный архив');
  await page.getByRole('combobox', { name: 'Показать дело', exact: true }).selectOption('005');
  await expect(page.getByRole('region', { name: 'Архив подписанных документов' })).toContainText(CASES[4].formTitle);
  expect(errors).toEqual([]);
});

test('развитие: очки навыка, два бюджета, стоимость действий, контакты и экспорт всей кампании', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, resolveFixtureCourt(createCampaign(finishedLegacy())));
  await openCaseUI(page, '002');
  const initial = await saved(page);
  await navigate(page, 'Следователь');
  const skillCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Криминалистика', exact: true }) });
  await skillCard.getByRole('button', { name: 'Развить · 1 очко', exact: true }).click();
  expect((await saved(page)).skills.forensics).toBe(2);
  expect((await saved(page)).stats.skillPoints).toBe(initial.stats.skillPoints - 1);

  await navigate(page, 'Мой кабинет');
  for (const upgradeId of ['lamp', 'scanner'] as const) {
    const upgrade = UPGRADES.find(item => item.id === upgradeId)!;
    const before = await saved(page);
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: upgrade.name, exact: true }) });
    await card.getByRole('button', { name: 'Приобрести', exact: true }).click();
    const after = await saved(page);
    expect(after.stats[upgrade.account]).toBe(before.stats[upgrade.account] - upgrade.price);
    expect(after.stats[upgrade.account === 'money' ? 'budget' : 'money']).toBe(before.stats[upgrade.account === 'money' ? 'budget' : 'money']);
    await expect(card.getByRole('button', { name: 'В кабинете', exact: true })).toBeDisabled();
  }
  await capture(page, 'office.png');
  await navigate(page, 'Текущее дело');
  const scene = CASES[1].actions.find(item => item.category === 'scene')!;
  const research = CASES[1].actions.find(item => item.category === 'research' && item.skill === 'forensics')!;
  let before = await saved(page);
  await perform(page, scene);
  expect((await saved(page)).cases['002'].spent - before.cases['002'].spent).toBe(Math.max(1, scene.cost - (scene.skill === 'forensics' ? 1 : 0)));
  before = await saved(page);
  await perform(page, research);
  expect((await saved(page)).cases['002'].spent - before.cases['002'].spent).toBe(Math.max(1, research.cost - 2));
  await caseTab(page, 'Документы');
  await expect(page.locator('.case-lamp-hint').first()).toBeVisible();

  await navigate(page, 'Люди и отношения');
  const contact = CONTACTS[0];
  const choice = contact.choices[1];
  before = await saved(page);
  await page.getByRole('button', { name: choice.label, exact: true }).click();
  const afterContact = await saved(page);
  expect(afterContact.relationships[contact.id]).toBe(before.relationships[contact.id] + 8);
  expect(afterContact.stats.money).toBe(before.stats.money - 250);
  expect(afterContact.cases['002'].spent).toBe(before.cases['002'].spent + 1);
  await expect(page.getByRole('button', { name: choice.label, exact: true })).toHaveCount(0);
  await expect(page.getByRole('meter', { name: `Доверие: ${contact.name}`, exact: true })).toHaveAttribute('aria-valuenow', String(afterContact.relationships[contact.id]));
  await page.reload();
  await navigate(page, 'Люди и отношения');
  await expect(page.getByRole('button', { name: choice.label, exact: true })).toHaveCount(0);
  expect((await saved(page)).contactVisits).toEqual(afterContact.contactVisits);

  await page.getByRole('button', { name: 'Сохранение кампании и настройки', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспортировать кампанию', exact: true }).click();
  const download = await downloadPromise;
  const exportPath = await download.path();
  expect(exportPath).toBeTruthy();
  const exported = await readFile(exportPath!, 'utf8');
  expect(parseCampaignSave(exported)).toEqual(afterContact);
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2,"cases":{}}') });
  await expect(page.getByRole('status')).toContainText('Сохранение кампании повреждено');
  expect(await saved(page)).toEqual(afterContact);
  await page.getByRole('button', { name: 'Начать новую кампанию', exact: true }).click();
  await page.getByRole('dialog', { name: 'Новая кампания', exact: true }).getByRole('button', { name: 'Начать новую кампанию', exact: true }).click();
  expect((await saved(page)).activeCase).toBe('001');
  expect((await saved(page)).upgrades).toEqual([]);
  await page.getByRole('button', { name: 'Сохранение кампании и настройки', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'campaign.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await expect(page.getByRole('status')).toContainText('Кампания восстановлена');
  await page.reload();
  expect(await saved(page)).toEqual(afterContact);
  expect(errors).toEqual([]);
});

test('позднее последствие взятки, возврат средств и мобильные разделы кампании', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await seed(page, beforeThirdCase());
  await openCaseUI(page, '003');
  await investigateUI(page, '003', 'accepted_bribe');
  expect((await saved(page)).flags).toContain('accepted_bribe');
  await openCaseUI(page, '004');
  await investigateUI(page, '004');
  await openCaseUI(page, '005');
  const before = await saved(page);
  expect(before.events.some(item => item.id === 'bribe-audit' && item.selected === null)).toBe(true);

  await page.setViewportSize({ width: 375, height: 812 });
  for (const label of ['Кампания', 'Следователь', 'Мой кабинет', 'Люди и отношения', 'Личный архив', 'Текущее дело']) {
    await navigate(page, label);
    await noOverflow(page);
  }
  for (const label of ['Расследование', 'Материалы', 'Документы', 'Решение и суд']) {
    await caseTab(page, label);
    await noOverflow(page);
  }
  await navigate(page, 'Кампания');
  await capture(page, 'mobile-campaign.png');
  await navigate(page, 'Люди и отношения');
  const audit = page.getByRole('article').filter({ has: page.getByRole('heading', { name: before.events.find(item => item.id === 'bribe-audit')!.title, exact: true }) });
  await expect(audit).toBeVisible();
  await audit.getByRole('button', { name: 'Признать перевод и вернуть доступные средства', exact: true }).click();
  const disclosed = await saved(page);
  expect(disclosed.stats.money).toBe(before.stats.money - Math.min(before.stats.money, 6000));
  expect(disclosed.flags).toContain('bribe_disclosed');
  expect(disclosed.events.find(item => item.id === 'bribe-audit')?.selected).toBe('restitute');
  await expect(page.getByRole('button', { name: 'Признать перевод и вернуть доступные средства', exact: true })).toHaveCount(0);
  await page.reload();
  expect(await saved(page)).toEqual(disclosed);
  await navigate(page, 'Личный архив');
  await page.getByRole('combobox', { name: 'Показать дело', exact: true }).selectOption('005');
  await expect(page.locator('.progression-events-history')).toContainText('Возвращено 6000 ₽');
  await noOverflow(page);
  expect(errors).toEqual([]);
});
