import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Story } from '../../../types/story';
import { AdventureLoading } from './AdventureLoading';
import { collectStoryMedia, prepareStoryMedia, withPreparedMedia, type PreparationProgress, type PreparedMedia } from './storyMediaCache';

const EMPTY: readonly string[] = [];
export function StoryPreparation({ story, additionalSources = EMPTY, onBack, children }: { story: Story; additionalSources?: readonly string[]; onBack: () => void; children: (prepared: Story) => ReactNode }) {
  const manifest = JSON.stringify(collectStoryMedia(story, additionalSources));
  const [attempt, setAttempt] = useState(0);
  const key = `${story.id}:${attempt}:${manifest}`;
  const [state, setState] = useState<{ key: string; media?: PreparedMedia; progress?: PreparationProgress; error?: string }>({ key });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let media: PreparedMedia | undefined;
    setState({ key });
    void prepareStoryMedia(JSON.parse(manifest) as string[], controller.signal, progress => { if (active) setState({ key, progress }); })
      .then(result => { media = result; if (active) setState({ key, media: result }); else result.dispose(); })
      .catch(reason => { if (active) setState({ key, error: reason instanceof Error ? reason.message : 'Não foi possível preparar a história. Tente novamente.' }); });
    return () => { active = false; controller.abort(); media?.dispose(); };
  }, [key, manifest]);
  const prepared = useMemo(() => state.key === key && state.media ? withPreparedMedia(story, state.media.urls) : null, [story, state, key]);
  if (prepared) return children(prepared);
  return <AdventureLoading title={story.title} progress={state.key === key ? state.progress : undefined} error={state.key === key ? state.error : undefined} onRetry={() => setAttempt(value => value + 1)} onBack={onBack} />;
}
