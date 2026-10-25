import { discoverStoryBooks } from '../../data/discoverStoriesPresentation';
import { categoryIdByTag } from './categories';
import type { SearchStory } from './types';
// Test fixtures only. The running search requests the API.
export const searchStories: readonly SearchStory[] = discoverStoryBooks.map(book => ({ id: book.id, title: book.title, coverUrl: book.cover, categoryId: categoryIdByTag[book.category] ?? 'fantasia', categoryLabel: book.category, durationMin: book.estimatedMinutes, status: book.isComingSoon ? 'em-breve' : 'disponivel', description: book.title, href: book.href }));
