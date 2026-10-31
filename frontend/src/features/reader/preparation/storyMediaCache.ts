import type { Story, StoryIllustration, StoryAnimation } from '../../../types/story';

const CACHE_NAME = 'jardim-de-papel:reader-media:v1';
const CONCURRENCY = 3;
const FILE_TIMEOUT_MS = 120_000;
export type PreparationProgress = { loaded: number; total: number };
export type PreparedMedia = { urls: ReadonlyMap<string, string>; dispose: () => void };

/** Includes shared tracks, every scene, posters and opening media, deduplicated. */
export function collectStoryMedia(story: Story, additional: readonly string[] = []): string[] {
  const urls = new Set<string>();
  const add = (src?: string) => { if (src?.trim()) urls.add(src); };
  const animation = (value?: StoryAnimation) => { add(value?.src); add(value?.poster?.src); };
  add(story.coverImage?.desktop.src); add(story.coverImage?.mobile?.src);
  add(story.audio?.backgroundMusic?.src);
  animation(story.presentationMedia?.trailer);
  story.presentationMedia?.previewImages?.forEach(image => add(image.src));
  for (const chapter of story.chapters) for (const page of chapter.pages) {
    add(page.illustration?.src); animation(page.animation); add(page.narration?.src); add(page.music?.src);
  }
  additional.forEach(add);
  return [...urls];
}

/** Source data and stable narrative IDs are preserved; only runtime URLs change. */
export function withPreparedMedia(story: Story, urls: ReadonlyMap<string, string>): Story {
  const src = (value: string) => urls.get(value) ?? value;
  const image = (value?: StoryIllustration) => value ? { ...value, src: src(value.src) } : undefined;
  const animation = (value?: StoryAnimation) => value ? { ...value, src: src(value.src), poster: image(value.poster) } : undefined;
  return {
    ...story,
    coverImage: story.coverImage ? { desktop: image(story.coverImage.desktop)!, mobile: image(story.coverImage.mobile) } : undefined,
    audio: story.audio ? { ...story.audio, backgroundMusic: story.audio.backgroundMusic ? { ...story.audio.backgroundMusic, src: src(story.audio.backgroundMusic.src) } : undefined } : undefined,
    presentationMedia: story.presentationMedia ? { ...story.presentationMedia, trailer: animation(story.presentationMedia.trailer), previewImages: story.presentationMedia.previewImages?.map(value => image(value)!) } : undefined,
    chapters: story.chapters.map(chapter => ({ ...chapter, pages: chapter.pages.map(page => ({ ...page,
      illustration: image(page.illustration), animation: animation(page.animation),
      narration: page.narration ? { ...page.narration, src: src(page.narration.src) } : undefined,
      music: page.music ? { ...page.music, src: src(page.music.src) } : undefined,
    })) })),
  };
}

async function optionalCache(): Promise<Cache | undefined> {
  try { return typeof caches === 'undefined' ? undefined : await caches.open(CACHE_NAME); }
  catch { return undefined; } // Private browsing/quota restrictions: use session blobs.
}

async function download(url: string, parent: AbortSignal, cache?: Cache): Promise<Blob> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.throwIfAborted(); parent.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, FILE_TIMEOUT_MS);
  try {
    let response: Response | undefined;
    try { response = await cache?.match(url); } catch { /* Storage is optional. */ }
    controller.signal.throwIfAborted();
    const cached = !!response;
    response ??= await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
    if (!response.ok || response.type === 'opaque') throw new Error('Arquivo indisponível.');
    const blob = await response.blob();
    controller.signal.throwIfAborted();
    if (!blob.size || /^(text\/html|application\/json)/i.test(blob.type)) throw new Error('Arquivo de mídia inválido.');
    if (!cached && cache && /^https?:/i.test(url)) {
      try { await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } })); }
      catch { /* All bytes still remain available to this reading session. */ }
    }
    controller.signal.throwIfAborted();
    return blob;
  } finally { window.clearTimeout(timer); parent.removeEventListener('abort', abort); }
}

/** Complete files, not just HTTP headers or media metadata. No playback occurs. */
export async function prepareStoryMedia(sources: readonly string[], signal: AbortSignal, onProgress: (progress: PreparationProgress) => void): Promise<PreparedMedia> {
  const unique = [...new Set(sources)];
  const urls = new Map<string, string>();
  const dispose = () => { urls.forEach(value => URL.revokeObjectURL(value)); urls.clear(); };
  const cache = await optionalCache();
  let cursor = 0, loaded = 0, failures = 0;
  onProgress({ loaded, total: unique.length });
  async function worker() {
    while (cursor < unique.length && !signal.aborted) {
      const original = unique[cursor++];
      try {
        const absolute = new URL(original, window.location.origin).href;
        if (!/^(https?:|data:|blob:)/i.test(absolute)) throw new Error('Endereço inválido.');
        const blob = await download(absolute, signal, cache);
        signal.throwIfAborted();
        urls.set(original, URL.createObjectURL(blob));
        onProgress({ loaded: ++loaded, total: unique.length });
      } catch { if (!signal.aborted) failures++; }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
    signal.throwIfAborted();
    if (failures) throw new Error(`${failures === 1 ? 'Um arquivo não chegou' : `${failures} arquivos não chegaram`} por aqui. Confira a conexão e tente novamente. Os arquivos já preparados serão reaproveitados quando possível.`);
    return { urls, dispose };
  } catch (reason) { dispose(); throw reason; }
}
