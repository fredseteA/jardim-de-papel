import { FeaturedCarousel } from '../features/discovery/FeaturedCarousel';
import { CollectionsSection } from '../features/discovery/CollectionsSection';
import { DiscoverStoriesSection } from '../features/discovery/DiscoverStoriesSection';
import { HomeHeader } from '../features/discovery/HomeHeader';
import { getCollections, getStories } from '../lib/api/services';
import { adaptBook, adaptCollection, adaptStory } from '../lib/api/adapters';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { ApiState } from '../lib/api/ApiState';
import styles from '../features/discovery/HomeHero.module.css';

export function HomePage() {
  const params = new URLSearchParams({ limit: '18', offset: '0' });
  const storiesResult = useApi(signal => getStories(params, signal), queryKeys.stories(params));
  const collectionsResult = useApi(getCollections, queryKeys.collections);
  if (!storiesResult.data) return <ApiState {...storiesResult} />;
  const stories = storiesResult.data;
  const collections = collectionsResult.data;
  return (
    <div className={styles.home}>
      <img className={styles.decoration} src="/assets/decorations/home-decoration.png" alt="" aria-hidden="true" />
      <div className={styles.content}>
        <HomeHeader />
        <section className={styles.introduction}>
          <h1>Um mundo de histÃ³rias espera por vocÃª.</h1>
          <p>Descubra contos que encantam, inspiram e ficam para sempre.</p>
        </section>
        {stories.items[0] && <FeaturedCarousel story={adaptStory(stories.items[0])} />}
        <CollectionsSection collections={collections?.items.map(adaptCollection) ?? []} />
        <DiscoverStoriesSection books={stories.items.map(adaptBook)} />
        {collectionsResult.error && <p role="status">Não foi possível atualizar as coleções. <button type="button" onClick={collectionsResult.retry}>Tentar novamente</button></p>}
        {storiesResult.error && <p role="status">Não foi possível atualizar as histórias.</p>}
      </div>
    </div>
  );
}
