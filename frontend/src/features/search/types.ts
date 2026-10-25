export type SearchCategoryId = 'todos' | 'contos-classicos' | 'fabulas' | 'fe' | 'fantasia' | 'narnia';
export type DurationFilterId = 'any' | 'up-to-5' | '6-to-10' | '11-to-20' | 'over-20';
export type SearchStoryStatus = 'disponivel' | 'em-breve';
export type SearchStory = { id: string; title: string; coverUrl: string; categoryId: Exclude<SearchCategoryId, 'todos'>; categoryLabel: string; durationMin?: number; status: SearchStoryStatus; description?: string; href?: string };
export type SearchFilters = { query: string; categoryId: SearchCategoryId; durationId: DurationFilterId };
