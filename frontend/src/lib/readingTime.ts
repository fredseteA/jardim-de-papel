import type { Story } from '../types/story';

/** An estimate based on the text rather than treating every short scene as a two-minute page. */
export function getEstimatedReadingMinutes(story: Story): number | undefined {
  const pages = story.chapters.flatMap((chapter) => chapter.pages);
  if (!pages.length) return undefined;
  const words = pages.reduce((total, page) => total + page.text.trim().split(/\s+/u).filter(Boolean).length, 0);
  return Math.max(1, Math.ceil(words / 100 + pages.length * 2 / 60));
}
