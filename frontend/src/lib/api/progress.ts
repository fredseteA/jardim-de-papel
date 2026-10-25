import type { AdaptedStory } from './adapters';
/** Preserve the old record; copy only if every legacy ID maps to this story. */
export function migrateLegacyProgress(story: AdaptedStory) {
  const map = story.legacyMapping;
  if (!map?.storyId || !story.chapters.length) return;
  try {
    const prefix = 'jardim-de-papel:reader-progress:';
    const destination = prefix + encodeURIComponent(story.id);
    const favoritesKey = 'jardim-de-papel:favorites';
    const favorites: unknown = JSON.parse(localStorage.getItem(favoritesKey) ?? '[]');
    if (Array.isArray(favorites) && favorites.includes(map.storyId) && !favorites.includes(story.id)) localStorage.setItem(favoritesKey, JSON.stringify([...favorites, story.id]));
    if (localStorage.getItem(destination)) return;
    const raw = localStorage.getItem(prefix + encodeURIComponent(map.storyId));
    if (!raw) return;
    const old: unknown = JSON.parse(raw);
    if (!old || typeof old !== 'object') return;
    const p = old as Record<string, unknown>;
    if (p.version !== 1 || p.storyId !== map.storyId || typeof p.chapterId !== 'string' || typeof p.pageId !== 'string' || !['immersive','traditional'].includes(String(p.mode)) || typeof p.completed !== 'boolean' || typeof p.lastReadAt !== 'string' || !Number.isFinite(Date.parse(p.lastReadAt))) return;
    const chapter = map.chapters[p.chapterId]; const page = map.pages[p.pageId];
    const pages = story.chapters.flatMap(c => c.pages.map(item => ({ chapter: c.id, page: item.id })));
    const index = pages.findIndex(item => item.chapter === chapter && item.page === page);
    if (index < 0 || (p.completed && index !== pages.length - 1)) return;
    localStorage.setItem(destination, JSON.stringify({ ...p, storyId: story.id, chapterId: chapter, pageId: page, percentage: Math.round((index + 1) / pages.length * 100) }));
  } catch { /* Keep the original record if storage is unavailable or invalid. */ }
}
