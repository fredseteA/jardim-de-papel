import { supabase } from './auth';
import { withEditorialDeadline } from './requestDeadline';

export type EditorialStatus = 'draft' | 'published' | 'archived';

export type AdminStory = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  synopsis: string;
  description: string;
  cover_asset_id: string | null;
  hero_asset_id: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  estimated_reading_minutes: number | null;
  language: string;
  status: EditorialStatus;
  published_at: string | null;
  collections: string[];
  chapter_count: number;
  cover_asset: { storage_path: string; storage_provider: string; resolved_url?: string | null } | null;
};

export type AdminStoryPage = { items: AdminStory[]; limit: number; offset: number };
export type StoryDraft = Omit<AdminStory, 'id' | 'collections' | 'chapter_count' | 'cover_asset' | 'published_at'> & { published_at?: string | null };
export type AdminChapter = { id: string; story_id: string; title: string; description: string | null; display_order: number; scene_count: number };
export type AdminMedia = { story_count?: number; id: string; storage_provider: string; storage_bucket: string; storage_path: string; resolved_url?: string | null; media_type: 'image' | 'video' | 'audio' | 'animation'; mime_type: string; file_size: number | null; width?: number | null; height?: number | null; duration_seconds?: number | null; asset_metadata: Record<string, unknown> };
export type MediaUsage = { kind: 'scene' | 'story_cover' | 'story_hero' | 'collection'; story_id?: string | null; story_title?: string | null; chapter_id?: string | null; scene_id?: string | null; role?: string | null };
export type AdminMediaDetail = AdminMedia & { usage: MediaUsage[] };
export type SceneMedia = { id: string; scene_id: string; media_asset_id: string; role: 'background' | 'illustration' | 'animation' | 'narration' | 'ambient_music' | 'sound_effect'; display_order: number; configuration: Record<string, unknown>; asset: AdminMedia };
export type AdminScene = { id: string; chapter_id: string; display_order: number; title: string | null; narrative_text: string; estimated_duration_seconds: number | null; text_position: string | null; text_animation: string | null; transition_type: string | null; presentation_config: Record<string, unknown>; media: SceneMedia[] };

function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL;
  if (!value) throw new Error('Serviço editorial não configurado.');
  return value.replace(/\/+$/, '');
}

export async function editorialRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return withEditorialDeadline(async signal => {
  if (!supabase) throw new Error('A autenticação administrativa não está configurada.');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sua sessão expirou. Entre novamente.');
  signal.throwIfAborted();
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, signal]) : signal,
    headers: { Accept: 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...init.headers },
  });
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('O serviço retornou uma resposta inesperada. Não foi possível confirmar o salvamento. Verifique o conteúdo antes de tentar novamente.');
    return await response.json() as T;
  }
  const body: unknown = response.headers.get('content-type')?.includes('application/json') ? await response.json().catch(() => null) : null;
  const detail = body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string' ? body.detail : null;
  if (response.status === 401 || response.status === 403) throw new Error('Sua conta não possui permissão editorial.');
  if (response.status === 409) throw new Error(detail ?? 'Este slug já está em uso.');
  if (response.status === 422) throw new Error(detail ?? 'Revise os dados da história.');
  throw new Error(detail ?? 'Não foi possível concluir a operação editorial.');
  }, path.endsWith('/upload') ? 90_000 : 30_000).catch((reason: unknown) => {
    if (reason instanceof TypeError) throw new Error('Falha de conexão com o serviço editorial. Suas alterações foram mantidas; tente novamente.');
    if (reason instanceof SyntaxError) throw new Error('O serviço retornou uma resposta inválida. Não foi possível confirmar o salvamento. Verifique o conteúdo antes de tentar novamente.');
    throw reason;
  });
}

export function getAdminStories(params: URLSearchParams) {
  return editorialRequest<AdminStoryPage>(`/api/v1/admin/stories?${params.toString()}`);
}

