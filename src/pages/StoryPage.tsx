import { Link, useParams } from 'react-router-dom';
import { stories } from '../data/stories';
import { StoryOpening } from '../features/story-opening/StoryOpening';
import { PageLayout } from './PageLayout';

export function StoryPage() {
  const { slug } = useParams();
  const story = stories.find((item) => item.slug === slug);

  if (!story || story.status !== 'published') {
    return <PageLayout title="História indisponível"><p>Esta história ainda não está disponível.</p><Link className="mt-5 inline-block text-forest underline" to="/biblioteca">Voltar à biblioteca</Link></PageLayout>;
  }
  return <StoryOpening story={story} />;
}
