import { useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import type { PreparationProgress } from './storyMediaCache';
import styles from './AdventureLoading.module.css';

export function AdventureLoading({ title, progress, error, onRetry, onBack }: { title?: string; progress?: PreparationProgress; error?: string; onRetry?: () => void; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const percentage = progress?.total ? Math.floor(progress.loaded / progress.total * 100) : undefined;
  return <section className={styles.page} aria-labelledby="adventure-loading-title">
    <button className={styles.back} onClick={onBack} type="button"><ArrowLeft size={18} aria-hidden="true" /> Voltar à capa</button>
    <div className={styles.card}>
      <div className={styles.art} aria-hidden="true"><span className={styles.halo} /><Sparkles className={styles.sparkles} size={34} /><img src="/assets/icons/livro-aberto.png" alt="" width="160" height="160" /></div>
      <p className={styles.eyebrow}>Jardim de Papel</p>
      <h1 ref={heading} tabIndex={-1} id="adventure-loading-title">{error ? 'Falta um pedacinho da aventura…' : 'Estamos preparando sua aventura!'}</h1>
      {title && <p className={styles.story}>{title}</p>}
      <p className={styles.description}>{error ? 'Vamos tentar buscar os arquivos que faltam?' : 'Reunindo as ilustrações, os sons e um pouquinho de magia para você.'}</p>
      {!error && <><progress className={styles.progress} aria-label="Preparação da história" max={100} value={percentage} /><p className={styles.status} role="status" aria-live="polite">{progress?.total ? `${progress.loaded} de ${progress.total} arquivos preparados · ${percentage}%` : 'Abrindo o livro…'}</p></>}
      {error && <><p className={styles.error} role="alert">{error}</p><button className={styles.retry} type="button" onClick={onRetry}><RefreshCw size={18} aria-hidden="true" /> Tentar novamente</button></>}
      <p className={styles.hint}>{error ? 'Você pode tentar de novo ou voltar à capa.' : 'Logo, logo, a história vai começar.'}</p>
    </div>
  </section>;
}
