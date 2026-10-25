import { ArrowLeft, BookOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StoryBookCard } from '../components/stories/StoryBookCard';
import { getCollection, getStories } from '../lib/api/services';
import { adaptBook, adaptCollection } from '../lib/api/adapters';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { ApiState } from '../lib/api/ApiState';
import styles from './CollectionPage.module.css';

const collectionDetails = {
  'contos-classicos': { title: 'Contos Clássicos', description: 'Grandes histórias que atravessam gerações, cheias de aventuras, ensinamentos e personagens inesquecíveis.', decoration: 'contos-classicos.png', categories: ['Contos Encantados', 'Contos Clássicos'] },
  fabulas: { title: 'Fábulas', description: 'Pequenas histórias com grandes ensinamentos e animais que encantam.', decoration: 'fabulas.png', categories: ['Fábulas'] },
  'historias-da-fe': { title: 'Fé', description: 'Histórias que iluminam o coração com amor, esperança e bons valores.', decoration: 'fe.png', categories: ['Histórias da Fé', 'Fé'] },
  narnia: { title: 'Nárnia', description: 'As crônicas de um mundo extraordinário, cheio de coragem e magia.', decoration: 'narnia.png', categories: ['Nárnia'] },
  'mundos-de-fantasia': { title: 'Mundos de Fantasia', description: 'Novos lugares, personagens e aventuras incríveis para imaginar.', decoration: 'mundos-fantasia.png', categories: ['Mundos de Fantasia', 'Fantasia'] },
} as const;

export function CollectionPage() {
  const { slug } = useParams();
  const params = new URLSearchParams({ collection: slug ?? '', limit: '100' });
  const result = useApi(signal => getCollection(slug ?? '', signal), queryKeys.collection(slug ?? ''));
  const stories = useApi(signal => getStories(params, signal), queryKeys.stories(params));
  if (!result.data) return <ApiState {...result} />;
  if (!stories.data) return <ApiState {...stories} />;
  const collection = adaptCollection(result.data);
  const detail = slug ? collectionDetails[slug as keyof typeof collectionDetails] : undefined;
  const books = stories.data.items.map(adaptBook);
  return (
    <div className={styles.page}>
      {detail && <img
        className={styles.decoration}
        src={`/assets/decorations/collections/${detail?.decoration ?? ''}`}
        alt=""
        aria-hidden="true"
      />}
      <div className={styles.content}>
        <div className={styles.topbar}>
          <Link className={styles.back} to="/colecoes">
            <ArrowLeft size={18} aria-hidden="true" />
            Coleções
          </Link>
          <img
            className={styles.logo}
            src="/assets/branding/logo-primary.png"
            alt="Jardim de Papel"
          />
        </div>
        <section className={styles.hero} aria-labelledby="collection-title">
          <h1 id="collection-title">{collection.title}</h1>
          <p>{collection.description}</p>
          <div className={styles.count}>
            <BookOpen size={20} aria-hidden="true" />
            {books.length} {books.length === 1 ? 'história' : 'histórias'}
          </div>
        </section>
        <section
          className={styles.stories}
          aria-labelledby="collection-stories-title"
        >
          <h2 id="collection-stories-title">Histórias desta coleção</h2>
          {books.length ? <div className={styles.grid}>{books.map((book, index) => <StoryBookCard key={book.id} book={book} index={index} compact />)}</div> : <div className={styles.empty}><p>Novas histórias desta coleção chegarão em breve.</p></div>}
        </section>
      </div>
    </div>
  );
}
