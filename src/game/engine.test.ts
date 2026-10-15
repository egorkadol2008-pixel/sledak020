import { describe, expect, it } from 'vitest';
import { assessCase, createInitialState, endDay, finishCase, getAvailability, getTime, parseSave, performAction, signDocument, updateDraft } from './engine';
import type { EvidenceId, GameState } from './types';

const signature = 'И. Следователь';
const nextDay = (state: GameState) => endDay(state, 'intervention', 'Проверить независимые источники и получить ответы на запросы.', signature, 'typed');
const correctInspection = (state: GameState) => updateDraft(state, 'inspection', { patronymic: 'Андреевич', date: '2026-09-14', attachedPhotos: 4 });

function investigate(withCamera = true): GameState {
  let state = createInitialState();
  for (const id of ['inspect', 'interview-volkova', ...(withCamera ? ['preserve-camera'] : []), 'prepare-expert']) state = performAction(state, id);
  state = signDocument(correctInspection(state), 'inspection', signature, 'typed');
  state = signDocument(state, 'expert', signature, 'typed');
  for (const id of ['request-access', 'request-print', 'interview-guard', 'support-witness']) state = performAction(state, id);
  state = nextDay(state);
  for (const id of ['clarify-volkova', 'contact-accountant', 'verify-finance', 'question-orlov']) state = performAction(state, id);
  state = nextDay(state);
  state = performAction(state, 'reinterview-guard');
  return nextDay(state);
}

