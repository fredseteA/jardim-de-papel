import { useMemo, useState } from 'react';
import { StoryBookCard } from '../components/stories/StoryBookCard';
import { discoverStoryBooks } from '../data/discoverStoriesPresentation';
import { HomeHeader } from '../features/discovery/HomeHeader';
import styles from './LibraryPage.module.css';

type FilterId = 'all' | 'classics' | 'fables' | 'faith' | 'fantasy' | 'narnia';

const filters: ReadonlyArray<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'classics', label: 'Contos Clássicos' },
  { id: 'fables', label: 'Fábulas' },
  { id: 'faith', label: 'Fé' },
  { id: 'fantasy', label: 'Fantasia' },
  { id: 'narnia', label: 'Nárnia' },
];

function matchesFilter(category: string, filter: FilterId) {
  if (filter === 'all') return true;
  if (filter === 'classics')
    return category === 'Contos Encantados' || category === 'Contos Clássicos';
  if (filter === 'fables') return category === 'Fábulas';
  if (filter === 'faith')
    return category === 'Histórias da Fé' || category === 'Fé';
  if (filter === 'fantasy')
    return category === 'Fantasia' || category === 'Mundos de Fantasia';
  return category === 'Nárnia';
}

export function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const books = useMemo(
    () =>
      discoverStoryBooks.filter((book) =>
        matchesFilter(book.category, activeFilter),
      ),
    [activeFilter],
  );

  return (
    <div className={styles.library}>
      <img
        className={styles.decoration}
        src="/assets/decorations/library-decoration.png"
        alt=""
        aria-hidden="true"
      />
      <div className={styles.content}>
        <HomeHeader logoBackdrop />
        <section
          className={styles.introduction}
          aria-labelledby="library-title"
        >
          <h1 id="library-title">Biblioteca</h1>
          <p>Todas as histórias do Jardim de Papel reunidas em um só lugar.</p>
        </section>
        <div
          className={styles.filters}
          role="tablist"
          aria-label="Filtrar histórias por coleção"
        >
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                className={`${styles.filter} ${isActive ? styles.filterActive : ''}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        {books.length > 0 ? (
          <div className={styles.grid}>
            {books.map((book, index) => (
              <StoryBookCard key={book.id} book={book} index={index} compact />
            ))}
          </div>
        ) : (
          <section className={styles.empty} aria-live="polite">
            <h2>Ainda não há histórias nesta coleção</h2>
            <p>Estamos preparando novas aventuras para este cantinho.</p>
          </section>
        )}
        <p className={styles.demoNote}>
          Pré-visualizações marcadas como “Em breve” são demonstrações e não
          fazem parte do catálogo publicado.
        </p>
      </div>
    </div>
  );
}
