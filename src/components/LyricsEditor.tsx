import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Columns2 } from 'lucide-react';
import {
  applyCellInput, countBars, joinLines, mergeIntoPrevious, mergeNext, parseBars,
  type BarColumn, type CaretTarget, type CellEdit, type LyricsFormat,
} from '../lyrics/bars';

/**
 * L'editor del testo.
 *
 * Il testo e' uno solo, sempre: quello che sta fra parentesi e' una ad lib e si
 * vede in giallo, il resto e' la barra e si vede in bianco. Il pulsante
 * "Format preference" non cambia il testo, cambia solo come lo si guarda: unito
 * com'e' scritto, oppure spaccato in due colonne - a sinistra le barre, a
 * destra le ad libs - per chi le vuole vedere separate.
 *
 * Il numero nel margine conta le barre, cioe' le righe del testo. Una barra
 * lunga che a video va a capo resta la barra numero uno: la riga di sotto non
 * prende un numero suo. Nelle due colonne le barre restano affiancate una per
 * una, quindi se una barra occupa due righe la sua casella di ad libs e' alta
 * due righe pure lei, anche quando e' vuota.
 */

/**
 * Textarea e strato colorato devono andare a capo negli stessi identici punti,
 * altrimenti il testo che si scrive e i colori che si vedono si sfalsano di una
 * riga. Tutto quello che decide dove si va a capo sta in queste due costanti, e
 * le usano entrambi gli strati: una copia sola, impossibile da disallineare.
 */
const METRICS = 'font-mono text-sm leading-6 whitespace-pre-wrap break-words';
const INSET = 'px-3 py-3';
/** Rientro che lascia libero il margine dei numeri, uguale nelle due viste. */
const GUTTER_INSET = 'pl-12';

/**
 * Le due colonne della vista divisa: il testo ha piu' bisogno di spazio delle
 * ad libs, che quasi sempre sono una parola. A separarle bastano lo stacco e il
 * colore - nessun righello, nessuna cella: sono due colonne di testo che
 * scorrono, non una tabella.
 */
const WRITER_COL = 'flex-[3]';
const ADLIB_COL = 'flex-[2]';
const WRITER_PAD = 'pr-5';
const ADLIB_PAD = 'pl-5';

const INK = {
  writer: 'text-slate-200',
  adlib: 'text-yellow-300',
};
/** Un blocco che non e' tuo si legge e basta: stessi colori, piu' spenti. */
const MUTED_INK = {
  writer: 'text-slate-400',
  adlib: 'text-yellow-300/50',
};

function cellKey(index: number, column: BarColumn): string {
  return `${index}:${column}`;
}

