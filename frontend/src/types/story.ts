export type StoryStatus = 'draft' | 'published';

export type StoryIllustration = { src: string; alt: string; demonstrative?: boolean; spritePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
export type StoryCoverImages = { desktop: StoryIllustration; mobile?: StoryIllustration };
export type StoryAnimation = { src: string; poster?: StoryIllustration; loop: boolean; muted: boolean; playbackBehavior?: 'manual' | 'on-page-enter' | 'with-narration' };
export type StoryNarration = { src: string; duration?: number };
export type StoryMusic = { src: string; loop: boolean };
export type StoryAudioSettings = { backgroundMusic?: StoryMusic };
export type StoryPagePresentation = {
  composition?: import('../lib/sceneComposition').SceneComposition;
  textAlignment?: 'start' | 'center' | 'end';
  textSize?: 'default' | 'large';
  textPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  textEffect?: 'words' | 'fade' | 'rise' | 'none';
  motion?: 'drift' | 'zoom' | 'breathe' | 'none';
};
export type StoryPage = { id: string; order: number; text: string; illustration?: StoryIllustration; animation?: StoryAnimation; narration?: StoryNarration; music?: StoryMusic; presentation?: StoryPagePresentation; visualDescription?: string; readingSeconds?: number };
export type StoryChapter = { id: string; slug: string; title: string; order: number; pages: readonly StoryPage[] };
export type StoryPresentationMedia = { trailer?: StoryAnimation; previewImages?: readonly StoryIllustration[] };
export type Story = { id: string; slug: string; title: string; description: string; synopsis: string; coverImage?: StoryCoverImages; collectionId: string; collectionDescription: string; ageRange: string; language: string; status: StoryStatus; featured?: boolean; chapters: readonly StoryChapter[]; presentationMedia?: StoryPresentationMedia; audio?: StoryAudioSettings };
export type StoryPageLocation = { chapter: StoryChapter; chapterIndex: number; page: StoryPage; pageIndex: number; pageNumber: number; totalPages: number };
export type StoryNavigationResult = { status: 'page'; location: StoryPageLocation } | { status: 'start' } | { status: 'completed' };
export type StoryProgress = { currentPage: number; totalPages: number; percentage: number };
