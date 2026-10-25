import type { Story, StoryPageLocation } from '../../../types/story'

/** Returns the narrative order without modifying the editorial source. */
export function getStoryPages(story: Story): StoryPageLocation[] {
  const chapters = [...story.chapters].sort((a, b) => a.order - b.order)
  const totalPages = chapters.reduce((total, chapter) => total + chapter.pages.length, 0)
  const pages: StoryPageLocation[] = []

  chapters.forEach((chapter, chapterIndex) => {
    ;[...chapter.pages].sort((a, b) => a.order - b.order).forEach((page, pageIndex) => {
      pages.push({ chapter, chapterIndex, page, pageIndex, pageNumber: pages.length + 1, totalPages })
    })
  })

  return pages
}
