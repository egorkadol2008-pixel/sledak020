import { useEffect, useRef, useState } from 'react';
import { Archive, Clock3, FileCheck2, FileText, PenLine, X } from 'lucide-react';
import type { DocKind, DocumentDraft, GameState, SignedDocument } from '../game/types';
import SignaturePad from './SignaturePad';
import './docs.css';

export interface DocumentsPanelProps {
  state: GameState;
  onDraftChange: (kind: DocKind, patch: Partial<DocumentDraft>) => void;
  onSign: (kind: DocKind, signature: string, mode: 'drawn' | 'typed') => void;
}

const documentTitles: Record<DocKind, string> = {
  inspection: 'Протокол осмотра места происшествия',
  expert: 'Постановление о назначении экспертизы',
};

export default function DocumentsPanel({ state, onDraftChange, onSign }: DocumentsPanelProps) {
  const [kind, setKind] = useState<DocKind>('inspection');
  const [signing, setSigning] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  const signButton = useRef<HTMLButtonElement>(null);
  const draft = state.drafts[kind];
  const versions = state.documents.filter(document => document.kind === kind);
  const reports = state.documents.filter(document => document.kind === 'report' || document.kind === 'decision');
  const isAmendment = versions.length > 0;
  const hasSource = kind === 'inspection' ? Boolean(state.evidence.E01) : state.completedActions.includes('prepare-expert');
  const sourceDay = kind === 'inspection' ? state.evidence.E01?.receivedDay : state.day;
  const sourceDate = sourceDay ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 8, 13 + sourceDay))) : null;
  const lockReason = state.ending ? 'Расследование завершено. Архив доступен для чтения.' : state.spent >= 15 ? 'Последние 30 минут оставлены на итог дня. Продолжите оформление завтра.' : !hasSource ? (kind === 'inspection' ? 'Сначала проведите осмотр места происшествия.' : 'Сначала подготовьте запрос эксперту в плане действий.') : null;

  useEffect(() => {
    if (!signing) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => modal.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]');
    focusables()?.[0]?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSigning(false);
      if (event.key !== 'Tab') return;
      const elements = focusables();
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previouslyFocused?.focus(); };
  }, [signing]);

  function patch(change: Partial<DocumentDraft>) { onDraftChange(kind, change); }

  function archivedDocument(document: SignedDocument, index: number) {
    const isReport = document.kind === 'report' || document.kind === 'decision';
    return (
      <details key={document.id} className="archived-document" open={document.kind === 'decision'}>
        <summary><span><strong>{isReport ? document.kind === 'decision' ? 'Итоговое решение' : `Отчёт за день ${document.day}` : index === 0 ? 'Первоначальная версия' : `Дополнение ${index}`}</strong><span>{document.title}</span></span><span className="archived-document-time">День {document.day} · {document.time}</span></summary>
        <div className="archived-document-content"><pre>{document.text}</pre>{document.signatureMode === 'drawn' ? <img className="archived-signature" src={document.signature} alt="Подпись следователя" /> : <div className="archived-typed-signature">{document.signature}</div>}{document.issues.length > 0 && <div className="archived-document-issues"><strong>Замечания при проверке версии</strong><ul>{document.issues.map((issue, issueIndex) => <li key={issueIndex}>{issue}</li>)}</ul></div>}<p className="document-field-note">Сохранённая версия · доступна только для чтения</p></div>
      </details>
    );
  }

  const reportArchive = reports.length > 0 && <section className="document-archive panel" aria-label="Отчёты и итоговые решения"><div className="document-archive-heading"><Archive size={18} /><h3>Отчёты и итоговые решения</h3></div>{reports.map(archivedDocument)}</section>;

  return (
    <section className="documents-panel">
      <div className="section-heading">
        <div><span className="eyebrow">Материалы № 001 / 2026</span><h2>Процессуальные документы</h2></div>
        <span className="badge"><Archive size={14} /> {state.documents.length} в архиве</span>
      </div>
      <p className="muted document-intro">Сверьте реквизиты и приложения с материалами дела. Подпись сохраняет текущий текст в архиве.</p>
      {state.ending && reportArchive}
      <div className="document-kind-tabs" aria-label="Выбор документа">
        <button type="button" className={kind === 'inspection' ? 'active' : ''} aria-pressed={kind === 'inspection'} onClick={() => setKind('inspection')}><FileText size={17} /> Протокол осмотра {state.documents.some(document => document.kind === 'inspection') && <FileCheck2 size={15} aria-label="Есть подписанная версия" />}</button>
        <button type="button" className={kind === 'expert' ? 'active' : ''} aria-pressed={kind === 'expert'} onClick={() => setKind('expert')}><FileText size={17} /> Назначение экспертизы {state.documents.some(document => document.kind === 'expert') && <FileCheck2 size={15} aria-label="Есть подписанная версия" />}</button>
      </div>
      <div className="document-workspace">
        <article className="paper document-paper">
          <div className="document-paper-meta"><span>РАЙОННЫЙ СЛЕДСТВЕННЫЙ ОТДЕЛ</span><span>{isAmendment ? 'ПРОЕКТ ДОПОЛНЕНИЯ' : 'ПРОЕКТ'}</span></div>
          <h3>{documentTitles[kind]}</h3>
          <div className="document-reference">Материалы проверки по факту смерти П. А. Коренева</div>
          <fieldset className="document-fields" disabled={Boolean(state.ending)}>
            <div className="document-fields-row">
              <label className="field" htmlFor={`document-date-${kind}`}><span>Дата документа</span><input id={`document-date-${kind}`} type="date" value={draft.date} onChange={event => patch({ date: event.target.value })} /></label>
              <div className="document-fixed-field"><span>Место составления</span><strong>г. Зареченск</strong></div>
            </div>
            <p className="document-paragraph">Следователь {state.profileName || 'районного отдела'}, рассмотрев материалы проверки, оформил следующие сведения:</p>
            <div className="document-name-row"><div className="document-fixed-field"><span>Фамилия, имя погибшего</span><strong>Коренев Павел</strong></div><label className="field" htmlFor={`document-patronymic-${kind}`}><span>Отчество погибшего</span><input id={`document-patronymic-${kind}`} value={draft.patronymic} maxLength={60} onChange={event => patch({ patronymic: event.target.value })} autoComplete="off" /></label></div>
            {kind === 'inspection' ? (
              <>
                <p className="document-paragraph">Осмотрено помещение кабинета предпринимателя. Обстановка и обнаруженные объекты зафиксированы в материалах осмотра. Фотографии приобщаются к настоящему протоколу.</p>
                <div className="document-fields-row">
                  <label className="field" htmlFor="document-photo-count"><span>Фотографий в перечне</span><input id="document-photo-count" type="number" min={0} max={4} value={draft.photoCount} onChange={event => patch({ photoCount: Math.max(0, Math.min(4, Number(event.target.value))) })} /></label>
                  <label className="field" htmlFor="document-attached-photos"><span>Приобщено фотографий</span><select id="document-attached-photos" value={draft.attachedPhotos} onChange={event => patch({ attachedPhotos: Number(event.target.value) })}><option value={3}>3 — основной комплект</option><option value={4}>4 — включая опись папки № 17</option></select></label>
                </div>
                <p className="document-field-note">Четвёртый снимок доступен в материалах осмотра. Приобщение меняет комплект текущего черновика.</p>
              </>
            ) : (
              <>
                <p className="document-paragraph">Для установления обстоятельств смерти назначить исследование. Перед экспертом поставить следующие вопросы:</p>
                <label className="field" htmlFor="document-expert-question"><span>Вопросы эксперту</span><textarea id="document-expert-question" rows={5} value={draft.question} maxLength={1800} onChange={event => patch({ question: event.target.value })} /></label>
                <p className="document-field-note">Заключение эксперта поступает отдельным материалом. Формулировка вопроса не должна подменять вывод эксперта.</p>
              </>
            )}
          </fieldset>
          <div className="document-signature-line"><span>Следователь</span><span className="document-unsigned">{isAmendment ? 'Дополнение не подписано' : 'Не подписано'}</span></div>
          <div className="document-paper-footer"><span>ДЕЛО № 001 / 2026</span><span>ЛИСТ 1</span></div>
        </article>
        <aside className="document-reference-panel panel">
          <span className="eyebrow">Перед подписью</span>
          <h3>Сверка с источниками</h3>
          <ol className="document-checklist">
            <li><strong>Личность</strong><span>Отчество — по карточке погибшего в материалах дела.</span></li>
            <li><strong>Дата</strong><span>{kind === 'inspection' ? sourceDate ? `Осмотр состоялся ${sourceDate} Сверьте дату действия.` : 'Дата появится в материалах после осмотра.' : `Дата оформления поручения: ${sourceDate}`}</span></li>
            <li><strong>{kind === 'inspection' ? 'Комплектность' : 'Задание эксперту'}</strong><span>{kind === 'inspection' ? 'Сопоставьте перечень приложений и фактически приобщённые снимки.' : 'Укажите обстоятельства, которые должен установить эксперт.'}</span></li>
          </ol>
          <div className="document-cost"><Clock3 size={18} /><div><strong>30 минут</strong><span>За оформление и подпись версии</span></div></div>
          <p className="document-field-note">Чтение, правки черновика и рисование подписи не расходуют время.</p>
          {isAmendment && <p className="document-amendment-note">В архиве есть подписанная версия. Новая подпись сохранит дополнение; первоначальный документ останется доступен.</p>}
          <button type="button" ref={signButton} className="primary-button document-sign-button" disabled={Boolean(lockReason)} onClick={() => setSigning(true)}><PenLine size={17} /> {isAmendment ? 'Подписать дополнение' : 'Перейти к подписи'}</button>
          {lockReason && <p className="document-lock-reason" role="status">{lockReason}</p>}
        </aside>
      </div>
      <section className="document-archive panel" aria-label="Подписанные версии документа">
        <div className="document-archive-heading"><Archive size={18} /><h3>Архив подписанных версий</h3><span className="badge">{versions.length}</span></div>
        {versions.length === 0 ? <p className="muted">Подписанные документы появятся здесь. Каждая версия сохраняется вместе с подписью.</p> : versions.map(archivedDocument)}
      </section>
      {!state.ending && reportArchive}
      {signing && <div className="modal-overlay documents-modal-overlay" onClick={event => { if (event.target === event.currentTarget) setSigning(false); }}><div className="modal documents-signature-modal" role="dialog" aria-modal="true" aria-label={`Подписание: ${documentTitles[kind]}`} ref={modal}><button type="button" className="icon-button documents-modal-close" aria-label="Закрыть окно подписи" onClick={() => setSigning(false)}><X size={20} /></button><SignaturePad title={isAmendment ? 'Подписать дополнение' : 'Подписать документ'} initialName={state.profileName} samples={state.signatureSamples} onCancel={() => setSigning(false)} onConfirm={(signature, mode) => { if (!lockReason) { onSign(kind, signature, mode); setSigning(false); } }} /></div></div>}
    </section>
  );
}
