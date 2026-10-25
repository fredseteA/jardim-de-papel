import { PageLayout } from '../../pages/PageLayout';
export function ApiState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (loading) return <PageLayout title="Um instante"><p role="status">Preparando as histórias...</p></PageLayout>;
  if (error) return <PageLayout title="Não foi possível carregar"><p role="alert">{error}</p><button type="button" onClick={retry} className="mt-4 rounded-full bg-forest px-5 py-3 text-white">Tentar novamente</button></PageLayout>;
  return null;
}
