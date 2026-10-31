import type { Story, StoryChapter, StoryPage } from '../../../types/story';
import { getStoryPages } from './navigation';
import { READER_TEXT_SIZE } from '../../../lib/readerTextSettings';

export type ReaderMode = 'immersive' | 'traditional';
export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  alignment: 'left' | 'justify';
  contrast: 'auto' | 'dark' | 'light';
  reduceMotion: boolean;
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: READER_TEXT_SIZE.default,
  lineHeight: 1.65,
  theme: 'light',
  alignment: 'left',
  contrast: 'auto',
  reduceMotion: false,
};

export type ReaderScene = {
  chapter: StoryChapter;
  page: StoryPage;
  chapterIndex: number;
  pageIndex: number;
  index: number;
  total: number;
};

export type ReaderProgress = {
  version: 1;
  storyId: string;
  chapterId: string;
  pageId: string;
  mode: ReaderMode;
  percentage: number;
  lastReadAt: string;
  completed: boolean;
};

export type ReaderStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type ReaderAdvance = { type: 'scene' | 'chapter' | 'complete'; index: number };

const PROGRESS_PREFIX = 'jardim-de-papel:reader-progress:';
const SETTINGS_KEY = 'jardim-de-papel:reader-settings';

/** Sort copies so that the source catalogue and its ordering are never mutated. */
export function getScenes(story: Story): ReaderScene[] {
  return getStoryPages(story).map(({ chapter, page, chapterIndex, pageIndex, totalPages }, index) => ({
    chapter, page, chapterIndex, pageIndex, index, total: totalPages,
  }));
}

/** Saved positions are identified by stable IDs, not by their former numeric index. */
export function getSceneIndex(scenes: readonly ReaderScene[], chapterId: string, pageId: string): number {
  const index = scenes.findIndex((scene) => scene.chapter.id === chapterId && scene.page.id === pageId);
  return index < 0 ? 0 : index;
}

export function nextScene(scenes: readonly ReaderScene[], index: number): ReaderAdvance {
  if (scenes.length === 0) return { type: 'complete', index: 0 };
  const current = Math.min(Math.max(Math.trunc(Number.isFinite(index) ? index : 0), 0), scenes.length - 1);
  if (current === scenes.length - 1) return { type: 'complete', index: current };
  const nextIndex = current + 1;
  return {
    type: scenes[current].chapter.id === scenes[nextIndex].chapter.id ? 'scene' : 'chapter',
    index: nextIndex,
  };
}

export function previousScene(scenes: readonly ReaderScene[], index: number): number {
  if (scenes.length === 0) return 0;
  const current = Math.min(Math.max(Math.trunc(Number.isFinite(index) ? index : 0), 0), scenes.length - 1);
  return Math.max(0, current - 1);
}

/** Configured editorial duration takes priority; otherwise leave comfortable reading time. */
export function estimateSceneMs(page: StoryPage): number {
  const seconds = (page as StoryPage & { readingSeconds?: number }).readingSeconds;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds, 300) * 1000;
  }
  const words = page.text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.min(300_000, Math.max(8_000, Math.ceil((words / 120) * 60_000 + 3_000)));
}

