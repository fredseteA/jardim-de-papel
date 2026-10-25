import { Link } from 'react-router-dom';
import { PageLayout } from './PageLayout';
export function NotFoundPage() { return <PageLayout title="Página não encontrada"><Link className="font-semibold text-forest underline" to="/">Voltar ao início</Link></PageLayout>; }
