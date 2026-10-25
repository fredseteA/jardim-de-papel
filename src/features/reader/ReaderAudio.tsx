import { useEffect, useRef, useState } from 'react';
import { Headphones, Music2, VolumeX } from 'lucide-react';
import type { StoryMusic, StoryNarration } from '../../types/story';
import styles from './ReaderAudio.module.css';

type ReaderAudioProps = {
  pageId: string;
  narration?: StoryNarration;
  music?: StoryMusic;
  paused: boolean;
  finished: boolean;
  onNarrationPlayingChange: (playing: boolean) => void;
};

/** Audio starts only through a user gesture; a page change never restarts the music. */
export function ReaderAudio({ pageId, narration, music, paused, finished, onNarrationPlayingChange }: ReaderAudioProps) {
  const narrationRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const audio = narrationRef.current;
    return () => {
      if (audio) { audio.pause(); audio.currentTime = 0; }
    };
  }, [pageId, narration?.src]);

  useEffect(() => {
    const audio = musicRef.current;
    return () => { audio?.pause(); };
  }, [music?.src]);

  useEffect(() => {
    if (paused) narrationRef.current?.pause();
  }, [paused]);

  useEffect(() => { if (finished) musicRef.current?.pause(); }, [finished]);

  async function toggleNarration() {
    const audio = narrationRef.current;
    if (!audio) return;
    setError('');
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); } catch { setError('Não foi possível reproduzir a narração.'); }
  }

  async function toggleMusic() {
    const audio = musicRef.current;
    if (!audio) return;
    setError('');
    if (!musicStarted || audio.paused) {
      audio.muted = false;
      setMusicMuted(false);
      try { await audio.play(); } catch { setError('Não foi possível reproduzir a música.'); }
      return;
    }
    audio.muted = !audio.muted;
    setMusicMuted(audio.muted);
  }

  if (!narration?.src && !music?.src) return null;
  return <div className={styles.audioControls}>
    {narration?.src && <>
      <audio key={`${pageId}-${narration.src}`} ref={narrationRef} src={narration.src} preload="none" onPlay={() => { setNarrationPlaying(true); onNarrationPlayingChange(true); }} onPause={() => { setNarrationPlaying(false); onNarrationPlayingChange(false); }} onEnded={() => { setNarrationPlaying(false); onNarrationPlayingChange(false); }} onError={() => { setNarrationPlaying(false); onNarrationPlayingChange(false); setError('Narração indisponível nesta cena.'); }} />
      <button type="button" onClick={toggleNarration} disabled={paused} aria-label={narrationPlaying ? 'Pausar narração desta cena' : 'Ouvir narração desta cena'}><Headphones size={16} aria-hidden="true" />{narrationPlaying ? 'Pausar narração' : 'Ouvir narração'}</button>
    </>}
    {music?.src && <>
      <audio key={music.src} ref={musicRef} src={music.src} loop={music.loop} preload="none" onPlay={() => setMusicStarted(true)} onPause={() => setMusicStarted(false)} onEnded={() => setMusicStarted(false)} onError={() => { setMusicStarted(false); setError('Música indisponível nesta história.'); }} />
      <button type="button" onClick={toggleMusic} disabled={finished} aria-label={!musicStarted ? 'Ativar música' : musicMuted ? 'Ativar som da música' : 'Silenciar música'}>{musicMuted ? <VolumeX size={16} aria-hidden="true" /> : <Music2 size={16} aria-hidden="true" />}{!musicStarted ? 'Ativar música' : musicMuted ? 'Música silenciada' : 'Silenciar música'}</button>
    </>}
    {error && <span role="status" className={styles.error}>{error}</span>}
  </div>;
}
