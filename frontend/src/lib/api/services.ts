import { apiGet } from './client';
import type { CollectionDTO, PageDTO, StoryDTO } from './types';
export const getStories = (params: URLSearchParams, signal?: AbortSignal) => apiGet<PageDTO<StoryDTO>>(`/api/v1/stories?${params}`, signal);
export const getCollections = (signal?: AbortSignal) => apiGet<PageDTO<CollectionDTO>>('/api/v1/collections?limit=100', signal);
export const getCollection = (slug: string, signal?: AbortSignal) => apiGet<CollectionDTO>(`/api/v1/collections/${encodeURIComponent(slug)}`, signal);
export const getReading = (slug: string, signal?: AbortSignal) => apiGet<StoryDTO>(`/api/v1/stories/${encodeURIComponent(slug)}/reading`, signal);
