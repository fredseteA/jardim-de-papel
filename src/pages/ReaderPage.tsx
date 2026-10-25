import { useParams } from 'react-router-dom';
import { demoStories } from '../data/demoCatalog';
import { PageLayout } from './PageLayout';
export function ReaderPage() { const { slug } = useParams(); const story = demoStories.find((item) => item.slug === slug); return <PageLayout title={story ? `Lendo: ${story.title}` : 'Leitor'}><p className="max-w-prose leading-8 text-ink/75">O leitor completo será desenvolvido nas próximas etapas. A estrutura editorial já comporta leitura imersiva e tradicional usando os mesmos dados.</p></PageLayout>; }
