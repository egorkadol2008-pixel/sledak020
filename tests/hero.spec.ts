import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { CASES, CONTACTS, UPGRADES } from '../src/campaign/content';
import { answerCourt, createCampaign, parseCampaignSave } from '../src/campaign/engine';
import type { CampaignState } from '../src/campaign/types';
import { createInitialState, endDay, finishCase, performAction, signDocument, updateDraft } from '../src/game/engine';
import type { EvidenceId } from '../src/game/types';

const SAVE_KEY = 'sk-materialy-dela-campaign-v2';
const signature = 'Алексей Морозов';

// Begin after a real successful first investigation. The original browser
// walkthrough covers its actions; this scenario exercises the hero's life.
function afterFirstCase(): CampaignState {
  let first = createInitialState();
  const nextDay = () => { first = endDay(first, 'intervention', 'Проверить независимые источники.', signature, 'typed'); };
  for (const id of ['inspect', 'interview-volkova', 'preserve-camera', 'prepare-expert']) first = performAction(first, id);
  first = updateDraft(first, 'inspection', { patronymic: 'Андреевич', date: '2026-09-14', attachedPhotos: 4 });
  first = signDocument(first, 'inspection', signature, 'typed');
  first = signDocument(first, 'expert', signature, 'typed');
  for (const id of ['request-access', 'request-print', 'interview-guard', 'support-witness']) first = performAction(first, id);
  nextDay();
  for (const id of ['clarify-volkova', 'contact-accountant', 'verify-finance', 'question-orlov']) first = performAction(first, id);
  nextDay();
  first = performAction(first, 'reinterview-guard');
  nextDay();
  first = finishCase(first, 'orlov', Object.keys(first.evidence) as EvidenceId[], signature, 'typed');
  let state = createCampaign(first);
  for (const round of CASES[0].court) state = answerCourt(state, '001', round.options.find(option => option.quality === 1)!.id);
  return state;
}

async function saved(page: Page): Promise<CampaignState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), SAVE_KEY);
}