describe('расследование «Последняя папка»', () => {
  it('проходит четыре дня и формирует пригодный пакет без гарантированного приговора', () => {
    const state = investigate();
    expect(state.day).toBe(4);
    expect(state.evidence.E02?.receivedDay).toBe(3);
    expect(assessCase(state)).toMatchObject({ event: true, identity: true, integrity: true, issues: [] });
    const selected = Object.keys(state.evidence) as EvidenceId[];
    const final = finishCase(state, 'orlov', selected, signature, 'typed');
    expect(final.ending?.kind).toBe('strong');
    expect(final.ending?.description).toContain('исход ещё впереди');
    expect(final.ending?.epilogue).toContain('Шесть месяцев спустя');
    expect(final.documents.at(-1)).toMatchObject({ kind: 'decision', signature });
    expect(state.ending).toBeNull();
  });

  it('сохраняет честный запасной путь после утраты камеры', () => {
    const state = investigate(false);
    expect(state.cameraLost).toBe(true);
    expect(state.evidence.E05).toBeUndefined();
    expect(getAvailability(state, 'preserve-camera').allowed).toBe(false);
    expect(assessCase(state)).toMatchObject({ event: true, identity: true, integrity: true });
    const withoutFinance = (Object.keys(state.evidence) as EvidenceId[]).filter(id => id !== 'E07');
    expect(assessCase(state, withoutFinance).identity).toBe(false);
  });

  it('резервирует получаса на отчёт и не списывает время за повторное действие', () => {
    let state = createInitialState();
    state = performAction(state, 'inspect');
    const previous = JSON.stringify(state);
    expect(performAction(state, 'inspect')).toBe(state);
    expect(JSON.stringify(state)).toBe(previous);
    state = { ...state, spent: 14 };
    expect(getAvailability(state, 'interview-volkova')).toMatchObject({ allowed: false, completed: false });
    expect(() => performAction(state, 'interview-volkova')).toThrow('получаса');
    state = performAction(state, 'request-print');
    expect(state.spent).toBe(15);
    expect(() => performAction(state, 'break')).toThrow('получаса');
    expect(nextDay(state)).toMatchObject({ day: 2, spent: 0 });
    expect(getTime(1)).toBe('09:30');
    expect(getTime(16)).toBe('17:00');
  });

  it('сохраняет подписанный оригинал при редактировании и уточнённой подписи', () => {
    let state = performAction(createInitialState(), 'inspect');
    state = signDocument(state, 'inspection', signature, 'typed');
    const first = structuredClone(state.documents[0]);
    expect(first.issues).toHaveLength(3);
    const edited = correctInspection(state);
    expect(edited.documents[0]).toEqual(first);
    expect(state.drafts.inspection.patronymic).toBe('Александрович');
    const amended = signDocument(edited, 'inspection', 'Новая подпись', 'typed');
    expect(amended.documents).toHaveLength(2);
    expect(amended.documents[0]).toEqual(first);
    expect(amended.documents[1].issues).toEqual([]);
    expect(amended.evidence.E01?.verified).toBe(true);
    expect(amended.evidence.E01?.stage).toBe(2);
    expect(signDocument(amended, 'inspection', 'Новая подпись', 'typed')).toBe(amended);
  });

  it('запускает экспертизу только подписью и выдерживает полный следующий день', () => {
    let state = performAction(createInitialState(), 'inspect');
    state = performAction(state, 'prepare-expert');
    expect(state.requests.some(request => request.key === 'expert')).toBe(false);
    state = nextDay(state);
    expect(state.evidence.E02).toBeUndefined();
    state = updateDraft(state, 'expert', { date: '2026-09-15' });
    state = signDocument(state, 'expert', signature, 'typed');
    expect(state.requests.find(request => request.key === 'expert')?.dueDay).toBe(4);
    state = nextDay(state);
    expect(state.evidence.E02).toBeUndefined();
    state = nextDay(state);
    expect(state.evidence.E02).toMatchObject({ stage: 2, verified: true, receivedDay: 4 });
  });

  it('подтверждает сохранение до конца второго дня и не подменяет план запросом', () => {
    let state = nextDay(createInitialState());
    expect(state.requests).toEqual([]);
    state = performAction(state, 'preserve-camera');
    state = nextDay(state);
    expect(state.cameraLost).toBe(false);
    expect(state.evidence.E05?.stage).toBe(2);
    const missed = nextDay(nextDay(createInitialState()));
    expect(missed.cameraLost).toBe(true);
    expect(() => performAction(missed, 'preserve-camera')).toThrow('истёк');
  });

  it('различает недостаточный пакет, ошибочное обвинение и закрытие', () => {
    const state = investigate();
    const all = Object.keys(state.evidence) as EvidenceId[];
    expect(finishCase(state, 'orlov', ['E01', 'E02', 'E06'], signature, 'typed').ending?.kind).toBe('weak');
    expect(finishCase(state, 'volkova', all, signature, 'typed').ending?.kind).toBe('wrong');
    expect(finishCase(state, 'close', all, signature, 'typed').ending?.kind).toBe('closed');
    expect(() => finishCase(createInitialState(), 'orlov', [], signature, 'typed')).toThrow('четвёртого');
  });

  it('не считает показания под давлением проверенными до исправления способа получения', () => {
    let state = investigate();
    state = { ...state, witnessApproach: null, completedActions: state.completedActions.filter(id => id !== 'support-witness') };
    state = performAction(state, 'pressure-witness');
    expect(assessCase(state).identity).toBe(false);
    expect(assessCase(state).integrity).toBe(false);
    state = performAction(state, 'support-witness');
    expect(assessCase(state)).toMatchObject({ identity: true, integrity: true });
    expect(state.journal.some(entry => entry.text.includes('Давление зафиксировано'))).toBe(true);
  });

  it('принимает собственные сохранения и отказывает повреждённому импорту', () => {
    for (const state of [createInitialState(), investigate(), finishCase(investigate(), 'close', [], signature, 'typed')]) {
      expect(parseSave(JSON.stringify(state))).toEqual(state);
    }
    for (const raw of ['{', 'null', '{}', JSON.stringify({ ...createInitialState(), spent: -1 }), JSON.stringify({ ...createInitialState(), evidence: { E99: {} } }), JSON.stringify({ ...createInitialState(), drafts: { inspection: {} } }), JSON.stringify({ ...createInitialState(), requests: [{ key: 'camera', requestedDay: 1, dueDay: 0 }] })]) {
      expect(() => parseSave(raw)).toThrow('Сохранение повреждено');
    }
  });

  it('позволяет продолжать после четвёртого дня и не меняет исходное состояние', () => {
    const state = investigate();
    const snapshot = JSON.stringify(state);
    const continued = nextDay(state);
    expect(continued.day).toBe(5);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(parseSave(JSON.stringify(continued))).toEqual(continued);
    expect(() => endDay(state, 'unknown', '', signature, 'typed')).toThrow('план');
    expect(() => signDocument(state, 'inspection', '', 'typed')).toThrow('подпись');
  });

  it('сохраняет финальное решение в последний получас и дни за пределами первого года', () => {
    const state = { ...investigate(), spent: 15 };
    const ended = finishCase(state, 'close', [], signature, 'typed');
    expect(ended.spent).toBe(16);
    expect(parseSave(JSON.stringify(ended))).toEqual(ended);
    const later = nextDay({ ...investigate(), day: 365 });
    expect(later.day).toBe(366);
    expect(parseSave(JSON.stringify(later))).toEqual(later);
  });

  it('сохраняет рукописную подпись в документе, отчёте и импорте', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nQAAAABJRU5ErkJggg==';
    const inspected = performAction(createInitialState(), 'inspect');
    const signed = signDocument(correctInspection(inspected), 'inspection', png, 'drawn');
    const reported = endDay(signed, 'unknown', 'Получить экспертное заключение.', png, 'drawn');
    expect(reported.documents.every(doc => doc.signature === png && doc.signatureMode === 'drawn')).toBe(true);
    expect(parseSave(JSON.stringify(reported))).toEqual(reported);
    expect(() => signDocument(inspected, 'inspection', 'data:image/svg+xml,<script/>', 'drawn')).toThrow('изображение подписи');
  });

  it('не считает текстовую подпись образцом рукописного автографа', () => {
    const inspected = performAction(createInitialState(), 'inspect');
    const signed = signDocument(correctInspection(inspected), 'inspection', signature, 'typed');
    const reported = endDay(signed, 'unknown', 'Проверить независимые сведения.', signature, 'typed');
    expect(reported.signatureSamples).toEqual([]);
    expect(reported.documents.every(doc => doc.signature === signature && doc.signatureMode === 'typed')).toBe(true);
    expect(parseSave(JSON.stringify(reported))).toEqual(reported);
  });
});
