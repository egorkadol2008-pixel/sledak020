import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/game/types';

const SAVE_KEY = 'sk-materialy-dela-v1';

async function savedState(page: Page): Promise<GameState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), SAVE_KEY);
}

async function navigate(page: Page, title: string) {
  await page.getByRole('navigation', { name: 'Разделы расследования' }).getByRole('button', { name: new RegExp(`^${title}`) }).click();
}

async function action(page: Page, title: string) {
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).first().click();
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Выполнить действие' }).click();
  await expect(dialog).not.toBeVisible();
}

async function typeSignature(page: Page, name = 'А. Морозов') {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Ввести имя', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Имя или инициалы следователя' }).fill(name);
  await dialog.getByRole('button', { name: 'Подписать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function correctInspection(page: Page) {
  await navigate(page, 'Документы');
  await page.getByLabel('Дата документа', { exact: true }).fill('2026-09-14');
  await page.getByLabel('Отчество погибшего', { exact: true }).fill('Андреевич');
  await page.getByRole('combobox', { name: 'Приобщено фотографий', exact: true }).selectOption('4');
}

async function advanceDay(page: Page, day: number) {
  await page.getByRole('button', { name: 'Завершить день', exact: true }).click();
  await page.getByRole('combobox', { name: 'Рабочая версия', exact: true }).selectOption('intervention');
  await page.getByRole('textbox', { name: 'Что проверить дальше', exact: true }).fill('Сопоставить независимые сведения, проверить противоречия и происхождение материалов.');
  await page.getByRole('dialog').getByRole('button', { name: 'Перейти к подписи', exact: true }).click();
  await typeSignature(page);
  await expect.poll(async () => (await savedState(page)).day).toBe(day + 1);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('полное расследование через интерфейс: четыре дня, восемь источников, обоснованное решение', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?case=001');
  await expect(page.getByRole('heading', { name: 'Последняя папка', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });

  await navigate(page, 'Место происшествия');
  await action(page, 'Осмотреть кабинет');
  const timeAfterInspection = (await savedState(page)).spent;
  await page.getByRole('button', { name: 'Осмотреть: Место папки № 17', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Место папки № 17', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Осмотреть: Напечатанная записка', exact: true }).click();
  expect((await savedState(page)).spent).toBe(timeAfterInspection);
  await page.screenshot({ path: 'test-results/scene.png', fullPage: true });
  await action(page, 'Сохранить запись камеры');
  await action(page, 'Запросить резервный журнал');
  await action(page, 'Запросить историю печати');
  await action(page, 'Подготовить исследование');
  await navigate(page, 'Участники дела');
  await action(page, 'Опросить Волкову');
  await expect(page.getByText('Полный разговор относится к прекращению договора', { exact: false })).not.toBeVisible();
  await correctInspection(page);
  await page.getByRole('button', { name: 'Перейти к подписи', exact: true }).click();
  await typeSignature(page);
  await page.getByRole('button', { name: 'Назначение экспертизы' }).click();
  await page.getByRole('button', { name: 'Перейти к подписи', exact: true }).click();
  await typeSignature(page);
  expect((await savedState(page)).documents).toHaveLength(2);
  expect((await savedState(page)).requests).toHaveLength(4);

  await page.reload();
  expect((await savedState(page)).documents).toHaveLength(2);
  expect((await savedState(page)).completedActions).toContain('inspect');
  await advanceDay(page, 1);
  let state = await savedState(page);
  expect(state.evidence.E05?.stage).toBe(2);
  expect(state.evidence.E02).toBeUndefined();

  await navigate(page, 'Участники дела');
  await action(page, 'Уточнить переписку Волковой');
  await page.getByRole('button', { name: /Бухгалтер Марина Лебедева/ }).click();
  await action(page, 'Связаться с бухгалтером');
  await action(page, 'Проверить финансовые копии');
  await page.getByRole('button', { name: /Охранник Сергей Данилов/ }).click();
  await action(page, 'Опросить охранника');
  await action(page, 'Поддержать свидетеля');
  await page.getByRole('button', { name: /Деловой партнёр Илья Орлов/ }).click();
  await action(page, 'Предъявить Орлову расхождение');
  await advanceDay(page, 2);
  state = await savedState(page);
  expect(state.evidence.E02?.verified).toBe(true);
  expect(state.evidence.E07?.verified).toBe(true);

  await navigate(page, 'Участники дела');
  await page.getByRole('button', { name: /Охранник Сергей Данилов/ }).click();
  await action(page, 'Проверить показания охранника');
  await navigate(page, 'Материалы');
  await page.getByRole('navigation', { name: 'Материалы расследования' }).getByRole('button', { name: /E08/ }).click();
  await expect(page.getByText('После сопоставления проходов Данилов рассказал:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Сопоставить с другим источником' }).click();
  await page.getByLabel('Второй источник').selectOption('E05');
  await expect(page.locator('.comparison-content')).toContainText('20:52');
  await advanceDay(page, 3);
  await page.getByRole('button', { name: 'Принять решение по делу', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(8);
  await page.getByRole('button', { name: 'Подписать решение', exact: true }).click();
  await typeSignature(page);
  await expect(page.getByRole('heading', { name: 'Материалы выдержали проверку', exact: true })).toBeVisible();
  state = await savedState(page);
  expect(state.ending?.kind).toBe('strong');
  expect(state.ending?.issues).toEqual([]);
  expect(state.documents.filter((document) => document.kind === 'report')).toHaveLength(3);
  expect(state.documents.at(-1)?.signature).toBe('А. Морозов');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Материалы выдержали проверку', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('мобильный экран без горизонтального переполнения и подпись с клавиатуры', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?case=001');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  for (const title of ['Место происшествия', 'Участники дела', 'Материалы', 'Документы', 'Журнал следователя']) {
    await navigate(page, title);
    await expectNoHorizontalOverflow(page);
  }
  await page.getByRole('button', { name: 'Завершить день', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Перейти к подписи', exact: true }).click();
  const keyboardMode = page.getByRole('button', { name: 'Ввести имя', exact: true });
  await keyboardMode.focus();
  await page.keyboard.press('Enter');
  const name = page.getByRole('textbox', { name: 'Имя или инициалы следователя' });
  await expect(name).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('button', { name: 'Подписать', exact: true })).toBeDisabled();
  await page.keyboard.insertText('Е. Кадол');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Подписать', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedState(page)).day).toBe(2);
  expect((await savedState(page)).documents[0].signatureMode).toBe('typed');
  expect((await savedState(page)).documents[0].signature).toBe('Е. Кадол');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('рисованная подпись: пустая заблокирована, очистка работает, рисунок сохраняется', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?case=001');
  await navigate(page, 'Место происшествия');
  await action(page, 'Осмотреть кабинет');
  await correctInspection(page);
  await page.getByRole('button', { name: 'Перейти к подписи', exact: true }).click();
  const sign = page.getByRole('button', { name: 'Подписать', exact: true });
  await expect(sign).toBeDisabled();
  const before = (await savedState(page)).spent;
  async function draw() {
    const bounds = await page.locator('canvas.signature-canvas').boundingBox();
    if (!bounds) throw new Error('Поле подписи не найдено');
    await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height * .65);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .35, bounds.y + bounds.height * .25, { steps: 8 });
    await page.mouse.move(bounds.x + bounds.width * .3, bounds.y + bounds.height * .7, { steps: 8 });
    await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .45, { steps: 8 });
    await page.mouse.up();
  }
  await draw();
  await expect(sign).toBeEnabled();
  expect((await savedState(page)).spent).toBe(before);
  await page.getByRole('button', { name: 'Очистить', exact: true }).click();
  await expect(sign).toBeDisabled();
  await draw();
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(sign).toBeEnabled();
  await sign.click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const state = await savedState(page);
  expect(state.spent).toBe(before + 1);
  expect(state.documents[0].signatureMode).toBe('drawn');
  expect(state.documents[0].signature).toMatch(/^data:image\/png;base64,/);
  await page.locator('.archived-document summary').click();
  await expect(page.getByRole('img', { name: 'Подпись следователя' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('повреждённый импорт не заменяет текущее расследование', async ({ page }) => {
  await page.goto('/?case=001');
  const initial = await savedState(page);
  await page.getByRole('button', { name: 'Сохранение и настройки', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"day":42}') });
  await expect(page.getByRole('status')).toContainText('Сохранение повреждено');
  expect(await savedState(page)).toEqual(initial);
});
