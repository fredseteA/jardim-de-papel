import type { Story, StoryAnimation, StoryIllustration, StoryMusic, StoryNarration, StoryPagePresentation } from '../../types/story';
import type { StoryBookCardData } from '../../components/stories/StoryBookCard';
import type { CollectionPresentation } from '../../data/collectionPresentation';
import type { CollectionDTO, MediaDTO, SceneDTO, StoryDTO } from './types';
import { primarySceneImage } from '../sceneComposition';

export function resolveMedia(asset: MediaDTO | null | undefined): string {
  if (!asset) return '';
  if (asset.resolved_url) return asset.resolved_url.startsWith('/api/') ? `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')}${asset.resolved_url}` : asset.resolved_url;
  const src = asset.storage_path;
  if (/^https?:\/\//i.test(src)) return src;
  if (asset.storage_provider !== 'frontend' || src.includes('..') || src.includes('\\')) return '';
  return `/${src.replace(/^\/+/, '')}`;
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const legacy = (dto: StoryDTO) => record(dto.cover_asset?.asset_metadata.jdp_import_v1);
const illustration = (asset: MediaDTO | null, config: Record<string, unknown> = {}): StoryIllustration | undefined => {
  const src = resolveMedia(asset); if (!src) return undefined;
  const i: StoryIllustration = { src, alt: string(config.alt) };
  if (config.demonstrative === true) i.demonstrative = true;
  if (['top-left','top-right','bottom-left','bottom-right'].includes(string(config.spritePosition))) i.spritePosition = config.spritePosition as StoryIllustration['spritePosition'];
  return i;
};
export function adaptCollection(c: CollectionDTO): CollectionPresentation { return { id: c.id, slug: c.slug, title: c.title, description: c.description, image: resolveMedia(c.cover_asset) }; }
export function adaptBook(s: StoryDTO): StoryBookCardData { const meta = legacy(s); return { id: s.id, title: s.title, category: s.collections?.[0]?.title ?? string(meta.collectionDescription), cover: resolveMedia(s.cover_asset), href: `/historias/${s.slug}`, estimatedMinutes: s.estimated_reading_minutes ?? undefined }; }
export type AdaptedStory = Story & { legacyMapping?: { storyId: string; chapters: Record<string, string>; pages: Record<string, string> } };
export function sceneToReaderPage(scene: SceneDTO) {
    const assets = [...(scene.media ?? [])].sort((a, b) => a.display_order - b.display_order); const find = (role: string) => assets.find(m => m.role === role);
    const visual = primarySceneImage(assets); const anim = find('animation'); const nar = find('narration'); const music = find('ambient_music');
    const config = { ...scene.presentation_config }; delete config.jdp_import_v1;
    if (scene.text_position) config.textPosition = scene.text_position === 'bottom' ? 'bottom-left' : scene.text_position === 'top' ? 'top-left' : scene.text_position;
    if (scene.text_animation) config.textEffect = scene.text_animation;
    const poster = record(anim?.configuration.poster);
    const animation: StoryAnimation | undefined = anim && resolveMedia(anim.asset) ? { src: resolveMedia(anim.asset), poster: string(poster.src).startsWith('/assets/') ? { src: string(poster.src), alt: string(poster.alt) } : undefined, loop: anim.configuration.loop === true, muted: true, playbackBehavior: anim.configuration.playbackBehavior as StoryAnimation['playbackBehavior'] } : undefined;
    const narration: StoryNarration | undefined = nar ? { src: resolveMedia(nar.asset), duration: typeof nar.configuration.duration === 'number' ? nar.configuration.duration : undefined } : undefined;
    const track: StoryMusic | undefined = music ? { src: resolveMedia(music.asset), loop: music.configuration.loop === true } : undefined;
  return { id: scene.id, order: scene.display_order, text: scene.narrative_text, illustration: visual ? illustration(visual.asset, visual.configuration) : undefined, animation, narration, music: track, readingSeconds: scene.estimated_duration_seconds ?? undefined, presentation: config as StoryPagePresentation };
  }

export function adaptStory(dto: StoryDTO): AdaptedStory {
  const meta = legacy(dto); const legacyCover = record(meta.coverImage); const desktop = record(legacyCover.desktop); const mobile = record(legacyCover.mobile);
  const baseCover = illustration(dto.cover_asset, desktop);
  const preview = record(meta.presentationMedia).previewImages;
  const previews: StoryIllustration[] = Array.isArray(preview) ? preview.map(record).map(item => ({ src: string(item.src), alt: string(item.alt), demonstrative: item.demonstrative === true, spritePosition: item.spritePosition as StoryIllustration['spritePosition'] })).filter(item => item.src.startsWith('/assets/')) : [];
  const mapping: NonNullable<AdaptedStory['legacyMapping']> = { storyId: string(meta.id), chapters: {}, pages: {} };
  function adaptScene(scene: SceneDTO) {
    const old = record(scene.presentation_config.jdp_import_v1); const pageId = string(old.legacyPageId); if (pageId) mapping.pages[pageId] = scene.id;
    return sceneToReaderPage(scene);}
  const chapters = [...(dto.chapters ?? [])].sort((a,b) => a.display_order-b.display_order).map(ch => {
    const ordered = [...ch.scenes].sort((a,b) => a.display_order-b.display_order); const old = record(ordered[0]?.presentation_config.jdp_import_v1); const id = string(old.legacyChapterId); if (id) mapping.chapters[id] = ch.id;
    return { id: ch.id, slug: string(old.legacyChapterSlug, ch.id), title: ch.title, order: ch.display_order, pages: ordered.map(adaptScene) };
  });
  const musicMeta = record(record(meta.audio).backgroundMusic);
  const musicSrc = string(musicMeta.src);
  const audio = musicSrc.startsWith('/assets/') ? { backgroundMusic: { src: musicSrc, loop: musicMeta.loop === true } } : undefined;
  return { audio, id: dto.id, slug: dto.slug, title: dto.title, description: dto.description, synopsis: dto.synopsis, collectionId: dto.collections?.[0]?.id ?? '', collectionDescription: dto.collections?.[0]?.title ?? string(meta.collectionDescription), ageRange: dto.minimum_age != null && dto.maximum_age != null ? `${dto.minimum_age}–${dto.maximum_age} anos` : string(meta.ageRange), language: dto.language, status: 'published', featured: meta.featured === true, coverImage: baseCover ? { desktop: baseCover, mobile: Object.keys(mobile).length ? illustration(dto.cover_asset, mobile) : undefined } : undefined, presentationMedia: { previewImages: previews }, chapters, legacyMapping: mapping };
}