export function getAdminStory(id: string) {
  return editorialRequest<AdminStory>(`/api/v1/admin/stories/${encodeURIComponent(id)}`);
}

export function createAdminStory(draft: StoryDraft) {
  return editorialRequest<AdminStory>('/api/v1/admin/stories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
}

export function updateAdminStory(id: string, draft: Partial<StoryDraft>) {
  return editorialRequest<AdminStory>(`/api/v1/admin/stories/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
}

export function deleteAdminStory(id: string, confirmationSlug: string) {
  return editorialRequest<void>(`/api/v1/admin/stories/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, confirmation_slug: confirmationSlug }),
  });
}

export function getAdminChapters(storyId: string) { return editorialRequest<AdminChapter[]>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters`); }
export function createAdminChapter(storyId: string, draft: { title: string; description?: string | null }) { return editorialRequest<AdminChapter>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); }
export function updateAdminChapter(storyId: string, chapterId: string, draft: { title?: string; description?: string | null }) { return editorialRequest<AdminChapter>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); }
export function reorderAdminChapters(storyId: string, ids: string[]) { return editorialRequest<AdminChapter[]>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); }
export function deleteAdminChapter(storyId: string, chapterId: string) { return editorialRequest<void>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}?confirm=true`, { method: 'DELETE' }); }
export function getAdminScenes(storyId: string, chapterId: string) { return editorialRequest<AdminScene[]>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes`); }
export function createAdminScene(storyId: string, chapterId: string, draft: Pick<AdminScene, 'narrative_text' | 'title' | 'estimated_duration_seconds' | 'text_position' | 'text_animation' | 'transition_type' | 'presentation_config'>) { return editorialRequest<AdminScene>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); }
export function updateAdminScene(storyId: string, chapterId: string, sceneId: string, draft: Partial<Omit<AdminScene, 'id' | 'chapter_id' | 'display_order' | 'media'>>) { return editorialRequest<AdminScene>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes/${encodeURIComponent(sceneId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); }
export function reorderAdminScenes(storyId: string, chapterId: string, ids: string[]) { return editorialRequest<AdminScene[]>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }); }
export function deleteAdminScene(storyId: string, chapterId: string, sceneId: string) { return editorialRequest<void>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes/${encodeURIComponent(sceneId)}?confirm=true`, { method: 'DELETE' }); }
export function addAdminSceneMedia(storyId: string, chapterId: string, sceneId: string, draft: { media_asset_id: string; role: SceneMedia['role']; display_order?: number; configuration?: Record<string, unknown> }) { return editorialRequest<SceneMedia>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes/${encodeURIComponent(sceneId)}/media`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); }
export function removeAdminSceneMedia(storyId: string, chapterId: string, sceneId: string, linkId: string) { return editorialRequest<void>(`/api/v1/admin/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/scenes/${encodeURIComponent(sceneId)}/media/${encodeURIComponent(linkId)}`, { method: 'DELETE' }); }
export function getAdminMedia(params = new URLSearchParams()) { return editorialRequest<{ items: AdminMedia[]; limit: number; offset: number }>(`/api/v1/admin/media?${params}`); }
export function getAdminMediaDetail(id: string) { return editorialRequest<AdminMediaDetail>(`/api/v1/admin/media/${encodeURIComponent(id)}`); }
export function deleteAdminMedia(id: string) { return editorialRequest<void>(`/api/v1/admin/media/${encodeURIComponent(id)}?confirm=true`, { method: 'DELETE' }); }
export async function uploadAdminMedia(file: File, metadata: { title?: string; description?: string; storyId?: string } = {}) {
  const form = new FormData(); form.set('file', file); if (metadata.title) form.set('title', metadata.title); if (metadata.description) form.set('description', metadata.description); if (metadata.storyId) form.set('story_id', metadata.storyId);
  return editorialRequest<AdminMedia>('/api/v1/admin/media/upload', { method: 'POST', body: form });
}
