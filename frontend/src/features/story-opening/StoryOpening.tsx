import { ArrowLeft, BookOpen, Clock3, Heart, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Story, StoryIllustration } from '../../types/story';
import { getEstimatedReadingMinutes } from '../../lib/readingTime';
import { useFavorites } from '../profile/useFavorites';
import { clearProgress, readProgress } from '../reader/logic/readerCore';
import styles from './StoryOpening.module.css';

function PreviewGallery({ images }: { images: readonly StoryIllustration[] }) {
  if (!images.length) return null;
  return <section className={styles.previews} aria-label="Prévia da história">
    <div className={styles.previewGrid}>{images.map((image, index) => <div className={styles.preview} key={`${image.src}-${index}`}>
      <img src={image.src} alt={image.alt} loading="lazy" decoding="async" className={image.spritePosition ? styles.sprite : undefined} data-position={image.spritePosition} />
    </div>)}</div>
    {images.some((image) => image.demonstrative) && <p className={styles.previewNote}>Imagens de prévia demonstrativas</p>}
  </section>;
}

function StoryTitle({ title }: { title: string }) {
  return <div className={styles.titleOrnament}>
    <img src="/assets/decorations/story-title-ornament.png" alt="" aria-hidden="true" />
    <h1 aria-label={title}><span aria-hidden="true">{title.split(' ').map((word, wordIndex) => {
      const characters = Array.from(word);
      const lastIndex = Math.max(characters.length - 1, 1);
      return <span className={styles.titleWord} key={`${wordIndex}-${word}`}>{characters.map((character, characterIndex) => {
        const position = (characterIndex / lastIndex) * 2 - 1;
        return <span key={characterIndex} style={{ transform: `translateY(${position * position * 3}px)` }}>{character}</span>;
      })}</span>;
    })}</span></h1>
  </div>;
}

export function StoryOpening({ story }: { story: Story }) {
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const isFavorite = favoriteIds.includes(story.id);
  const cover = story.coverImage?.mobile ?? story.coverImage?.desktop;
  const pageCount = story.chapters.reduce((count, chapter) => count + chapter.pages.length, 0);
  const estimatedMinutes = getEstimatedReadingMinutes(story);
  const progress = readProgress(story);
  const startReading = (restart = false) => {
    if (restart || progress?.completed) clearProgress(story.id);
    navigate(`/historias/${story.slug}/ler`);
  };
  const goBack = () => {
    if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigate(-1);
    else navigate('/biblioteca', { replace: true });
  };

  return <article className={styles.page}>
    <div className={styles.layout}>
      <div className={styles.hero}>
        {cover && <img className={styles.heroImage} src={cover.src} alt={cover.alt} />}
        <div className={styles.actions}>
          <button className={styles.iconButton} type="button" onClick={goBack} aria-label="Voltar"><ArrowLeft size={21} aria-hidden="true" /></button>
          <button className={styles.iconButton} type="button" onClick={() => toggleFavorite(story.id)} aria-pressed={isFavorite} aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}><Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" /></button>
        </div>
      </div>
      <div className={styles.content}>
        <StoryTitle title={story.title} />
        <div className={styles.details}>
          <div className={styles.meta}>
            {story.collectionDescription && <span><BookOpen size={16} aria-hidden="true" />{story.collectionDescription}</span>}
            {story.ageRange && <span><UsersRound size={16} aria-hidden="true" />{story.ageRange}</span>}
            {estimatedMinutes && <span><Clock3 size={16} aria-hidden="true" />{estimatedMinutes} min</span>}
          </div>
          {story.synopsis && <p className={styles.synopsis}>{story.synopsis}</p>}
          <PreviewGallery images={story.presentationMedia?.previewImages ?? []} />
          <div className={styles.ctaWrap}>
            <button className={styles.cta} type="button" disabled={pageCount === 0} aria-describedby={pageCount === 0 ? 'reader-status' : undefined} onClick={() => startReading()}>
              {progress?.completed ? 'Ler novamente' : progress ? 'Continuar a aventura' : 'Começar a aventura'}
            </button>
            {progress && !progress.completed && <button className={styles.restart} type="button" onClick={() => startReading(true)}>Recomeçar história</button>}
            {pageCount === 0 && <p id="reader-status" className={styles.readerNote}><Clock3 size={16} aria-hidden="true" /> Leitor em preparação</p>}
          </div>
        </div>
      </div>
    </div>
  </article>;
}
