import { FeaturedCarousel } from '../features/discovery/FeaturedCarousel';
import { CollectionsSection } from '../features/discovery/CollectionsSection';
import { DiscoverStoriesSection } from '../features/discovery/DiscoverStoriesSection';
import { HomeHeader } from '../features/discovery/HomeHeader';
import styles from '../features/discovery/HomeHero.module.css';

export function HomePage() {
  return (
    <div className={styles.home}>
      <img className={styles.decoration} src="/assets/decorations/home-decoration.png" alt="" aria-hidden="true" />
      <div className={styles.content}>
        <HomeHeader />
        <section className={styles.introduction}>
          <h1>Um mundo de histórias espera por você.</h1>
          <p>Descubra contos que encantam, inspiram e ficam para sempre.</p>
        </section>
        <FeaturedCarousel />
        <CollectionsSection />
        <DiscoverStoriesSection />
      </div>
    </div>
  );
}
