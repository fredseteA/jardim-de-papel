import { Link } from 'react-router-dom';
import {
  type CollectionPresentation,
} from '../data/collectionPresentation';
import { getCollections } from '../lib/api/services';
import { adaptCollection } from '../lib/api/adapters';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { ApiState } from '../lib/api/ApiState';
import { HomeHeader } from '../features/discovery/HomeHeader';
import styles from './CollectionsPage.module.css';

const cardCopy: Record<string, { title?: string; description: string }> = {
  'contos-classicos': {
    description: 'Grandes histórias que atravessam gerações.',
  },
  fabulas: { description: 'Pequenas histórias com grandes ensinamentos.' },
  'historias-da-fe': {
    title: 'Fé',
    description: 'Histórias que iluminam o coração.',
  },
  narnia: { description: 'As crônicas de um mundo extraordinário.' },
  'mundos-de-fantasia': {
    title: 'Fantasia',
    description: 'Mundos mágicos para imaginar sem limites.',
  },
};

function CollectionBrowseCard({
  collection,
}: {
  collection: CollectionPresentation;
}) {
  const copy = cardCopy[collection.slug] ?? {
    description: collection.description,
  };
  return (
    <Link className={styles.card} to={`/colecoes/${collection.slug}`}>
      <img className={styles.cardImage} src={collection.image} alt="" />
      <div className={styles.cardInfo}>
        <h2>{copy.title ?? collection.title}</h2>
        <p>{copy.description}</p>
      </div>
    </Link>
  );
}

export function CollectionsPage() {
  const result = useApi(getCollections, queryKeys.collections);
  if (!result.data) return <ApiState {...result} />;
  const collections = result.data.items.map(adaptCollection);
  return (
    <div className={styles.page}>
      <img
        className={styles.decoration}
        src="/assets/decorations/collections-decoration.png"
        alt=""
        aria-hidden="true"
      />
      <div className={styles.content}>
        <HomeHeader logoBackdrop />
        <section
          className={styles.introduction}
          aria-labelledby="collections-title"
        >
          <h1 id="collections-title">Coleções</h1>
          <p>
            Explore os universos que fazem parte do Jardim de Papel e encontre
            suas histórias favoritas.
          </p>
        </section>
        {result.error && <p role="status">N�o foi poss�vel atualizar as cole��es.</p>}
        <section className={styles.grid} aria-label="Coleções disponíveis">
          {collections.map((collection) => (
            <CollectionBrowseCard key={collection.id} collection={collection} />
          ))}
        </section>
      </div>
    </div>
  );
}
