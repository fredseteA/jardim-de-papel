import { useState } from 'react';
import { StoryBookCard } from '../components/stories/StoryBookCard';
import { getStories } from '../lib/api/services';
import { adaptBook } from '../lib/api/adapters';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { ApiState } from '../lib/api/ApiState';
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

const slugByFilter: Record<Exclude<FilterId, 'all'>, string> = { classics: 'contos-classicos', fables: 'fabulas', faith: 'historias-da-fe', fantasy: 'mundos-de-fantasia', narnia: 'narnia' };
export function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limit: '18', offset: String(offset) });
  if (activeFilter !== 'all') params.set('collection', slugByFilter[activeFilter]);
  const result = useApi(signal => getStories(params, signal), queryKeys.stories(params));
  if (!result.data) return <ApiState {...result} />;
  const books = result.data.items.map(adaptBook);
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
                onClick={() => { setOffset(0); setActiveFilter(filter.id); }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        {result.error && <p role="status">N�o foi poss�vel atualizar as hist�rias.</p>}
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
        <div className="flex justify-center gap-4 py-4">
          {offset > 0 && <button type="button" onClick={() => setOffset(Math.max(0, offset - 18))}>Anterior</button>}
          {books.length === 18 && <button type="button" onClick={() => setOffset(offset + 18)}>Mais histórias</button>}
        </div>
      </div>
    </div>
  );
}
