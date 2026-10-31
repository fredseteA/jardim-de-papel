import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStories } from './AdminStories';

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock('./editorial', () => ({ getAdminStories: mocks.list, createAdminStory: mocks.create, updateAdminStory: mocks.update, deleteAdminStory: mocks.delete }));

const story = {
  id: 'story-id', slug: 'chapeuzinho-vermelho', title: 'Chapeuzinho Vermelho', subtitle: null,
  synopsis: 'Uma jornada.', description: 'Descrição.', cover_asset_id: null, hero_asset_id: null,
  minimum_age: 4, maximum_age: 8, estimated_reading_minutes: 12, language: 'pt-BR',
  status: 'published' as const, published_at: '2026-10-01T00:00:00Z', collections: ['Contos Clássicos'], chapter_count: 5, cover_asset: null,
};

describe('catálogo editorial de histórias', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue({ items: [story], limit: 12, offset: 0 }); });
  it('lista metadados editoriais e permite filtrar por status', async () => {
    render(<MemoryRouter><AdminStories /></MemoryRouter>);
    expect(await screen.findByText('Chapeuzinho Vermelho')).toBeInTheDocument();
    expect(screen.getByText('5 capítulos')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status editorial'), { target: { value: 'draft' } });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({}))); 
    expect(mocks.list.mock.calls.at(-1)?.[0].get('status')).toBe('draft');
  });
  it('abre o formulário de uma nova história sem tocar nos capítulos existentes', async () => {
    render(<MemoryRouter><AdminStories /></MemoryRouter>);
    await screen.findByText('Chapeuzinho Vermelho');
    fireEvent.click(screen.getByRole('button', { name: /nova história/i }));
    expect(screen.getByRole('heading', { name: 'Nova história' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
  });
  it('oferece a importação como alternativa ao formulário existente', async () => {
    render(<MemoryRouter><AdminStories /></MemoryRouter>);
    await screen.findByText('Chapeuzinho Vermelho');
    fireEvent.click(screen.getByRole('button', { name: 'Importar história por JSON' }));
    expect(screen.getByRole('heading', { name: 'Importar história por JSON' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Selecionar arquivo JSON/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Voltar ao catálogo/ }));
    expect(await screen.findByRole('heading', { name: 'Histórias' })).toBeInTheDocument();
  });
  it('exclui a história publicada após confirmação e atualiza a lista com feedback', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    mocks.delete.mockResolvedValue(undefined);
    render(<MemoryRouter><AdminStories /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Chapeuzinho Vermelho' }));
    expect(mocks.delete).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Slug para confirmar exclusão'), { target: { value: story.slug } });
    mocks.list.mockResolvedValue({ items: [], limit: 12, offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    expect(await screen.findByText(/excluída corretamente/)).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma história encontrada')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith('story-id', story.slug);
  });
});
