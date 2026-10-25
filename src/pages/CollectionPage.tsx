import { ArrowLeft, BookOpen } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StoryBookCard } from '../components/stories/StoryBookCard';
import { collectionPresentations } from '../data/collectionPresentation';
import { discoverStoryBooks } from '../data/discoverStoriesPresentation';
import { PageLayout } from './PageLayout';
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
  const collection = collectionPresentations.find((item) => item.slug === slug);
  const detail = slug ? collectionDetails[slug as keyof typeof collectionDetails] : undefined;
  if (!detail)
    return (
      <PageLayout title={collection?.title ?? 'Coleção'}>
        <p className="text-ink/75">
          {collection?.description ?? 'Coleção não encontrada.'}
        </p>
      </PageLayout>
    );
  const books = discoverStoryBooks.filter((book) => detail.categories.includes(book.category as never));
  return (
    <div className={styles.page}>
      <img
        className={styles.decoration}
        src={`/assets/decorations/collections/${detail.decoration}`}
        alt=""
        aria-hidden="true"
      />
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
          <h1 id="collection-title">{detail.title}</h1>
          <p>{detail.description}</p>
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
