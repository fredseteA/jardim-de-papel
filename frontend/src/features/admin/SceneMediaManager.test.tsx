import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaPicker, SceneMediaManager } from './SceneMediaManager';
import { addAdminSceneMedia, getAdminMedia, removeAdminSceneMedia, uploadAdminMedia } from './editorial';
import type { AdminMedia, AdminScene } from './editorial';
import { sceneToReaderPage } from '../../lib/api/adapters';
import { SceneRenderer } from '../reader/SceneRenderer';

vi.mock('./editorial', () => ({ editorialRequest: vi.fn(async () => ({ stories: [{ id: 's', title: 'História' }], collections: [], chapters: [] })), getAdminMedia: vi.fn(), getAdminMediaDetail: vi.fn(), addAdminSceneMedia: vi.fn(), removeAdminSceneMedia: vi.fn(), uploadAdminMedia: vi.fn() }));
const asset: AdminMedia = { id: 'a', storage_provider: 'supabase', storage_bucket: 'editorial-media', storage_path: 'cena.webp', resolved_url: 'https://example.test/cena.webp', media_type: 'image', mime_type: 'image/webp', file_size: 100, asset_metadata: { title: 'Na floresta' } };
const scene: AdminScene = { id: 'c', chapter_id: 'ch', display_order: 0, title: '', narrative_text: 'Era uma vez', estimated_duration_seconds: null, text_position: 'top', text_animation: 'fade', transition_type: 'fade', presentation_config: {}, media: [] };

describe('seleção editorial de imagens', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getAdminMedia).mockResolvedValue({ items: [asset], limit: 24, offset: 0 }); HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); }; });
  it('abre a biblioteca, seleciona e só persiste ao confirmar', async () => {
    const changed = vi.fn();
    vi.mocked(addAdminSceneMedia).mockResolvedValue({ id: 'link', scene_id: 'c', media_asset_id: 'a', role: 'illustration', display_order: 0, configuration: {}, asset });
    render(<SceneMediaManager storyId="s" slug="historia" chapterId="ch" scene={scene} onChanged={changed} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Escolher imagem' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Na floresta/ }));
    expect(addAdminSceneMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ media: [expect.objectContaining({ media_asset_id: 'a' })] })));
    expect(screen.getByRole('status')).toHaveTextContent('Imagem associada e salva corretamente.');
  });
  it('preserva seleção ao falhar e permite tentar novamente', async () => {
    const confirm = vi.fn().mockRejectedValueOnce(new Error('Falha da API')).mockResolvedValueOnce(undefined); const close = vi.fn();
    render(<MediaPicker storyId="s" kind="image" onConfirm={confirm} onClose={close} />);
    fireEvent.click(await screen.findByRole('button', { name: /Na floresta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha da API');
    expect(screen.getByRole('button', { name: 'Confirmar seleção' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it('upload fica selecionado sem associação silenciosa', async () => {
    vi.mocked(uploadAdminMedia).mockResolvedValue(asset); const confirm = vi.fn();
    render(<MediaPicker storyId="s" kind="image" onConfirm={confirm} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Enviar novo arquivo'), { target: { files: [new File(['data'], 'cena.webp', { type: 'image/webp' })] } });
    await screen.findByText('Selecionado: Na floresta');
    expect(confirm).not.toHaveBeenCalled(); expect(addAdminSceneMedia).not.toHaveBeenCalled();
  });
  it('remove somente o vínculo e retorna a cena atualizada', async () => {
    vi.mocked(removeAdminSceneMedia).mockResolvedValue(undefined); const changed = vi.fn();
    render(<SceneMediaManager storyId="s" slug="historia" chapterId="ch" scene={{ ...scene, media: [{ id: 'link', scene_id: 'c', media_asset_id: 'a', role: 'illustration', display_order: 0, configuration: {}, asset }] }} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover imagem' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ media: [] })));
    expect(removeAdminSceneMedia).toHaveBeenCalledWith('s', 'ch', 'c', 'link');
  });
  it('o mesmo contrato de mídia de fundo é consumido pela prévia e pelo leitor', () => {
    const page = sceneToReaderPage({ ...scene, media: [{ role: 'background', display_order: 0, configuration: { alt: 'Uma floresta' }, asset: { ...asset, resolved_url: '/api/v1/media/a/content' } }] });
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const resolved = sceneToReaderPage({ ...scene, media: [{ role: 'background', display_order: 0, configuration: { alt: 'Uma floresta' }, asset: { ...asset, resolved_url: '/api/v1/media/a/content' } }] });
    expect(page.illustration).toBeDefined();
    render(<SceneRenderer page={resolved} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    expect(screen.getByRole('img', { name: 'Uma floresta' })).toHaveAttribute('src', 'https://api.example.test/api/v1/media/a/content');
    vi.unstubAllEnvs();
  });
});
