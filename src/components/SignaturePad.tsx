import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Check, Eraser, Keyboard, PenLine } from 'lucide-react';
import './docs.css';

export interface SignaturePadProps {
  onConfirm: (signature: string, mode: 'drawn' | 'typed') => void;
  onCancel: () => void;
  title?: string;
  initialName?: string;
  samples?: string[];
  onSaveSamples?: (samples: string[]) => void;
}

type Point = { x: number; y: number };

export default function SignaturePad({ onConfirm, onCancel, title = 'Подпись следователя', initialName = '', samples = [], onSaveSamples }: SignaturePadProps) {
  const [mode, setMode] = useState<'drawn' | 'typed'>('drawn');
  const [name, setName] = useState(initialName);
  const [hasInk, setHasInk] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const pointer = useRef<number | null>(null);
  const inputId = useId();
  const headingId = useId();
  const savedSample = samples.filter(sample => /^data:image\/(png|jpeg|webp);base64,/.test(sample)).at(-1);

  function redraw() {
    const element = canvas.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    element.width = Math.round(rect.width * dpr);
    element.height = Math.round(rect.height * dpr);
    const context = element.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#fcfbf7';
    context.fillRect(0, 0, rect.width, rect.height);
    context.strokeStyle = '#d8d6cb';
    context.lineWidth = 1;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.moveTo(22, rect.height * 0.74);
    context.lineTo(rect.width - 22, rect.height * 0.74);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = '#283d54';
    context.fillStyle = '#283d54';
    context.lineWidth = 2.1;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const stroke of strokes.current) {
      if (!stroke.length) continue;
      context.beginPath();
      context.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
      if (stroke.length === 1) {
        context.arc(stroke[0].x * rect.width, stroke[0].y * rect.height, 1.1, 0, Math.PI * 2);
        context.fill();
      } else {
        for (const point of stroke.slice(1)) context.lineTo(point.x * rect.width, point.y * rect.height);
        context.stroke();
      }
    }
  }

  useEffect(() => {
    if (mode !== 'drawn' || !canvas.current) return;
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [mode]);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function startStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    strokes.current.push([pointFromEvent(event)]);
    setHasInk(true);
    redraw();
  }

  function continueStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    strokes.current[strokes.current.length - 1].push(pointFromEvent(event));
    redraw();
  }

  function endStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clear() {
    strokes.current = [];
    pointer.current = null;
    setHasInk(false);
    redraw();
  }

  function confirm() {
    if (mode === 'typed' && name.trim().length >= 2) onConfirm(name.trim(), 'typed');
    if (mode === 'drawn' && hasInk && canvas.current) onConfirm(canvas.current.toDataURL('image/png'), 'drawn');
  }

  return (
    <section className="signature-pad" aria-labelledby={headingId}>
      <div className="signature-heading">
        <span className="eyebrow">Личная подпись</span>
        <h2 id={headingId}>{title}</h2>
        <p className="muted">Подписанная версия останется в архиве. Исправления оформляются отдельным дополнением.</p>
      </div>
      <div className="signature-mode" aria-label="Способ подписи">
        <button type="button" className={mode === 'drawn' ? 'active' : ''} aria-pressed={mode === 'drawn'} onClick={() => setMode('drawn')}><PenLine size={16} /> Нарисовать</button>
        <button type="button" className={mode === 'typed' ? 'active' : ''} aria-pressed={mode === 'typed'} onClick={() => setMode('typed')}><Keyboard size={16} /> Ввести имя</button>
      </div>
      {mode === 'drawn' ? (
        <>
          {savedSample && <div className="signature-saved-sample"><span>Ваш образец</span><img src={savedSample} alt="Ранее сохранённый образец вашей подписи" /></div>}
          <div className="signature-canvas-wrap">
            <canvas ref={canvas} className="signature-canvas" aria-label="Нарисуйте подпись мышью, пальцем или пером. Для клавиатуры выберите «Ввести имя»." onPointerDown={startStroke} onPointerMove={continueStroke} onPointerUp={endStroke} onPointerCancel={endStroke} />
            {!hasInk && <span className="signature-placeholder" aria-hidden="true">Ваша подпись</span>}
          </div>
          <div className="signature-tools">
            <span className="muted">Мышь, палец или графическое перо</span>
            <button type="button" className="signature-clear" disabled={!hasInk} onClick={clear}><Eraser size={15} /> Очистить</button>
          </div>
          {onSaveSamples && <button type="button" className="secondary-button signature-sample-button" disabled={!hasInk || samples.length >= 3} onClick={() => { if (canvas.current && hasInk) { onSaveSamples([...samples, canvas.current.toDataURL('image/png')].slice(0, 3)); clear(); } }}>Сохранить образец · {samples.length}/3</button>}
        </>
      ) : (
        <div className="signature-typed">
          <label htmlFor={inputId}>Имя или инициалы следователя</label>
          <input id={inputId} value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Например, А. Соколов" autoComplete="off" autoFocus />
          <div className="typed-signature-preview" aria-hidden="true">{name.trim() || 'Ваша подпись'}</div>
        </div>
      )}
      <p className="signature-accessibility-note">Оба способа равнозначны. Рисование не расходует игровое время.</p>
      <div className="signature-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Вернуться к документу</button>
        <button type="button" className="primary-button" disabled={mode === 'drawn' ? !hasInk : name.trim().length < 2} onClick={confirm}><Check size={17} /> Подписать</button>
      </div>
    </section>
  );
}