/** Il pulsante che decide solo come si guarda il testo, non cosa c'e' scritto. */
export function FormatPreferenceButton({
  format,
  onChange,
  className = '',
}: {
  format: LyricsFormat;
  onChange: (format: LyricsFormat) => void;
  className?: string;
}) {
  const split = format === 'split';
  return (
    <button
      type="button"
      onClick={() => onChange(split ? 'mixed' : 'split')}
      aria-pressed={split}
      title={
        split
          ? 'Ora barre e ad libs stanno in due colonne. Premi per rimetterle insieme.'
          : 'Ora barre e ad libs stanno insieme, le ad libs in giallo. Premi per dividerle in due colonne.'
      }
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border min-h-[36px] ${
        split
          ? 'bg-yellow-400/10 text-yellow-200 border-yellow-400/30 hover:bg-yellow-400/20'
          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
      } ${className}`}
    >
      {split ? <Columns2 className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
      <span>Format preference</span>
      <span className="text-[10px] uppercase tracking-wider opacity-70">
        {split ? 'Diviso' : 'Unito'}
      </span>
    </button>
  );
}

export function LyricsEditor({
  value,
  onChange,
  format,
  onFormatChange,
  readOnly = false,
  placeholder,
  minHeightClass = 'min-h-[250px]',
  framed = true,
  showBarCount = true,
}: {
  value: string;
  onChange: (value: string) => void;
  format: LyricsFormat;
  /** Se manca, il pulsante non si mostra: la preferenza si cambia altrove. */
  onFormatChange?: (format: LyricsFormat) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeightClass?: string;
  /** false quando il riquadro ce l'ha gia' chi ci mette dentro l'editor. */
  framed?: boolean;
  showBarCount?: boolean;
}) {
  const bars = useMemo(() => parseBars(value), [value]);
  const lines = useMemo(() => bars.map(b => b.text), [bars]);
  const ink = readOnly ? MUTED_INK : INK;

  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const cells = useRef(new Map<string, HTMLTextAreaElement>());
  /** Dove rimettere il cursore dopo una modifica che ha spostato le righe. */
  const pendingFocus = useRef<CaretTarget | null>(null);

  /**
   * La casella in cui si sta battendo, con dentro esattamente quello che si e'
   * battuto.
   *
   * Serve perche' ricomporre la barra e riproiettarla puo' spostare uno spazio
   * - una parentesi aperta e non ancora chiusa, per dirne una - e il cursore
   * salterebbe a fine riga a meta' parola. Finche' si scrive comanda questo;
   * appena la casella perde il fuoco, o una barra si spezza o si unisce,
   * torna a comandare il testo vero, che e' l'unica cosa salvata.
   */
  const [typing, setTyping] = useState<{ key: string; value: string } | null>(null);

  const shown = (index: number, column: BarColumn, projected: string): string =>
    typing && typing.key === cellKey(index, column) ? typing.value : projected;

  const focusCell = (index: number, column: BarColumn, caret: number) => {
    const el = cells.current.get(cellKey(index, column));
    if (!el) return;
    el.focus();
    const at = Math.max(0, Math.min(caret, el.value.length));
    el.setSelectionRange(at, at);
  };

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    focusCell(target.index, target.column, target.caret);
  });

  /** La casella lasciata torna a mostrare il testo vero, non la battitura. */
  const forgetTyping = (index: number, column: BarColumn) => {
    setTyping(t => (t && t.key === cellKey(index, column) ? null : t));
  };

  /**
   * `moved` distingue le due situazioni: se le righe sono rimaste quelle il
   * cursore sta gia' dove deve, e toccarlo a ogni tasto lo farebbe solo
   * saltare; se invece una barra si e' spezzata o unita, il cursore va
   * riportato a mano nella barra giusta.
   */
  const applyEdit = (edit: CellEdit | null, moved = false) => {
    if (!edit) return;
    if (moved || edit.lines.length !== lines.length) {
      pendingFocus.current = edit.focus;
      setTyping(null);
    }
    onChange(joinLines(edit.lines));
  };

  const handleCellInput = (
    index: number,
    column: BarColumn,
    next: string,
    caret: number,
  ) => {
    const edit = applyCellInput(lines, index, column, next, caret);
    if (edit.lines.length === lines.length) {
      setTyping({ key: cellKey(index, column), value: next });
    }
    applyEdit(edit);
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number,
    column: BarColumn,
  ) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd =
      el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if (!readOnly && e.key === 'Backspace' && atStart) {
      const edit = mergeIntoPrevious(lines, index, column);
      if (edit) {
        e.preventDefault();
        applyEdit(edit, true);
      }
      return;
    }
    if (!readOnly && e.key === 'Delete' && atEnd) {
      const edit = mergeNext(lines, index, column);
      if (edit) {
        e.preventDefault();
        applyEdit(edit, true);
      }
      return;
    }
    // Su e giu' scavalcano il confine fra una barra e l'altra: dentro una barra
    // che va a capo ci pensa la textarea, qui si interviene solo ai bordi.
    if (e.key === 'ArrowUp' && atStart && index > 0) {
      e.preventDefault();
      focusCell(index - 1, column, Number.MAX_SAFE_INTEGER);
      return;
    }
    if (e.key === 'ArrowDown' && atEnd && index < lines.length - 1) {
      e.preventDefault();
      focusCell(index + 1, column, 0);
    }
  };

  const barCount = countBars(value);

  const renderMixed = () => (
    <div className={`relative flex-1 ${minHeightClass}`}>
      <div
        ref={mirrorRef}
        aria-hidden
        className={`${METRICS} ${INSET} ${GUTTER_INSET} select-none pointer-events-none`}
      >
        {bars.map(bar => (
          <div key={bar.index} className="relative">
            {bar.number !== null && (
              <span className="absolute right-full top-0 mr-2 w-7 text-right text-[11px] leading-6 text-slate-600 tabular-nums">
                {bar.number}
              </span>
            )}
            {bar.text === ''
              ? '\u200B'
              : bar.segments.map((segment, i) => (
                  <span key={i} className={segment.kind === 'adlib' ? ink.adlib : ink.writer}>
                    {segment.text}
                  </span>
                ))}
          </div>
        ))}
      </div>
      <textarea
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        // Rete di sicurezza: se per qualunque motivo la textarea scorre da
        // sola (il cursore che esce dalla vista), i colori la seguono invece
        // di restare indietro di qualche riga.
        onScroll={e => {
          const mirror = mirrorRef.current;
          if (mirror) mirror.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`;
        }}
        className={`absolute inset-0 w-full h-full resize-none overflow-hidden bg-transparent text-transparent caret-blue-400 focus:outline-none placeholder:text-slate-600 ${METRICS} ${INSET} ${GUTTER_INSET}`}
      />
    </div>
  );

  const empty = value === '';
  /**
   * Le stesse righe della vista unita, ma su due colonne.
   *
   * Ogni barra e' una riga sola di questa impaginazione, alta quanto la piu'
   * alta delle sue due colonne: se il testo va a capo tre volte, accanto ci
   * sono tre righe di ad libs anche quando sono vuote, e la barra dopo riparte
   * affiancata in tutte e due. E' l'altezza a essere condivisa, non una
   * griglia: fra una barra e l'altra non c'e' nessuno stacco in piu'.
   */
  const renderSplit = () => (
    <div className={`flex flex-col flex-1 ${minHeightClass} ${INSET} ${GUTTER_INSET}`}>
      <div className="flex items-stretch mb-1 select-none">
        <div
          className={`${WRITER_COL} ${WRITER_PAD} min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-600`}
        >
          Writer
        </div>
        <div
          className={`${ADLIB_COL} ${ADLIB_PAD} min-w-0 text-[10px] font-semibold uppercase tracking-wider text-yellow-300/60`}
        >
          Ad libs
        </div>
      </div>

      {bars.map(bar => (
        <div key={bar.index} className="relative flex items-stretch">
          {bar.number !== null && (
            <span className="absolute right-full top-0 mr-2 w-7 text-right text-[11px] leading-6 text-slate-600 tabular-nums select-none">
              {bar.number}
            </span>
          )}
          <BarCell
            className={`${WRITER_COL} min-w-0`}
            inset={WRITER_PAD}
            label={`Barra ${bar.number ?? bar.index + 1}, testo`}
            value={shown(bar.index, 'writer', bar.writer)}
            ink={ink.writer}
            readOnly={readOnly}
            placeholder={empty ? (readOnly ? placeholder : 'barra...') : undefined}
            register={el => {
              registerCell(cells.current, bar.index, 'writer', el);
            }}
            onInput={(next, caret) => handleCellInput(bar.index, 'writer', next, caret)}
            onBlur={() => forgetTyping(bar.index, 'writer')}
            onKeyDown={e => handleCellKeyDown(e, bar.index, 'writer')}
          />
          <BarCell
            className={`${ADLIB_COL} min-w-0`}
            inset={ADLIB_PAD}
            label={`Barra ${bar.number ?? bar.index + 1}, ad libs`}
            value={shown(bar.index, 'adlibs', bar.adlibs)}
            ink={ink.adlib}
            readOnly={readOnly}
            placeholder={empty && !readOnly ? 'ad lib...' : undefined}
            register={el => {
              registerCell(cells.current, bar.index, 'adlibs', el);
            }}
            onInput={(next, caret) => handleCellInput(bar.index, 'adlibs', next, caret)}
            onBlur={() => forgetTyping(bar.index, 'adlibs')}
            onKeyDown={e => handleCellKeyDown(e, bar.index, 'adlibs')}
          />
        </div>
      ))}

      {/* Lo spazio sotto l'ultima barra porta il cursore dove ci si aspetta. */}
      <div
        className="flex-1 min-h-[1.5rem]"
        onClick={() => focusCell(bars.length - 1, 'writer', Number.MAX_SAFE_INTEGER)}
      />
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {(showBarCount || onFormatChange) && (
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          {showBarCount ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
              {barCount} {barCount === 1 ? 'barra' : 'barre'}
            </span>
          ) : (
            <span />
          )}
          {onFormatChange && <FormatPreferenceButton format={format} onChange={onFormatChange} />}
        </div>
      )}

      {framed ? (
        <div className="flex flex-col flex-1 bg-black/40 border border-slate-900 rounded-xl shadow-inner overflow-hidden transition-colors focus-within:border-blue-500">
          {format === 'split' ? renderSplit() : renderMixed()}
        </div>
      ) : (
        format === 'split' ? renderSplit() : renderMixed()
      )}
    </div>
  );
}

