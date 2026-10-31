import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChapterSceneEditor } from './ChapterSceneEditor';
import { getAdminChapters, getAdminScenes, updateAdminScene, type AdminScene, type AdminStory } from './editorial';
vi.mock('./editorial', () => ({ getAdminChapters: vi.fn(), getAdminScenes: vi.fn(), updateAdminScene: vi.fn(), updateAdminChapter: vi.fn(), createAdminChapter: vi.fn(), createAdminScene: vi.fn(), deleteAdminChapter: vi.fn(), deleteAdminScene: vi.fn(), reorderAdminChapters: vi.fn(), reorderAdminScenes: vi.fn() }));
vi.mock('./SceneMediaManager', () => ({ SceneMediaManager: () => null }));
vi.mock('./CompositionEditor', () => ({ CompositionEditor: () => null }));
const story = { id: 'story', title: 'História', slug: 'historia' } as AdminStory;
const scene: AdminScene = { id: 'scene', chapter_id: 'chapter', display_order: 0, title: null, narrative_text: 'Antes', estimated_duration_seconds: null, text_position: null, text_animation: null, transition_type: null, presentation_config: {}, media: [] };
describe('salvamento do texto da cena', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getAdminChapters).mockResolvedValue([{ id: 'chapter', story_id: 'story', title: 'Capítulo', description: null, display_order: 0, scene_count: 1 }]); vi.mocked(getAdminScenes).mockResolvedValue([scene]); });
  it('encerra o carregamento com a resposta da gravação sem esperar outra listagem', async () => {
    vi.mocked(updateAdminScene).mockResolvedValue({ ...scene, narrative_text: 'Depois' });
    render(<ChapterSceneEditor story={story} onClose={() => {}} />);
    const field = await screen.findByLabelText('Texto narrativo');
    // The field can mount one render before the scene initializes its draft.
    await waitFor(() => expect(field).toHaveValue('Antes'));
    fireEvent.change(field, { target: { value: 'Depois' } });
    // A second list request would hang forever. Save must not depend on it.
    vi.mocked(getAdminScenes).mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cena' }));
    await screen.findByText('Texto da cena salvo corretamente.');
    expect(screen.getByRole('button', { name: 'Salvar cena' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Salvar cena' })).toHaveAttribute('aria-busy', 'false');
    expect(getAdminScenes).toHaveBeenCalledTimes(1);
  });
  it('mostra falha, libera o botão e preserva o texto para nova tentativa', async () => {
    vi.mocked(updateAdminScene).mockRejectedValueOnce(new Error('Serviço indisponível')).mockResolvedValueOnce({ ...scene, narrative_text: 'Depois' });
    render(<ChapterSceneEditor story={story} onClose={() => {}} />);
    const field = await screen.findByLabelText('Texto narrativo');
    await waitFor(() => expect(field).toHaveValue('Antes'));
    fireEvent.change(field, { target: { value: 'Depois' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cena' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível'); expect(screen.getByLabelText('Texto narrativo')).toHaveValue('Depois');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar cena' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cena' })); await screen.findByText('Texto da cena salvo corretamente.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('permite editar a sugestão importada sem enviar ou apagar a composição', async () => {
    const config = { composition: { version: 1, revision: 2, layouts: { portrait: { text_x: 20 } } }, editorial: { illustration_description: 'Ilustração sugerida.' }, motion: 'none' };
    vi.mocked(getAdminScenes).mockResolvedValue([{ ...scene, presentation_config: config }]);
    vi.mocked(updateAdminScene).mockResolvedValue({ ...scene, presentation_config: { ...config, editorial: { illustration_description: 'Ilustração revisada.' } } });
    render(<ChapterSceneEditor story={story} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Sugestão de ilustração')).toHaveValue('Ilustração sugerida.'));
    fireEvent.change(screen.getByLabelText('Sugestão de ilustração'), { target: { value: 'Ilustração revisada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cena' }));
    await screen.findByText('Texto da cena salvo corretamente.');
    expect(updateAdminScene).toHaveBeenCalledWith('story', 'chapter', 'scene', expect.objectContaining({ presentation_config: { editorial: { illustration_description: 'Ilustração revisada.' } } }));
  });
});
