export interface MediaDTO { id: string; storage_provider: string; storage_bucket: string; storage_path: string; media_type: string; mime_type: string; asset_metadata: Record<string, unknown>; }
export interface CollectionDTO { id: string; slug: string; title: string; description: string; display_order: number; cover_asset: MediaDTO | null; }
export interface SceneMediaDTO { role: string; display_order: number; configuration: Record<string, unknown>; asset: MediaDTO; }
export interface SceneDTO { id: string; display_order: number; narrative_text: string; estimated_duration_seconds: number | null; text_position: string | null; text_animation: string | null; transition_type: string | null; presentation_config: Record<string, unknown>; media: SceneMediaDTO[]; }
export interface ChapterDTO { id: string; title: string; display_order: number; scenes: SceneDTO[]; }
export interface StoryDTO { id: string; slug: string; title: string; description: string; synopsis: string; minimum_age: number | null; maximum_age: number | null; estimated_reading_minutes: number | null; language: string; cover_asset: MediaDTO | null; hero_asset: MediaDTO | null; collections: CollectionDTO[]; chapters?: ChapterDTO[]; }
export interface PageDTO<T> { items: T[]; limit: number; offset: number; }
