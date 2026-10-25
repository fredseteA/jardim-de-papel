import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { StoryChapter } from '../../types/story';
import type { ReaderSettings } from './logic/readerCore';
import styles from './ReaderDialogs.module.css';

type ReaderDialogsProps = {
  open: 'chapters' | 'settings' | null;
  chapters: readonly StoryChapter[];
  currentChapterId: string;
  settings: ReaderSettings;
  hasNarration: boolean;
  hasMusic: boolean;
  onSettingsChange: (settings: ReaderSettings) => void;
  onSelectChapter: (chapterId: string) => void;
  onRestart: () => void;
  onClose: () => void;
};

export function ReaderDialogs({ open, chapters, currentChapterId, settings, hasNarration, hasMusic, onSettingsChange, onSelectChapter, onRestart, onClose }: ReaderDialogsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [open]);

  if (!open) return null;
  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.panel} ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="reader-dialog-title">
      <div className={styles.heading}>
        <h2 id="reader-dialog-title">{open === 'chapters' ? 'Capítulos' : 'Ajustes de leitura'}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar"><X size={20} aria-hidden="true" /></button>
      </div>
      {open === 'chapters' ? <ol className={styles.chapterList}>{[...chapters].sort((a, b) => a.order - b.order).filter((chapter) => chapter.pages.length > 0).map((chapter, index) => <li key={chapter.id}>
        <button type="button" aria-current={chapter.id === currentChapterId ? 'true' : undefined} onClick={() => onSelectChapter(chapter.id)}><span>Capítulo {index + 1}</span><strong>{chapter.title}</strong></button>
      </li>)}</ol> : <div className={styles.settings}>
        <p>Personalize sua experiência de leitura.</p>
        <label>Tamanho do texto <output>{settings.fontSize}px</output><input aria-label="Tamanho do texto" type="range" min="14" max="28" step="1" value={settings.fontSize} onChange={(event) => onSettingsChange({ ...settings, fontSize: Number(event.target.value) })} /></label>
        <label>Contraste do texto <select value={settings.contrast} onChange={(event) => onSettingsChange({ ...settings, contrast: event.target.value as ReaderSettings['contrast'] })}><option value="auto">Automático</option><option value="dark">Escuro</option><option value="light">Claro</option></select></label>
        <label><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => onSettingsChange({ ...settings, reduceMotion: event.target.checked })} /> Reduzir movimentos</label>
        <label>Espaçamento entre linhas <output>{settings.lineHeight.toFixed(1)}</output><input aria-label="Espaçamento entre linhas" type="range" min="1.3" max="2.2" step="0.1" value={settings.lineHeight} onChange={(event) => onSettingsChange({ ...settings, lineHeight: Number(event.target.value) })} /></label>
        <label>Tema <select value={settings.theme} onChange={(event) => onSettingsChange({ ...settings, theme: event.target.value as ReaderSettings['theme'] })}><option value="light">Claro</option><option value="sepia">Sépia</option><option value="dark">Escuro</option></select></label>
        <label>Alinhamento <select value={settings.alignment} onChange={(event) => onSettingsChange({ ...settings, alignment: event.target.value as ReaderSettings['alignment'] })}><option value="left">À esquerda</option><option value="justify">Justificado</option></select></label>
        {(!hasNarration || !hasMusic) && <p className={styles.audioNote}>{!hasNarration && !hasMusic ? 'Narração e música ainda não estão disponíveis para esta história.' : !hasNarration ? 'Esta história ainda não tem narração.' : 'Esta história ainda não tem música.'}</p>}
        <button className={styles.restart} type="button" onClick={onRestart}>Recomeçar história</button>
      </div>}
    </div>
  </div>;
}
