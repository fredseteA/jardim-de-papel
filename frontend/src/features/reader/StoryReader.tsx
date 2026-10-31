import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, BookOpenText, ChevronLeft, ChevronRight, List, Settings2, Sparkles, Eye, EyeOff, Maximize2, Minimize2, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Story } from '../../types/story';
import { SceneRenderer } from './SceneRenderer';
import { useReaderFullscreen } from './useReaderFullscreen';
import { ReaderDialogs } from './ReaderDialogs';
import { ReaderAudio } from './ReaderAudio';
import { TraditionalReader } from './TraditionalReader';
import { getStoryPages } from './logic/navigation';
import { clearProgress, getSceneIndex, getScenes, nextScene, previousScene, readProgress, readReaderSettings, writeProgress, writeReaderSettings, type ReaderMode, type ReaderSettings } from './logic/readerCore';
import styles from './StoryReader.module.css';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export function StoryReader({ story }: { story: Story }) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = typeof (location.state as { returnTo?: unknown } | null)?.returnTo === 'string' && (location.state as { returnTo: string }).returnTo.startsWith('/') && !(location.state as { returnTo: string }).returnTo.startsWith('//') ? (location.state as { returnTo: string }).returnTo : '/biblioteca';
  const scenes = useMemo(() => getScenes(story), [story]);
  const pages = useMemo(() => getStoryPages(story), [story]);
  const [initialProgress] = useState(() => readProgress(story));
  const [index, setIndex] = useState(() => initialProgress ? getSceneIndex(scenes, initialProgress.chapterId, initialProgress.pageId) : 0);
  const [mode, setMode] = useState<ReaderMode>(() => initialProgress?.mode ?? 'immersive');
  const [completed, setCompleted] = useState(() => initialProgress?.completed ?? false);
  const [settings, setSettings] = useState<ReaderSettings>(() => readReaderSettings());
  const [dialog, setDialog] = useState<'chapters' | 'settings' | null>(null);
  const [pendingChapter, setPendingChapter] = useState<number | null>(null);
  const [revealedPage, setRevealedPage] = useState<string | null>(null);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = systemReducedMotion || settings.reduceMotion;
  const [controlsHidden, setControlsHidden] = useState(false);
  const fullscreen=useReaderFullscreen();
  const scene = scenes[index];
  const revealed = !!scene && (reducedMotion || scene.page.presentation?.textEffect === 'none' || revealedPage === scene.page.id);

  useEffect(() => {
    if (scene) writeProgress(story, index, mode, completed);
  }, [story, scene, index, mode, completed]);
  useEffect(() => { writeReaderSettings(settings); }, [settings]);
  useEffect(() => {
    if (!scene || revealed) return;
    const wordCount = scene.page.text.trim().split(/\s+/u).filter(Boolean).length;
    const delay = scene.page.presentation?.textEffect === 'fade' || scene.page.presentation?.textEffect === 'rise' ? 700 : Math.min(wordCount * 35, 750) + 350;
    const timer = window.setTimeout(() => setRevealedPage(scene.page.id), delay);
    return () => window.clearTimeout(timer);
  }, [scene, revealed]);
  useEffect(() => {
    const nextPage = scenes[index + 1]?.page;
    const next = nextPage?.illustration?.src ?? nextPage?.animation?.poster?.src;
    if (!next) return;
    const image = new Image();
    image.src = next;
    // Files are already local after preparation; warm decoding of only the next
    // illustration instead of retaining every decoded scene in mobile memory.
    void image.decode?.().catch(() => {});
    return () => { image.onload = null; image.onerror = null; };
  }, [scenes, index]);

  const goTo = useCallback((target: number) => {
    setNarrationPlaying(false);
    setIndex(target);
    setNavigationVersion((value) => value + 1);
  }, []);
  const advance = useCallback(() => {
    if (!scene || completed || pendingChapter !== null) return;
    if (mode === 'immersive' && !revealed) { setRevealedPage(scene.page.id); return; }
    const result = nextScene(scenes, index);
    if (result.type === 'complete') { setCompleted(true); }
    else if (result.type === 'chapter') { setPendingChapter(result.index); }
    else goTo(result.index);
  }, [scene, completed, pendingChapter, mode, revealed, scenes, index, goTo]);
  useEffect(() => {
    if (mode !== 'immersive' || dialog || completed || pendingChapter !== null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea, a, [role="region"]')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); advance(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(previousScene(scenes, index)); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, completed, dialog, goTo, index, mode, pendingChapter, scenes]);

  const restart = () => {
    clearProgress(story.id);
    setDialog(null);
    setPendingChapter(null);
    setCompleted(false);
    setRevealedPage(null);
    goTo(0);
  };
  const switchMode = () => {
    setMode((previous) => previous === 'immersive' ? 'traditional' : 'immersive');
    setNavigationVersion((value) => value + 1);
  };
  const selectChapter = (chapterId: string) => {
    const target = scenes.findIndex((item) => item.chapter.id === chapterId);
    if (target >= 0) { goTo(target); }
    setDialog(null);
  };

  if (!scene) return <div className={styles.empty}><h1>História indisponível</h1><p>Esta história ainda não possui cenas para leitura.</p><Link to={`/historias/${story.slug}`}>Voltar à história</Link></div>;
  const chapterCount = new Set(scenes.map((item) => item.chapter.id)).size;
  const nextChapter = pendingChapter === null ? null : scenes[pendingChapter];

  return <div className={styles.reader} data-mode={mode} data-reduced-motion={reducedMotion}>
    <header data-reader-chrome="header" className={styles.header}>
      <button type="button" className={styles.roundButton} aria-label="Voltar à apresentação da história" onClick={() => navigate(`/historias/${story.slug}`, { replace: true, state: { returnTo } })}><ArrowLeft size={22} aria-hidden="true" /></button>
      <div className={styles.headerTitle}><span>{story.title}</span><small>Capítulo {scene.chapterIndex + 1} de {chapterCount} · Cena {scene.pageIndex + 1} de {scene.chapter.pages.length}</small></div>
      <div className={styles.headerActions}>{mode === 'immersive' && <button type="button" className={styles.controlsToggle} aria-label={controlsHidden ? 'Mostrar controles' : 'Recolher controles'} aria-expanded={!controlsHidden} onClick={() => setControlsHidden((value) => !value)}>{controlsHidden ? <Eye size={19} aria-hidden="true" /> : <EyeOff size={19} aria-hidden="true" />}</button>}<button type="button" className={styles.roundButton} aria-label={fullscreen.active ? 'Sair da tela cheia' : 'Entrar em tela cheia'} aria-pressed={fullscreen.active} aria-busy={fullscreen.busy} disabled={fullscreen.busy} onClick={() => void fullscreen.toggle()}>{fullscreen.active ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}</button><button type="button" className={styles.roundButton} aria-label="Ajustes de leitura" onClick={() => setDialog('settings')}><Settings2 size={21} aria-hidden="true" /></button></div>
    </header>
    {fullscreen.message && <div className={styles.displayNotice} role="status"><span>{fullscreen.message}</span><button type="button" aria-label="Fechar aviso de tela cheia" onClick={fullscreen.clearMessage}><X size={17} aria-hidden="true" /></button></div>}
    {mode === 'immersive' && <SceneRenderer key={scene.page.id} page={scene.page} sceneIndex={index} revealed={revealed} reducedMotion={reducedMotion} narrationPlaying={narrationPlaying} hasAudio={!!scene.page.narration?.src || !!scene.page.music?.src || !!story.audio?.backgroundMusic?.src} fontSize={settings.fontSize} lineHeight={settings.lineHeight} contrast={settings.contrast} onToggleControls={() => setControlsHidden((value) => !value)} onReveal={() => setRevealedPage(scene.page.id)} />}
    {mode === 'traditional' && <div className={styles.traditional}><TraditionalReader pages={pages} currentPageId={scene.page.id} navigationVersion={navigationVersion} fontSize={settings.fontSize} lineHeight={settings.lineHeight} theme={settings.theme} textAlign={settings.alignment} onVisiblePageChange={(pageId) => { const target = scenes.findIndex((item) => item.page.id === pageId); if (target >= 0 && target !== index) { setNarrationPlaying(false); setIndex(target); } }} /></div>}
    <footer data-reader-chrome="footer" className={styles.footer} data-has-audio={!!scene.page.narration?.src || !!scene.page.music?.src || !!story.audio?.backgroundMusic?.src} data-hidden={mode === 'immersive' && controlsHidden} inert={mode === 'immersive' && controlsHidden}>
      <div className={styles.audioSlot}><ReaderAudio pageId={scene.page.id} narration={scene.page.narration} music={scene.page.music ?? story.audio?.backgroundMusic} paused={completed || pendingChapter !== null} finished={completed} onNarrationPlayingChange={setNarrationPlaying} /></div>
      <div className={styles.actions}>
        <button type="button" className={styles.control} aria-label="Cena anterior" disabled={index === 0} onClick={() => { goTo(previousScene(scenes, index)); }}><ChevronLeft size={23} aria-hidden="true" /></button>
        <button type="button" className={styles.control} aria-label="Abrir capítulos" onClick={() => setDialog('chapters')}><List size={23} aria-hidden="true" /></button>
        <button type="button" className={styles.control} aria-label={mode === 'immersive' ? 'Mudar para leitura tradicional' : 'Mudar para leitura imersiva'} onClick={switchMode}>{mode === 'immersive' ? <BookOpenText size={23} aria-hidden="true" /> : <Sparkles size={23} aria-hidden="true" />}</button>
        <button type="button" className={styles.control} aria-label={index === scenes.length - 1 ? 'Concluir história' : 'Próxima cena'} onClick={() => { advance(); }}><ChevronRight size={23} aria-hidden="true" /></button>
      </div>
      <div className={styles.progressRow}><div className={styles.progressTrack} role="progressbar" aria-label="Progresso da história" aria-valuemin={0} aria-valuemax={scenes.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / scenes.length) * 100}%` }} /></div><span>{index + 1}/{scenes.length}</span></div>
    </footer>
    <ReaderDialogs open={dialog} chapters={story.chapters} currentChapterId={scene.chapter.id} settings={settings} hasNarration={scenes.some((item) => !!item.page.narration?.src)} hasMusic={!!story.audio?.backgroundMusic?.src || scenes.some((item) => !!item.page.music?.src)} onSettingsChange={setSettings} onSelectChapter={selectChapter} onRestart={restart} onClose={() => setDialog(null)} />
    {nextChapter && <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="next-chapter-title"><div className={styles.moment}><span>Próximo capítulo</span><p>Capítulo {nextChapter.chapterIndex + 1} de {chapterCount}</p><h2 id="next-chapter-title">{nextChapter.chapter.title}</h2><button type="button" onClick={() => { goTo(pendingChapter!); setPendingChapter(null); }}>Continuar a história</button><button type="button" className={styles.secondary} onClick={() => setPendingChapter(null)}>Voltar à cena</button></div></div>}
    {completed && <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="finished-title"><div className={styles.moment}><BookOpen size={34} aria-hidden="true" /><span>História concluída</span><h1 id="finished-title">E assim termina esta aventura.</h1><p>Que tal guardar esta história no coração?</p><button type="button" onClick={restart}>Ler novamente</button><Link to="/biblioteca">Voltar à biblioteca</Link></div></div>}
  </div>;
}
