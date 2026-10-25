import { describe, expect, it } from 'vitest';
import type { Story } from '../../../types/story';
import {
  DEFAULT_READER_SETTINGS,
  clearProgress,
  estimateSceneMs,
  getSceneIndex,
  getScenes,
  nextScene,
  previousScene,
  readProgress,
  readReaderSettings,
  writeProgress,
  writeReaderSettings,
  type ReaderStorage,
} from './readerCore';

const story: Story = {
  id: 'story-one', slug: 'one', title: 'Uma história', description: '', synopsis: '',
  collectionId: 'fables', collectionDescription: 'Fábulas', ageRange: '', language: 'pt-BR', status: 'published',
  chapters: [
    { id: 'chapter-2', slug: 'two', title: 'Dois', order: 2, pages: [{ id: 'page-3', order: 1, text: 'Terceira cena.' }] },
    { id: 'chapter-1', slug: 'one', title: 'Um', order: 1, pages: [
      { id: 'page-2', order: 2, text: 'Segunda cena.' },
      { id: 'page-1', order: 1, text: 'Primeira cena.' },
    ] },
  ],
};

function memoryStorage(): ReaderStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe('reader scene navigation', () => {
  it('orders chapters and pages without changing the catalogue', () => {
    const scenes = getScenes(story);
    expect(scenes.map(({ page }) => page.id)).toEqual(['page-1', 'page-2', 'page-3']);
    expect(scenes.map(({ index, total }) => [index, total])).toEqual([[0, 3], [1, 3], [2, 3]]);
    expect(story.chapters[0].id).toBe('chapter-2');
    expect(story.chapters[1].pages[0].id).toBe('page-2');
  });

  it('distinguishes advancing, a chapter boundary and completion', () => {
    const scenes = getScenes(story);
    expect(nextScene(scenes, 0)).toEqual({ type: 'scene', index: 1 });
    expect(nextScene(scenes, 1)).toEqual({ type: 'chapter', index: 2 });
    expect(nextScene(scenes, 2)).toEqual({ type: 'complete', index: 2 });
    expect(previousScene(scenes, 2)).toBe(1);
    expect(previousScene(scenes, 0)).toBe(0);
    expect(nextScene([], 0)).toEqual({ type: 'complete', index: 0 });
    expect(previousScene([], 0)).toBe(0);
  });

  it('uses the text length and respects a configured scene duration', () => {
    expect(estimateSceneMs({ id: 'short', order: 1, text: 'Olá!' })).toBe(8000);
    expect(estimateSceneMs({ id: 'long', order: 1, text: 'palavra '.repeat(90) })).toBeGreaterThan(estimateSceneMs({ id: 'short', order: 1, text: 'Olá!' }));
    expect(estimateSceneMs({ id: 'very-long', order: 1, text: 'palavra '.repeat(200) })).toBeGreaterThan(60_000);
    const timedPage = { id: 'timed', order: 1, text: '', readingSeconds: 12 };
    expect(estimateSceneMs(timedPage)).toBe(12000);
  });
});

describe('reader persistence', () => {
  it('restores both reading modes and a position by stable IDs after the order changes', () => {
    const storage = memoryStorage();
    expect(writeProgress(story, 1, 'traditional', false, storage)).toMatchObject({ chapterId: 'chapter-1', pageId: 'page-2', percentage: 67 });
    const reorderedStory: Story = {
      ...story,
      chapters: [
        story.chapters[0],
        { ...story.chapters[1], pages: [...story.chapters[1].pages, { id: 'inserted', order: 0, text: 'Nova cena.' }] },
      ],
    };
    const restored = readProgress(reorderedStory, storage);
    expect(restored).toMatchObject({ chapterId: 'chapter-1', pageId: 'page-2', mode: 'traditional', percentage: 75, completed: false });
    expect(getSceneIndex(getScenes(reorderedStory), restored!.chapterId, restored!.pageId)).toBe(2);
    expect(writeProgress(reorderedStory, 2, 'immersive', false, storage)).toMatchObject({ pageId: 'page-2', mode: 'immersive' });
  });

  it('stores completion only at the end and clears progress independently per story', () => {
    const storage = memoryStorage();
    const another: Story = { ...story, id: 'story-two' };
    expect(writeProgress(story, 1, 'immersive', true, storage)).toBeNull();
    expect(writeProgress(story, 2, 'immersive', true, storage)).toMatchObject({ completed: true, percentage: 100 });
    writeProgress(another, 0, 'immersive', false, storage);
    clearProgress(story.id, storage);
    expect(readProgress(story, storage)).toBeNull();
    expect(readProgress(another, storage)).not.toBeNull();
  });

  it('ignores malformed, outdated or stale records', () => {
    const storage = memoryStorage();
    const key = 'jardim-de-papel:reader-progress:story-one';
    storage.setItem(key, '{');
    expect(readProgress(story, storage)).toBeNull();
    const valid = writeProgress(story, 0, 'immersive', false, storage)!;
    storage.setItem(key, JSON.stringify({ ...valid, version: 2 }));
    expect(readProgress(story, storage)).toBeNull();
    storage.setItem(key, JSON.stringify({ ...valid, pageId: 'removed' }));
    expect(readProgress(story, storage)).toBeNull();
    storage.setItem(key, JSON.stringify({ ...valid, chapterId: 'chapter-2' }));
    expect(readProgress(story, storage)).toBeNull();
  });

  it('handles disabled or failing storage without breaking the reader', () => {
    const blocked: ReaderStorage = {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
      removeItem: () => { throw new Error('unavailable'); },
    };
    expect(readProgress(story, blocked)).toBeNull();
    expect(writeProgress(story, 0, 'immersive', false, blocked)).toBeNull();
    expect(() => clearProgress(story.id, blocked)).not.toThrow();
    expect(readReaderSettings(blocked)).toEqual(DEFAULT_READER_SETTINGS);
    expect(() => writeReaderSettings(DEFAULT_READER_SETTINGS, blocked)).not.toThrow();
  });

  it('persists and validates traditional reading preferences', () => {
    const storage = memoryStorage();
    const settings = { fontSize: 23, lineHeight: 1.9, theme: 'sepia' as const, alignment: 'justify' as const, contrast: 'auto' as const, reduceMotion: false };
    writeReaderSettings(settings, storage);
    expect(readReaderSettings(storage)).toEqual(settings);
    storage.setItem('jardim-de-papel:reader-settings', JSON.stringify({ version: 1, settings: { ...settings, fontSize: 100, lineHeight: 0, theme: 'unknown' } }));
    expect(readReaderSettings(storage)).toEqual({ fontSize: 28, lineHeight: 1.3, theme: 'light', alignment: 'justify', contrast: 'auto', reduceMotion: false });
    storage.setItem('jardim-de-papel:reader-settings', JSON.stringify({ version: 42, settings }));
    expect(readReaderSettings(storage)).toEqual(DEFAULT_READER_SETTINGS);
  });
});