function getStorage(): ReaderStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function progressKey(storyId: string): string {
  return `${PROGRESS_PREFIX}${encodeURIComponent(storyId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReaderMode(value: unknown): value is ReaderMode {
  return value === 'immersive' || value === 'traditional';
}

/** Invalid, obsolete, or stale entries are ignored rather than sent into the reader. */
export function readProgress(story: Story, storage: ReaderStorage | null = getStorage()): ReaderProgress | null {
  try {
    const serialized = storage?.getItem(progressKey(story.id));
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    if (
      !isRecord(value) || value.version !== 1 || value.storyId !== story.id ||
      typeof value.chapterId !== 'string' || typeof value.pageId !== 'string' ||
      !isReaderMode(value.mode) || typeof value.completed !== 'boolean' ||
      typeof value.percentage !== 'number' || !Number.isFinite(value.percentage) ||
      value.percentage < 0 || value.percentage > 100 ||
      typeof value.lastReadAt !== 'string' || !Number.isFinite(Date.parse(value.lastReadAt))
    ) return null;

    const scenes = getScenes(story);
    const index = scenes.findIndex((scene) => scene.chapter.id === value.chapterId && scene.page.id === value.pageId);
    if (index < 0 || (value.completed && index !== scenes.length - 1)) return null;
    return {
      version: 1,
      storyId: story.id,
      chapterId: value.chapterId,
      pageId: value.pageId,
      mode: value.mode,
      percentage: Math.round(((index + 1) / scenes.length) * 100),
      lastReadAt: value.lastReadAt,
      completed: value.completed,
    };
  } catch {
    return null;
  }
}

/** The optional storage parameter also allows this adapter to be replaced or tested in isolation. */
export function writeProgress(
  story: Story,
  index: number,
  mode: ReaderMode,
  completed: boolean,
  storage: ReaderStorage | null = getStorage(),
): ReaderProgress | null {
  const scenes = getScenes(story);
  if (!Number.isInteger(index) || !scenes[index] || !isReaderMode(mode) || (completed && index !== scenes.length - 1)) return null;
  const scene = scenes[index];
  const progress: ReaderProgress = {
    version: 1,
    storyId: story.id,
    chapterId: scene.chapter.id,
    pageId: scene.page.id,
    mode,
    percentage: Math.round(((index + 1) / scenes.length) * 100),
    lastReadAt: new Date().toISOString(),
    completed,
  };
  try {
    if (!storage) return null;
    storage.setItem(progressKey(story.id), JSON.stringify(progress));
    return progress;
  } catch {
    return null;
  }
}

export function clearProgress(storyId: string, storage: ReaderStorage | null = getStorage()): void {
  try {
    storage?.removeItem(progressKey(storyId));
  } catch {
    // The reader must still function if browser storage is disabled.
  }
}

function normalizeSettings(value: unknown): ReaderSettings {
  if (!isRecord(value)) return { ...DEFAULT_READER_SETTINGS };
  const fontSize = typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)
    ? Math.min(READER_TEXT_SIZE.max, Math.max(READER_TEXT_SIZE.min, value.fontSize)) : DEFAULT_READER_SETTINGS.fontSize;
  const lineHeight = typeof value.lineHeight === 'number' && Number.isFinite(value.lineHeight)
    ? Math.min(2.2, Math.max(1.3, value.lineHeight)) : DEFAULT_READER_SETTINGS.lineHeight;
  const theme = value.theme === 'light' || value.theme === 'sepia' || value.theme === 'dark'
    ? value.theme : DEFAULT_READER_SETTINGS.theme;
  const alignment = value.alignment === 'left' || value.alignment === 'justify'
    ? value.alignment : DEFAULT_READER_SETTINGS.alignment;
  const contrast = value.contrast === 'dark' || value.contrast === 'light' ? value.contrast : 'auto';
  const reduceMotion = value.reduceMotion === true;
  return { fontSize, lineHeight, theme, alignment, contrast, reduceMotion };
}

export function readReaderSettings(storage: ReaderStorage | null = getStorage()): ReaderSettings {
  try {
    const serialized = storage?.getItem(SETTINGS_KEY);
    if (!serialized) return { ...DEFAULT_READER_SETTINGS };
    const envelope: unknown = JSON.parse(serialized);
    if (!isRecord(envelope) || envelope.version !== 1) return { ...DEFAULT_READER_SETTINGS };
    return normalizeSettings(envelope.settings);
  } catch {
    return { ...DEFAULT_READER_SETTINGS };
  }
}

export function writeReaderSettings(settings: ReaderSettings, storage: ReaderStorage | null = getStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, settings: normalizeSettings(settings) }));
  } catch {
    // Settings still apply in memory until the browser session ends.
  }
}
