import { editorialRequest, type AdminStory } from './editorial';

export const MAX_STORY_IMPORT_BYTES = 2 * 1024 * 1024;
export interface StoryImportDocument {
  schema_version: 1;
  story: {
    title: string; slug: string; collection_slug: string; synopsis: string; description: string;
    minimum_age: number | null; maximum_age: number | null; language: string;
    estimated_narration_seconds: number | null;
    editorial: Partial<Record<'author' | 'literary_origin' | 'reference_work' | 'reference_version' | 'editorial_notes' | 'copyright_notes', string | null>>;
  };
  chapters: Array<{ order: number; title: string; pages: Array<{
    order: number; title: string | null; text: string;
    illustration_description: string | null; estimated_narration_seconds: number | null;
  }> }>;
}
export interface StoryImportPreview {
  document: StoryImportDocument; collection_title: string; chapter_count: number; page_count: number;
  estimated_narration_seconds: number | null; warnings: string[];
}

export function validateStoryImport(source: string) {
  // Send the original source: the backend also detects duplicate JSON keys.
  return editorialRequest<StoryImportPreview>('/api/v1/admin/stories/import/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: source,
  });
}
export function confirmStoryImport(source: string) {
  return editorialRequest<AdminStory>('/api/v1/admin/stories/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: source,
  });
}