function registerCell(
  map: Map<string, HTMLTextAreaElement>,
  index: number,
  column: BarColumn,
  el: HTMLTextAreaElement | null,
) {
  if (el) map.set(cellKey(index, column), el);
  else map.delete(cellKey(index, column));
}

/**
 * Una casella della vista divisa: una barra, una colonna.
 *
 * Non tiene nessuno stato suo: quello che mostra lo decide l'editor, che sa
 * quando sta arrivando quello che si sta battendo e quando invece e' il testo
 * vero a dover tornare a comandare (vedi `typing` qui sopra).
 */
function BarCell({
  value,
  label,
  ink,
  inset,
  readOnly,
  placeholder,
  onInput,
  onBlur,
  onKeyDown,
  register,
  className = '',
}: {
  value: string;
  label: string;
  ink: string;
  /** Lo stacco dall'altra colonna. Uguale sui due strati, o si sfalsano. */
  inset: string;
  readOnly: boolean;
  placeholder?: string;
  onInput: (value: string, caret: number) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  register: (el: HTMLTextAreaElement | null) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/*
        Il segnaposto sta qui e non nella textarea: cosi' la casella si alza
        quanto serve a contenerlo invece di tagliarlo, che in una colonna
        stretta succede quasi sempre.
      */}
      <div aria-hidden className={`${METRICS} ${inset} ${ink} select-none pointer-events-none`}>
        {value === '' ? <span className="text-slate-700">{placeholder || '\u200B'}</span> : value}
      </div>
      <textarea
        ref={register}
        value={value}
        aria-label={label}
        readOnly={readOnly}
        spellCheck={false}
        rows={1}
        onBlur={onBlur}
        onChange={e => onInput(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        className={`absolute inset-0 w-full h-full resize-none overflow-hidden bg-transparent text-transparent caret-blue-400 focus:outline-none placeholder:text-slate-700 ${METRICS} ${inset}`}
      />
    </div>
  );
}
