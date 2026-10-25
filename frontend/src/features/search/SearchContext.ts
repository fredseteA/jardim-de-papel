import { createContext, useContext } from 'react';
import type { DurationFilterId, SearchCategoryId } from './types';

export type SearchContextValue = { isOpen: boolean; openSearch: () => void; closeSearch: () => void; registerTrigger: (element: HTMLButtonElement | null) => void; query: string; setQuery: (value: string) => void; categoryId: SearchCategoryId; setCategoryId: (value: SearchCategoryId) => void; durationId: DurationFilterId; setDurationId: (value: DurationFilterId) => void; clearFilters: () => void };
export const SearchContext = createContext<SearchContextValue | null>(null);
export function useSearch() { const context = useContext(SearchContext); if (!context) throw new Error('useSearch must be used within SearchProvider'); return context; }
