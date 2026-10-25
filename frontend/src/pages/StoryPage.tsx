import { useParams } from 'react-router-dom';
import { getReading } from '../lib/api/services';
import { adaptStory } from '../lib/api/adapters';
import { migrateLegacyProgress } from '../lib/api/progress';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { ApiState } from '../lib/api/ApiState';
import { StoryOpening } from '../features/story-opening/StoryOpening';

export function StoryPage() {
  const { slug } = useParams();
  const result = useApi(signal => getReading(slug ?? '', signal), queryKeys.reading(slug ?? ''));
  if (!result.data) return <ApiState {...result} />;
  const story = adaptStory(result.data);
  migrateLegacyProgress(story);
  return <StoryOpening story={story} />;
}
