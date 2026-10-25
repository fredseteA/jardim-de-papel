import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoryBookCard } from '../../components/stories/StoryBookCard';
import type { StoryBookCardData } from '../../components/stories/StoryBookCard';
import styles from './DiscoverStoriesSection.module.css';

export function DiscoverStoriesSection({ books }: { books: readonly StoryBookCardData[] }) {
  return <section className={styles.section} aria-labelledby="discover-stories-title"><div className={styles.heading}><h2 id="discover-stories-title">Descubra novas histórias</h2><Link className={styles.allStories} to="/biblioteca">Ver todas <ArrowRight size={15} aria-hidden="true" /></Link></div><div className={styles.grid}>{books.map((book, index) => <StoryBookCard key={book.id} book={book} index={index} />)}</div></section>;
}
