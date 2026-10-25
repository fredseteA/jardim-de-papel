import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error instanceof ApiError && error.status != null && error.status < 500) && count < 1,
    retryDelay: 1000,
  } } });
}
export const queryClient = createQueryClient();

export const queryKeys = {
  stories: (params: URLSearchParams) => ['stories', [...params.entries()].sort(([a], [b]) => a.localeCompare(b))] as const,
  collections: ['collections'] as const,
  collection: (slug: string) => ['collection', slug] as const,
  reading: (slug: string) => ['reading', slug] as const,
};
