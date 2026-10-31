import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, RotateCw, Smartphone } from 'lucide-react';
import { isPhoneViewport, readingViewport, shouldSuggestOrientation } from './readerViewport';
import { createReaderDisplaySession } from './readerDisplaySession';
import { ReaderDisplayContext } from './ReaderDisplayContext';
import styles from './ReaderEntry.module.css';

function useReadingViewport() {
  const [viewport, setViewport] = useState(readingViewport);
  useEffect(() => {
    const update = () => setViewport(readingViewport());
    const media = typeof matchMedia === 'function' ? [matchMedia('(pointer: coarse)'), matchMedia('(hover: none)')] : [];
    window.addEventListener('resize', update); window.visualViewport?.addEventListener('resize', update);
    media.forEach(item => item.addEventListener?.('change', update));
    return () => { window.removeEventListener('resize', update); window.visualViewport?.removeEventListener('resize', update); media.forEach(item => item.removeEventListener?.('change', update)); };
  }, []);
  return viewport;
}

export function OrientationPrompt({ waiting, onAccept, onContinue }: { waiting: boolean; onAccept: () => void; onContinue: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const title = useId(); const description = useId();
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = ref.current; node?.showModal();
    return () => { node?.close(); };
  }, []);
  useEffect(() => { if (waiting) continueButton.current?.focus(); }, [waiting]);
  return <dialog ref={ref} className={styles.dialog} aria-modal="true" aria-labelledby={title} aria-describedby={description} onCancel={event => { event.preventDefault(); onContinue(); }}>
    <div className={styles.symbol} aria-hidden="true"><Smartphone size={44} /><RotateCw size={23} /></div>
    <p className={styles.eyebrow}>UM CONVITE À AVENTURA</p><h1 id={title}>{waiting ? 'Gire seu celular para continuar' : 'Uma experiência ainda mais encantadora!'}</h1>
    <p id={description}>{waiting ? 'Se a tela não girar automaticamente, vire o celular para a horizontal. Você também pode continuar na vertical quando quiser.' : 'Para aproveitar melhor as ilustrações e a leitura, experimente usar seu celular na horizontal. Você gostaria de ler com a tela deitada?'}</p>
    {waiting ? <p className={styles.hint} role="status">Aguardando a orientação horizontal da tela. Seu navegador pode exigir rotação manual.</p> : <button className={styles.primary} onClick={onAccept}>Ler na horizontal <ArrowRight size={18} aria-hidden="true" /></button>}
    <button ref={continueButton} className={styles.secondary} onClick={onContinue}>Continuar na vertical</button>
  </dialog>;
}

/** Keeps the reader mounted after entry, including rotation/fullscreen changes. */
export function ReaderEntry({ suggestOrientation, children }: { suggestOrientation: boolean; children: ReactNode }) {
  const viewport = useReadingViewport();
  const [phase, setPhase] = useState<'ask' | 'rotate' | 'reading'>(() => suggestOrientation && shouldSuggestOrientation(viewport) ? 'ask' : 'reading');
  const session = useRef<ReturnType<typeof createReaderDisplaySession> | null>(null);
  const getSession=useCallback(()=>{if(!session.current)session.current=createReaderDisplaySession();return session.current;},[]);
  useEffect(() => {
    const value = createReaderDisplaySession(); session.current = value;
    return () => { const current=session.current;session.current=null;void current?.release(); };
  }, []);
  useEffect(() => {
    if (phase !== 'reading' && (viewport.width > viewport.height || !isPhoneViewport(viewport.width, viewport.height) || !viewport.coarsePointer || !viewport.noHover)) setPhase('reading');
  }, [phase, viewport]);
  const continueNormally = () => { const current=session.current;session.current=null;void current?.release();setPhase('reading'); };
  if (phase === 'reading') return <ReaderDisplayContext.Provider value={getSession}>{children}</ReaderDisplayContext.Provider>;
  return <OrientationPrompt waiting={phase === 'rotate'} onAccept={() => { setPhase('rotate'); void session.current?.requestLandscape(); }} onContinue={continueNormally} />;
}
