import { Link, useParams } from 'react-router-dom';
import { stories } from '../data/stories';
import { StoryReader } from '../features/reader/StoryReader';
import { PageLayout } from './PageLayout';

export function ReaderPage() {
  const { slug } = useParams();
  const story = stories.find((item) => item.slug === slug && item.status === 'published');
  if (!story) return <PageLayout title="História indisponível"><p>Não encontramos esta história para leitura.</p><Link to="/biblioteca">Voltar à biblioteca</Link></PageLayout>;
  return <StoryReader key={story.id} story={story} />;
}
