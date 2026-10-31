import { Clock3 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getReading } from '../../lib/api/services';
import { queryKeys } from '../../lib/api/queryClient';
import { Link, useLocation } from 'react-router-dom';
import type { CSSProperties } from 'react';
import styles from './StoryBookCard.module.css';

export type StoryBookCardData = {
  id: string;
  title: string;
  category: string;
  cover: string;
  coverPosition?: string;
  href?: string;
  estimatedMinutes?: number;
  isComingSoon?: boolean;
};

type StoryBookCardProps = { book: StoryBookCardData; index?: number; compact?: boolean };

export function StoryBookCard({ book, index = 0, compact = false }: StoryBookCardProps) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const prefetch = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')) return;
    const slug = book.href?.match(/^\/historias\/([^/]+)$/)?.[1];
    if (!slug || book.isComingSoon) return;
    void queryClient.prefetchQuery({ queryKey: queryKeys.reading(slug), queryFn: ({ signal }) => getReading(slug, signal) });
  };
  const className = `${styles.book} ${compact ? styles.compact : ''}`;
  const content = <><div className={styles.spine} aria-hidden="true" /><div className={styles.coverWrap}><img className={styles.cover} src={book.cover} alt="" style={{ objectPosition: book.coverPosition }} />{book.isComingSoon && <span className={styles.comingSoon}>Em breve</span>}</div><div className={styles.bookInfo}><h3>{book.title}</h3><div className={styles.bookMeta}><span className={styles.category}>{book.category}</span>{book.estimatedMinutes && <span className={styles.duration}><Clock3 size={compact ? 9 : 12} aria-hidden="true" />{book.estimatedMinutes} min</span>}</div></div></>;
  const animationStyle = { animationDelay: `${index * 70}ms` } as CSSProperties;
  return book.href ? <Link className={className} style={animationStyle} to={book.href} state={{ returnTo: `${location.pathname}${location.search}` }} onMouseEnter={prefetch} onFocus={prefetch}>{content}</Link> : <article className={`${className} ${styles.unavailable}`} style={animationStyle} aria-label={`${book.title}, em breve`}>{content}</article>;
}
