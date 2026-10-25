import { discoverStoryBooks } from '../../data/discoverStoriesPresentation';
import type { SearchCategoryId, SearchStory } from './types';

/** Single translation layer for editorial tags used by current mock/presentation data. */
export const categoryIdByTag: Record<string, Exclude<SearchCategoryId, 'todos'>> = {
  'Contos Encantados': 'contos-classicos', 'Contos Clássicos': 'contos-classicos', 'Fábulas': 'fabulas', 'Histórias da Fé': 'fe', 'Fé': 'fe', 'Fantasia': 'fantasia', 'Mundos de Fantasia': 'fantasia', 'Nárnia': 'narnia',
};

export const searchStories: readonly SearchStory[] = discoverStoryBooks.map((book) => ({
  id: book.id, title: book.title, coverUrl: book.cover, categoryId: categoryIdByTag[book.category] ?? 'fantasia', categoryLabel: book.category, durationMin: book.estimatedMinutes, status: book.isComingSoon ? 'em-breve' : 'disponivel', description: book.title, href: book.href,
}));
