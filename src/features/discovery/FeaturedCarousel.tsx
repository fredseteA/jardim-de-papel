import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { chapeuzinhoVermelho } from '../../data/stories';
import styles from './HomeHero.module.css';

const slides = [
  { id: 'chapeuzinho-vermelho', kind: 'story' as const, story: chapeuzinhoVermelho },
  { id: 'soon-1', kind: 'soon' as const, title: 'Em breve', text: 'Um novo destaque chegará em breve ao Jardim de Papel.' },
  { id: 'soon-2', kind: 'soon' as const, title: 'Em breve', text: 'Um novo destaque chegará em breve ao Jardim de Papel.' },
  { id: 'soon-3', kind: 'soon' as const, title: 'Em breve', text: 'Um novo destaque chegará em breve ao Jardim de Papel.' },
];

export function FeaturedCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(document.hidden);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const active = slides[activeIndex]!;
  const isPaused = isHovered || hasFocus || isTouching || isDocumentHidden;
  const changeSlide = (nextIndex: number) => { setActiveIndex((nextIndex + slides.length) % slides.length); setRestartKey((key) => key + 1); };
  const move = (direction: number) => changeSlide(activeIndex + direction);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const timer = window.setTimeout(() => setActiveIndex((current) => (current + 1) % slides.length), 5000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, prefersReducedMotion, restartKey]);

  const onTouchEnd = (event: TouchEvent) => { if (startX.current === null) return; const difference = event.changedTouches[0].clientX - startX.current; startX.current = null; setIsTouching(false); if (Math.abs(difference) > 40) move(difference < 0 ? 1 : -1); else setRestartKey((key) => key + 1); };
  return <section className={styles.featuredSection} aria-roledescription="carrossel" aria-label="Histórias em destaque" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onFocusCapture={() => setHasFocus(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false); }}>
    <div className={styles.cardViewport} onTouchStart={(event) => { startX.current = event.touches[0].clientX; setIsTouching(true); }} onTouchEnd={onTouchEnd} onTouchCancel={() => { startX.current = null; setIsTouching(false); }}>
      {active.kind === 'story' ? <article key={active.id} className={styles.featuredCard}>
        <img className={styles.cover} src={active.story.coverImage?.mobile?.src ?? active.story.coverImage?.desktop.src} alt={active.story.coverImage?.mobile?.alt ?? active.story.coverImage?.desktop.alt ?? ''} />
        <div className={styles.overlay} />
        <div className={styles.cardCopy}><span className={styles.category}>★ CONTO CLÁSSICO</span><h2>{active.story.title}</h2><p>{active.story.description}</p><Link className={styles.cta} to={`/historias/${active.story.slug}`}>Começar aventura <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </article> : <article key={active.id} className={`${styles.featuredCard} ${styles.soonCard}`}><div className={styles.soonOrnament} aria-hidden="true" /><div className={styles.cardCopy}><span className={styles.category}>EM BREVE</span><h2>{active.title}</h2><p>{active.text}</p></div></article>}
    </div>
    <div className={styles.carouselControls}><button type="button" onClick={() => move(-1)} aria-label="Slide anterior" className={`${styles.arrowButton} ${styles.previousButton}`}><ChevronLeft size={16} aria-hidden="true" />Anterior</button><div className={styles.indicators} role="tablist" aria-label="Selecionar destaque">{slides.map((slide, index) => <button type="button" key={slide.id} onClick={() => changeSlide(index)} className={index === activeIndex ? styles.indicatorActive : styles.indicator} aria-label={`Ir para o slide ${index + 1}`} aria-selected={index === activeIndex} role="tab" />)}</div><button type="button" onClick={() => move(1)} aria-label="Próximo slide" className={`${styles.arrowButton} ${styles.nextButton}`}>Próximo<ChevronRight size={16} aria-hidden="true" /></button></div>
  </section>;
}
