import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStories } from './AdminStories';
import type { AdminMedia, AdminStory } from './editorial';

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), upload: vi.fn(), detail: vi.fn() }));
vi.mock('./editorial', () => ({ getAdminStories: mocks.list, createAdminStory: mocks.create, updateAdminStory: mocks.update, uploadAdminMedia: mocks.upload, getAdminMediaDetail: mocks.detail }));
const oldId = 'eeeeeeee-1111-4111-8111-111111111111';
const newId = 'aaaaaaaa-2222-4222-8222-222222222222';
const asset: AdminMedia = { id: newId, storage_provider: 'supabase', storage_bucket: 'editorial-media', storage_path: 'stories/test/capa.webp', resolved_url: 'https://example.test/capa.webp', media_type: 'image', mime_type: 'image/webp', file_size: 100, asset_metadata: { title: 'Nova capa' } };
const story: AdminStory = { id: 'story-id', slug: 'chapeuzinho-vermelho', title: 'Chapeuzinho Vermelho', subtitle: null, synopsis: 'Uma jornada.', description: '', cover_asset_id: oldId, hero_asset_id: null, minimum_age: 4, maximum_age: 8, estimated_reading_minutes: 12, language: 'pt-BR', status: 'published', published_at: null, collections: [], chapter_count: 5, cover_asset: { storage_provider: 'supabase', storage_path: 'old.webp', resolved_url: 'https://example.test/old.webp' } };
const file = () => new File(['image-content'], 'capa.webp', { type: 'image/webp' });
async function edit() {
  render(<MemoryRouter><AdminStories /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Chapeuzinho Vermelho' }));
  await screen.findByAltText('Capa anterior');
}
const send = (label = 'Capa da história', image = file()) => fireEvent.change(screen.getByLabelText(`Arquivo de imagem: ${label}`), { target: { files: [image] } });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({ items: [story], limit: 12, offset: 0 });
  mocks.detail.mockResolvedValue({ ...asset, id: oldId, resolved_url: 'https://example.test/old.webp', asset_metadata: { title: 'Capa anterior' }, usage: [] });
  mocks.upload.mockResolvedValue(asset);
  mocks.update.mockResolvedValue({ ...story, cover_asset_id: newId });
  mocks.create.mockResolvedValue({ ...story, id: 'new-story' });
});

describe('upload de imagens nos metadados', () => {
  it('exibe a capa do Storage, envia a nova imagem e só vincula ao salvar a história', async () => {
    const { container } = render(<MemoryRouter><AdminStories /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Chapeuzinho Vermelho' }));
    await screen.findByAltText('Capa anterior');
    send();
    expect(await screen.findByText(/Imagem enviada corretamente/)).toBeInTheDocument();
    expect(screen.getByAltText('Nova capa')).toHaveAttribute('src', asset.resolved_url);
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(expect.any(File), { storyId: story.id, title: 'capa.webp' });
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue({ items: [{ ...story, cover_asset_id: newId, cover_asset: asset }], limit: 12, offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar história' }));
    expect(await screen.findByText('História salva corretamente.')).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(story.id, expect.objectContaining({ cover_asset_id: newId, hero_asset_id: null, status: 'published' }));
    await waitFor(() => expect(container.querySelector('img[src="https://example.test/capa.webp"]')).toBeInTheDocument());
  });

  it('permite enviar capa e hero antes de criar uma história sem inventar um storyId', async () => {
    render(<MemoryRouter><AdminStories /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Nova história' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Outra aventura' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'outra-aventura' } });
    send(); await screen.findByText(/Imagem enviada corretamente/);
    send('Hero da história');
    await waitFor(() => expect(screen.getAllByText(/Imagem enviada corretamente/)).toHaveLength(2));
    expect(mocks.upload).toHaveBeenNthCalledWith(1, expect.any(File), { title: 'capa.webp' });
    expect(mocks.upload).toHaveBeenNthCalledWith(2, expect.any(File), { title: 'capa.webp' });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar história' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ cover_asset_id: newId, hero_asset_id: newId, title: 'Outra aventura', status: 'draft' })));
  });

  it('mantém a capa anterior quando o upload falha e libera uma nova tentativa', async () => {
    mocks.upload.mockRejectedValueOnce(new Error('Armazenamento indisponível.'));
    await edit(); send();
    expect(await screen.findByRole('alert')).toHaveTextContent('Armazenamento indisponível.');
    expect(screen.getByAltText('Capa anterior')).toHaveAttribute('src', 'https://example.test/old.webp');
    expect(screen.getByRole('button', { name: 'Salvar história' })).toBeEnabled();
    expect(screen.getByLabelText('Referência: Capa da história')).toHaveValue(oldId);
    send(); expect(await screen.findByAltText('Nova capa')).toBeInTheDocument();
    expect(mocks.upload).toHaveBeenCalledTimes(2);
  });

  it('preserva o arquivo enviado se salvar falhar, sem exigir outro upload', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Falha ao salvar os metadados.')).mockResolvedValueOnce(story);
    await edit(); send(); await screen.findByAltText('Nova capa');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar história' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar os metadados.');
    expect(screen.getByAltText('Nova capa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar história' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar história' }));
    await screen.findByText('História salva corretamente.');
    expect(mocks.upload).toHaveBeenCalledTimes(1); expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it('bloqueia salvar e sair do formulário enquanto o envio está pendente', async () => {
    let complete!: (value: AdminMedia) => void;
    mocks.upload.mockImplementation(() => new Promise<AdminMedia>(resolve => { complete = resolve; }));
    await edit(); send();
    expect(screen.getByRole('button', { name: 'Aguarde o envio das imagens…' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Cancelar' }).every(button => button.hasAttribute('disabled'))).toBe(true);
    fireEvent.submit(screen.getByLabelText('Título').closest('form')!);
    expect(mocks.update).not.toHaveBeenCalled();
    complete(asset);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar história' })).toBeEnabled());
  });

  it('rejeita formatos não suportados e arquivos grandes sem enviar ao servidor', async () => {
    await edit();
    send('Capa da história', new File(['video'], 'capa.gif', { type: 'image/gif' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('JPEG, PNG ou WebP');
    const big = file(); Object.defineProperty(big, 'size', { value: 12 * 1024 * 1024 + 1 }); send('Capa da história', big);
    expect(await screen.findByRole('alert')).toHaveTextContent('no máximo 12 MB');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.getByAltText('Capa anterior')).toBeInTheDocument();
  });
});
