import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoryBookCard } from '../../components/stories/StoryBookCard';
import { discoverStoryBooks } from '../../data/discoverStoriesPresentation';
import styles from './DiscoverStoriesSection.module.css';

export function DiscoverStoriesSection() {
  return <section className={styles.section} aria-labelledby="discover-stories-title"><div className={styles.heading}><h2 id="discover-stories-title">Descubra novas histórias</h2><Link className={styles.allStories} to="/biblioteca">Ver todas <ArrowRight size={15} aria-hidden="true" /></Link></div><div className={styles.grid}>{discoverStoryBooks.map((book, index) => <StoryBookCard key={book.id} book={book} index={index} />)}</div></section>;
}
