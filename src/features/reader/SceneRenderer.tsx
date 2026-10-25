import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { StoryPage } from '../../types/story';
import styles from './SceneRenderer.module.css';

type SceneRendererProps = {
  page: StoryPage;
  sceneIndex: number;
  revealed: boolean;
  reducedMotion: boolean;
  narrationPlaying: boolean;
  hasAudio: boolean;
  onReveal: () => void;
  fontSize?: number;
  lineHeight?: number;
  contrast?: 'auto' | 'dark' | 'light';
  onToggleControls?: () => void;
};

/** Renders existing editorial media; video is optional and never substitutes narration. */
export function SceneRenderer({ page, sceneIndex, revealed, reducedMotion, narrationPlaying, hasAudio, onReveal, fontSize = 18, lineHeight = 1.65, contrast = 'auto', onToggleControls }: SceneRendererProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [textOverflows, setTextOverflows] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textScrollRef = useRef<HTMLDivElement>(null);
  const illustration = page.illustration;
  const canPlayVideo = page.animation && !reducedMotion && !videoFailed;
  const fallback = illustration ?? page.animation?.poster;
  const effect = page.presentation?.textEffect ?? 'words';
  const motion = page.presentation?.motion ?? (['drift', 'zoom', 'breathe'] as const)[sceneIndex % 3];
  const words = page.text.split(/\s+/u).filter(Boolean);

  useEffect(() => {
    const container = textScrollRef.current;
    if (!container) return;
    const updateOverflow = () => setTextOverflows(container.scrollHeight > container.clientHeight + 1);
    updateOverflow();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow);
    observer?.observe(container);
    window.addEventListener('resize', updateOverflow);
    return () => { observer?.disconnect(); window.removeEventListener('resize', updateOverflow); };
  }, [page.text, hasAudio]);

  useEffect(() => {
    const video = videoRef.current;
    return () => { if (video) video.pause(); };
  }, [page.animation?.src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || page.animation?.playbackBehavior !== 'with-narration') return;
    if (narrationPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [narrationPlaying, page.animation?.playbackBehavior]);

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { video.pause(); return; }
    try { await video.play(); } catch { setVideoFailed(true); }
  }

  return <div className={styles.scene} data-position={page.presentation?.textPosition ?? 'top-left'} data-audio={hasAudio}>
    <div className={styles.visual} data-motion={reducedMotion ? 'none' : motion} onClick={onToggleControls}>
      {canPlayVideo ? <video ref={videoRef} className={styles.image} src={page.animation?.src} poster={page.animation?.poster?.src ?? illustration?.src} autoPlay={!page.animation?.playbackBehavior || page.animation.playbackBehavior === 'on-page-enter'} muted loop={page.animation?.loop} playsInline onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onEnded={() => setVideoPlaying(false)} onError={() => setVideoFailed(true)} aria-hidden="true" /> :
        fallback?.src && !imageFailed ? <img className={fallback.spritePosition ? styles.sprite : styles.image} data-sprite-position={fallback.spritePosition} src={fallback.src} alt={fallback.alt} onError={() => setImageFailed(true)} /> :
          <div className={styles.missingImage} role="img" aria-label="Ilustração da cena indisponível" />}
    </div>
    <div className={styles.shade} aria-hidden="true" />
    <div className={styles.textArea} data-contrast={contrast} style={{ '--reader-text-scale': fontSize / 18, '--reader-line-height': lineHeight } as CSSProperties}>
      <div ref={textScrollRef} className={styles.textScroll} role={textOverflows ? 'region' : undefined} aria-label={textOverflows ? 'Texto da cena, role para ler o restante' : undefined} tabIndex={textOverflows ? 0 : undefined}>
        <p className={styles.text} onClick={!revealed ? onReveal : undefined} data-effect={effect} data-revealed={revealed || reducedMotion} aria-label={page.text}>
          <span aria-hidden="true">{words.map((word, index) => <span className={styles.word} key={`${index}-${word}`} style={{ animationDelay: `${Math.min(index * 35, 750)}ms` }}>{word}{index < words.length - 1 ? ' ' : ''}</span>)}</span>
        </p>
      </div>
      {textOverflows && <span className={styles.scrollHint} aria-hidden="true">Role para continuar ↓</span>}
      {!revealed && !reducedMotion && effect !== 'none' && <button type="button" className={styles.reveal} onClick={onReveal}>Mostrar todo o texto</button>}
      {canPlayVideo && page.animation?.playbackBehavior === 'manual' && <button type="button" className={styles.reveal} onClick={toggleVideo}>{videoPlaying ? 'Pausar animação' : 'Reproduzir animação'}</button>}
    </div>
  </div>;
}
