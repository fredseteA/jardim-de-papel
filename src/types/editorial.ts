export type ReadingMode = 'immersive' | 'traditional';

export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage?: string;
}

export interface StoryIllustration { src: string; alt: string; credit?: string; }
export interface StoryAnimation { src: string; poster?: string; alt: string; }
export interface StoryNarration { src: string; durationSeconds?: number; }
export interface StoryMusic { src: string; title: string; loop?: boolean; }

export interface StoryPage {
  id: string;
  text: string;
  illustration?: StoryIllustration;
  animation?: StoryAnimation;
  narration?: StoryNarration;
  music?: StoryMusic;
}

export interface Chapter { id: string; title: string; order: number; pages: StoryPage[]; }

export interface Story {
  id: string;
  collectionId: string;
  slug: string;
  title: string;
  synopsis: string;
  coverImage?: string;
  ageRange?: string;
  collectionName?: string;
  chapters: Chapter[];
  availableReadingModes: ReadingMode[];
}

export interface ReadingProgress {
  storyId: string;
  chapterId: string;
  pageId: string;
  mode: ReadingMode;
  updatedAt: string;
}
