import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet, ApiError } from './client';
import { adaptStory, resolveMedia } from './adapters';
import { migrateLegacyProgress } from './progress';
import type { StoryDTO } from './types';

const dto: StoryDTO = { id: 'uuid-story', slug: 'a', title: 'Uma história', description: 'Descrição', synopsis: 'Sinopse', minimum_age: 4, maximum_age: 8, estimated_reading_minutes: 5, language: 'pt-BR', collections: [{ id: 'collection', slug: 'contos', title: 'Contos', description: '', display_order: 0, cover_asset: null }], cover_asset: { id: 'cover', storage_provider: 'frontend', storage_bucket: 'public', storage_path: 'assets/capa.webp', media_type: 'image', mime_type: 'image/webp', asset_metadata: { jdp_import_v1: { id: 'legacy-story', coverImage: { desktop: { alt: 'Capa' } }, presentationMedia: { previewImages: [{ src: '/assets/previa.png', alt: 'Prévia', spritePosition: 'top-left' }] } } } }, hero_asset: null, chapters: [{ id: 'uuid-chapter', title: 'Um', display_order: 1, scenes: [{ id: 'uuid-scene', display_order: 1, narrative_text: 'Texto', estimated_duration_seconds: null, text_position: null, text_animation: null, transition_type: null, presentation_config: { jdp_import_v1: { legacyPageId: 'legacy-page', legacyChapterId: 'legacy-chapter', legacyChapterSlug: 'um' } }, media: [] }] }] };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); localStorage.clear(); });
describe('API', () => {
  it('adapta mídia, capítulo e metadados legados', () => {
    const story = adaptStory(dto);
    expect(story.coverImage?.desktop.src).toBe('/assets/capa.webp');
    expect(story.presentationMedia?.previewImages?.[0].spritePosition).toBe('top-left');
    expect(story.chapters[0].slug).toBe('um');
    expect(story.chapters[0].pages[0].text).toBe('Texto');
    expect(resolveMedia({ ...dto.cover_asset!, storage_path: 'https://example.com/a.webp?x=1' })).toBe('https://example.com/a.webp?x=1');
    expect(resolveMedia({ ...dto.cover_asset!, storage_path: '../secret' })).toBe('');
  });
  it('preserva progresso legado sem apagar ou sobrescrever', () => {
    const key = 'jardim-de-papel:reader-progress:legacy-story';
    localStorage.setItem(key, JSON.stringify({ version: 1, storyId: 'legacy-story', chapterId: 'legacy-chapter', pageId: 'legacy-page', mode: 'traditional', percentage: 100, lastReadAt: '2026-01-01T00:00:00Z', completed: false }));
    const story = adaptStory(dto); migrateLegacyProgress(story); migrateLegacyProgress(story);
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('jardim-de-papel:reader-progress:uuid-story')!)).toMatchObject({ storyId: 'uuid-story', chapterId: 'uuid-chapter', pageId: 'uuid-scene', mode: 'traditional' });
  });
  it('trata sucesso, 404 e falha de rede', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 })).mockResolvedValueOnce(new Response('', { status: 404 })).mockRejectedValueOnce(new Error('offline')));
    expect(await apiGet('/ok')).toEqual({ ok: true });
    await expect(apiGet('/missing')).rejects.toMatchObject({ status: 404 });
    await expect(apiGet('/offline')).rejects.toBeInstanceOf(ApiError);
  });
});