async function navigate(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Кампания и развитие', exact: true }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

async function capture(page: Page, name: string) {
  const dismiss = page.getByRole('button', { name: 'Скрыть уведомление', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}

test('герой: разовые цели, история двух счетов, доверие и поддержка сохраняются между сеансами', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const initial = afterFirstCase();
  expect(initial.cases['001'].courtResult?.kind).toBe('accepted');
  await page.goto('/');
  await page.evaluate(({ key, raw }) => {
    localStorage.removeItem('sk-materialy-dela-v1');
    localStorage.setItem(key, raw);
  }, { key: SAVE_KEY, raw: JSON.stringify(initial) });
  await page.reload();
  await expect.poll(async () => (await saved(page)).cases['001'].status).toBe('resolved');

  const dashboardGoal = page.getByRole('region', { name: 'Цель развития героя', exact: true });
  await expect(dashboardGoal).toContainText('Первое назначение');
  await dashboardGoal.getByRole('button', { name: 'Открыть цели', exact: true }).click();
  const goals = page.getByRole('region', { name: 'Профессиональные цели', exact: true });
  const firstGoal = goals.getByRole('article', { name: 'Первое назначение', exact: true });
  await firstGoal.getByRole('button', { name: 'Получить награду', exact: true }).click();
  const rewarded = await saved(page);
  expect(rewarded.flags).toContain('career:first-case');
  expect(rewarded.stats.money).toBe(initial.stats.money + 500);
  expect(rewarded.stats.budget).toBe(initial.stats.budget);
  await expect(goals.getByRole('button', { name: 'Награда получена', exact: true })).toBeDisabled();
  await page.reload();
  await navigate(page, 'Следователь');
  await expect(goals.getByRole('button', { name: 'Награда получена', exact: true })).toBeDisabled();
  expect(await saved(page)).toEqual(rewarded);

  // Two purchases must debit their own accounts and remain distinct in the UI.
  await navigate(page, 'Мой кабинет');
  for (const id of ['lamp', 'scanner'] as const) {
    const upgrade = UPGRADES.find(item => item.id === id)!;
    const before = await saved(page);
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: upgrade.name, exact: true }) });
    await card.getByRole('button', { name: 'Приобрести', exact: true }).click();
    const after = await saved(page);
    expect(after.stats[upgrade.account]).toBe(before.stats[upgrade.account] - upgrade.price);
    expect(after.stats[upgrade.account === 'money' ? 'budget' : 'money']).toBe(before.stats[upgrade.account === 'money' ? 'budget' : 'money']);
    expect(after.finances).toHaveLength(before.finances.length + 1);
    expect(after.finances.at(-1)).toMatchObject({ account: upgrade.account, amount: -upgrade.price, balance: after.stats[upgrade.account] });
    expect(after.finances.at(-1)!.reason).toContain(upgrade.name);
    await expect(card.getByRole('button', { name: 'В кабинете', exact: true })).toBeDisabled();
  }
  const finances = page.getByRole('region', { name: 'Финансы', exact: true });
  const filters = finances.getByRole('group', { name: 'Счёт операций', exact: true });
  await filters.getByRole('button', { name: 'Личные', exact: true }).click();
  await expect(finances).toContainText('Настольная лампа');
  await expect(finances).not.toContainText('Документный сканер');
  await filters.getByRole('button', { name: 'Бюджет', exact: true }).click();
  await expect(finances).toContainText('Документный сканер');
  await expect(finances).not.toContainText('Настольная лампа');
  await filters.getByRole('button', { name: 'Все', exact: true }).click();
  await capture(page, 'hero-finances');

  // Supporting the witness in case 001 gives 40 trust. Two ordinary meetings
  // in consecutive cases cross the support threshold without fabricated stats.
  const danilov = CONTACTS.find(contact => contact.id === 'danilov')!;
  const checkIn = danilov.choices.find(choice => choice.id === 'danilov-check')!;
  await navigate(page, 'Люди и отношения');
  expect((await saved(page)).relationships.danilov).toBe(40);
  await page.getByRole('button', { name: checkIn.label, exact: true }).click();
  expect((await saved(page)).relationships.danilov).toBe(46);
  await navigate(page, 'Кампания');
  await page.getByRole('button', { name: `Открыть: ${CASES[1].title}`, exact: true }).click();
  await navigate(page, 'Люди и отношения');
  const mentor = CONTACTS.find(contact => contact.id === 'mentor')!;
  const mentorSupport = page.getByRole('region', { name: `Поддержка: ${mentor.name}`, exact: true });
  let before = await saved(page);
  expect(before.relationships.mentor).toBe(50);
  await mentorSupport.getByRole('button', { name: 'Попросить поддержки · 30 мин', exact: true }).click();
  const supported = await saved(page);
  expect(supported.flags).toContain('support:002:mentor');
  expect(supported.cases['002'].spent).toBe(before.cases['002'].spent + 1);
  expect(supported.stats.xp).toBe(before.stats.xp + 20);
  await expect(mentorSupport.getByRole('button', { name: 'Поддержка получена', exact: true })).toBeDisabled();
  await page.reload();
  await navigate(page, 'Люди и отношения');
  await expect(mentorSupport.getByRole('button', { name: 'Поддержка получена', exact: true })).toBeDisabled();
  expect(await saved(page)).toEqual(supported);

  const witnessSupport = page.getByRole('region', { name: `Поддержка: ${danilov.name}`, exact: true });
  await expect(witnessSupport.getByRole('button', { name: 'Попросить поддержки · 30 мин', exact: true })).toBeDisabled();
  before = await saved(page);
  await page.getByRole('button', { name: checkIn.label, exact: true }).click();
  expect((await saved(page)).relationships.danilov).toBe(52);
  expect((await saved(page)).cases['002'].spent).toBe(before.cases['002'].spent + 1);
  await expect(witnessSupport.getByRole('button', { name: 'Попросить поддержки · 30 мин', exact: true })).toBeEnabled();
  before = await saved(page);
  await witnessSupport.getByRole('button', { name: 'Попросить поддержки · 30 мин', exact: true }).click();
  const witnessHelp = await saved(page);
  expect(witnessHelp.flags).toContain('support:002:danilov');
  expect(witnessHelp.cases['002'].spent).toBe(before.cases['002'].spent + 1);
  expect(witnessHelp.stats.threat).toBe(Math.max(0, before.stats.threat - 10));

  await navigate(page, 'Следователь');
  const socialGoal = goals.getByRole('article', { name: 'Люди рядом', exact: true });
  await expect(socialGoal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await socialGoal.getByRole('button', { name: 'Получить награду', exact: true }).click();
  const connected = await saved(page);
  expect(connected.flags).toContain('career:reliable-circle');
  expect(connected.stats.xp).toBe(witnessHelp.stats.xp + 30);
  expect(connected.stats.stress).toBe(Math.max(0, witnessHelp.stats.stress - 10));

  await page.setViewportSize({ width: 375, height: 812 });
  for (const label of ['Кампания', 'Следователь', 'Мой кабинет', 'Люди и отношения']) {
    await navigate(page, label);
    await noOverflow(page);
  }
  await capture(page, 'hero-mobile-contacts');

  // Export, reset and import exercise serialized goal/support flags and the
  // finance ledger through the same controls a player uses to move a save.
  const completed = await saved(page);
  await page.getByRole('button', { name: 'Сохранение кампании и настройки', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспортировать кампанию', exact: true }).click();
  const exported = await readFile((await (await downloadPromise).path())!, 'utf8');
  expect(parseCampaignSave(exported)).toEqual(completed);
  await page.getByRole('button', { name: 'Начать новую кампанию', exact: true }).click();
  await page.getByRole('dialog', { name: 'Новая кампания', exact: true }).getByRole('button', { name: 'Начать новую кампанию', exact: true }).click();
  expect((await saved(page)).flags).not.toContain('career:first-case');
  await page.getByRole('button', { name: 'Сохранение кампании и настройки', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'hero-campaign.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await expect(page.getByRole('status')).toContainText('Кампания восстановлена');
  await page.reload();
  expect(await saved(page)).toEqual(completed);
  expect(errors).toEqual([]);
});
