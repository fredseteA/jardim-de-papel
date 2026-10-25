import { ArrowLeft, Clock3, FilterX, Search, X, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStories } from '../../lib/api/services';
import { adaptBook } from '../../lib/api/adapters';
import { queryKeys } from '../../lib/api/queryClient';
import { useApi } from '../../lib/api/useApi';
import { categoryIdByTag } from './categories';
import { useSearch } from './SearchContext';
import type { DurationFilterId, SearchCategoryId, SearchStory } from './types';
import styles from './SearchPanel.module.css';

const categories: ReadonlyArray<{ id: SearchCategoryId; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'contos-classicos', label: 'Contos Clássicos' },
  { id: 'fabulas', label: 'Fábulas' },
  { id: 'fe', label: 'Fé' },
  { id: 'fantasia', label: 'Fantasia' },
  { id: 'narnia', label: 'Nárnia' },
];
const durations: ReadonlyArray<{ id: DurationFilterId; label: string }> = [
  { id: 'any', label: 'Qualquer duração' },
  { id: 'up-to-5', label: 'Até 5 min' },
  { id: '6-to-10', label: '6–10 min' },
  { id: '11-to-20', label: '11–20 min' },
  { id: 'over-20', label: 'Mais de 20 min' },
];

function RadioChips<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <section className={styles.chipGroup}>
      <h2>{label}</h2>
      <div className={styles.chips} role="radiogroup" aria-label={label}>
        {items.map((item) => (
          <button
            key={item.id}
            className={`${styles.chip} ${item.id === value ? styles.chipActive : ''}`}
            type="button"
            role="radio"
            aria-checked={item.id === value}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SearchPanel() {
  const {
    isOpen,
    closeSearch,
    query,
    setQuery,
    categoryId,
    setCategoryId,
    durationId,
    setDurationId,
    clearFilters,
  } = useSearch();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [notice, setNotice] = useState('');
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isLeaving, setIsLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsLeaving(false);
      return;
    }
    if (!isMounted) return;
    setIsLeaving(true);
    const timer = window.setTimeout(() => setIsMounted(false), 180);
    return () => window.clearTimeout(timer);
  }, [isOpen, isMounted]);
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [debouncedQuery, categoryId, durationId]);
  const params = new URLSearchParams({ limit: '20', offset: String(offset) });
  if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
  const slugs: Record<string, string> = { 'contos-classicos': 'contos-classicos', fabulas: 'fabulas', fe: 'historias-da-fe', fantasia: 'mundos-de-fantasia', narnia: 'narnia' };
  if (categoryId !== 'todos') params.set('collection', slugs[categoryId]);
  const ranges: Record<string, [number | null, number | null]> = { 'up-to-5': [null, 5], '6-to-10': [6, 10], '11-to-20': [11, 20], 'over-20': [21, null] };
  const range = ranges[durationId];
  if (range?.[0] != null) params.set('min_minutes', String(range[0]));
  if (range?.[1] != null) params.set('max_minutes', String(range[1]));
  const request = useApi(signal => getStories(params, signal), queryKeys.stories(params), isOpen);
  const results: SearchStory[] = (request.data?.items ?? []).map(item => { const book = adaptBook(item); return { id: book.id, title: book.title, coverUrl: book.cover, categoryLabel: book.category, categoryId: categoryIdByTag[book.category] ?? 'fantasia', durationMin: book.estimatedMinutes, status: 'disponivel' as const, href: book.href }; });
  const hasFilters =
    Boolean(query) || categoryId !== 'todos' || durationId !== 'any';
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearch();
      if (event.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, a[href]',
          ),
        );
        const first = focusables[0];
        const last = focusables.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closeSearch]);
  if (!isMounted) return null;
  const selectResult = (href: string | undefined, isComingSoon: boolean) => {
    if (isComingSoon || !href) {
      setNotice('Em breve! Esta história ainda está sendo preparada.');
      return;
    }
    closeSearch();
    navigate(href);
  };
  return createPortal(
    <div className={`${styles.backdrop} ${isLeaving ? styles.backdropLeaving : ''}`} onMouseDown={closeSearch}>
      <div
        className={`${styles.panel} ${isLeaving ? styles.panelLeaving : ''}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar histórias"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className={styles.backButton} type="button" aria-label="Voltar e fechar busca" onClick={closeSearch}>
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar
        </button>
        <img
          className={styles.owl}
          src="/assets/search/owl-icon.png"
          alt=""
          aria-hidden="true"
        />
        <div className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <label className={styles.srOnly} htmlFor="story-search">
            Buscar histórias
          </label>
          <input
            ref={inputRef}
            id="story-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar histórias"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpar texto"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <RadioChips
          label="Categoria"
          items={categories}
          value={categoryId}
          onChange={setCategoryId}
        />
        <RadioChips
          label="Tempo de leitura"
          items={durations}
          value={durationId}
          onChange={setDurationId}
        />
        <div className={styles.resultsHeader}>
          <h2>Resultados</h2>
          <button type="button" disabled={!hasFilters} onClick={clearFilters}>
            Limpar filtros <FilterX size={14} aria-hidden="true" />
          </button>
        </div>
        <p className={styles.live} aria-live="polite">
          {results.length}{' '}
          {results.length === 1
            ? 'história encontrada'
            : 'histórias encontradas'}
        </p>
        <div className={styles.results}>
          {request.error && request.data && <p role="status">N�o foi poss�vel atualizar os resultados.</p>}
          {request.loading ? <p role="status">Buscando histórias...</p> : request.error && !request.data ? <div role="alert"><p>{request.error}</p><button type="button" onClick={request.retry}>Tentar novamente</button></div> : results.length ? (
            results.map((story) => (
              <button
                className={styles.result}
                key={story.id}
                type="button"
                onClick={() =>
                  selectResult(story.href, story.status === 'em-breve')
                }
              >
                <img src={story.coverUrl} alt="" />
                <span className={styles.resultInfo}>
                  <strong>{story.title}</strong>
                  <span>
                    <em>{story.categoryLabel}</em>
                    {story.status === 'em-breve' && (
                      <em className={styles.soon}>Em breve</em>
                    )}
                  </span>
                </span>
                <span className={styles.resultMeta}>
                  {story.durationMin ? (
                    <>
                      <Clock3 size={14} aria-hidden="true" />
                      {story.durationMin} min
                    </>
                  ) : null}
                  <ChevronRight size={17} aria-hidden="true" />
                </span>
              </button>
            ))
          ) : (
            <div className={styles.empty}>
              <img
                src="/assets/search/owl-icon.png"
                alt=""
                aria-hidden="true"
              />
              <p>Não encontramos histórias com esses filtros</p>
              <button type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            </div>
          )}
        </div>
        {offset > 0 && <button type="button" onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</button>}
        {results.length === 20 && <button type="button" onClick={() => setOffset(offset + 20)}>Mais resultados</button>}
        {notice && (
          <p className={styles.toast} role="status">
            {notice}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
