import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getReading } from '../lib/api/services';
import { adaptStory, resolveMedia } from '../lib/api/adapters';
import { migrateLegacyProgress } from '../lib/api/progress';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { StoryReader } from '../features/reader/StoryReader';
import { ReaderEntry } from '../features/reader/ReaderEntry';
import { StoryPreparation } from '../features/reader/preparation/StoryPreparation';
import { AdventureLoading } from '../features/reader/preparation/AdventureLoading';

export function ReaderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const result = useApi(signal => getReading(slug ?? '', signal), queryKeys.reading(slug ?? ''));
  const story = useMemo(() => result.data ? adaptStory(result.data) : null, [result.data]);
  // Include all scene_media records, even roles not yet rendered by the reader.
  const sources = useMemo(() => result.data ? [resolveMedia(result.data.cover_asset), resolveMedia(result.data.hero_asset), ...(result.data.chapters?.flatMap(chapter => chapter.scenes.flatMap(scene => scene.media.map(media => resolveMedia(media.asset)))) ?? [])].filter(Boolean) : [], [result.data]);
  const state = location.state as { returnTo?: unknown; suggestOrientation?: unknown } | null;
  const returnTo = typeof state?.returnTo === 'string' && state.returnTo.startsWith('/') && !state.returnTo.startsWith('//') ? state.returnTo : '/biblioteca';
  const back = () => navigate(`/historias/${slug ?? ''}`, { replace: true, state: { returnTo } });
  if (!story) return <AdventureLoading error={result.error} onRetry={result.retry} onBack={back} />;
  migrateLegacyProgress(story);
  return <StoryPreparation key={story.id} story={story} additionalSources={sources} onBack={back}>{prepared => <ReaderEntry suggestOrientation={state?.suggestOrientation === true}><StoryReader story={prepared} /></ReaderEntry>}</StoryPreparation>;
}
