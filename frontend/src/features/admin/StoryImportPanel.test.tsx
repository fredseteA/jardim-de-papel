import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryImportPanel } from './StoryImportPanel';
import { confirmStoryImport, validateStoryImport, type StoryImportPreview } from './storyImport';
import type { AdminStory } from './editorial';

vi.mock('./storyImport', () => ({ MAX_STORY_IMPORT_BYTES: 2 * 1024 * 1024, validateStoryImport: vi.fn(), confirmStoryImport: vi.fn() }));
const preview: StoryImportPreview = {
  document: { schema_version: 1, story: { title: 'Uma pequena luz', slug: 'uma-pequena-luz', collection_slug: 'contos-classicos', synopsis: 'Uma sinopse.', description: 'Demonstração.', language: 'pt-BR', minimum_age: 4, maximum_age: 9, estimated_narration_seconds: 65, editorial: { author: 'Autor de exemplo' } }, chapters: [{ order: 1, title: 'Um começo', pages: [{ order: 1, title: null, text: 'Era uma vez uma pequena luz.', illustration_description: 'Um jardim iluminado.', estimated_narration_seconds: 65 }] }] },
  collection_title: 'Contos Clássicos', chapter_count: 1, page_count: 1, estimated_narration_seconds: 65, warnings: ['A história será criada como rascunho.'],
};
const created = { id: 'new-id', title: preview.document.story.title, status: 'draft' } as AdminStory;

function file(source = JSON.stringify(preview.document), name = 'historia.json', size = source.length) {
  return { name, size, text: vi.fn().mockResolvedValue(source) } as unknown as File;
}
function select(value = file()) {
  fireEvent.change(screen.getByLabelText(/Selecionar arquivo JSON/), { target: { files: [value] } });
}
function open() { const onCancel = vi.fn(); const onOpenStory = vi.fn(); render(<StoryImportPanel onCancel={onCancel} onOpenStory={onOpenStory} />); return { onCancel, onOpenStory }; }

describe('importação editorial por JSON', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(validateStoryImport).mockResolvedValue(preview); vi.mocked(confirmStoryImport).mockResolvedValue(created); });
  it('valida sem criar registros, mostra a prévia completa e só importa com confirmação', async () => {
    const { onOpenStory } = open(); select();
    expect(await screen.findByRole('heading', { name: 'Uma pequena luz' })).toBeInTheDocument();
    expect(confirmStoryImport).not.toHaveBeenCalled();
    expect(screen.getByText('4–9 anos')).toBeInTheDocument();
    expect(screen.getByText('1 min 5 s')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/1\. Um começo/));
    expect(screen.getByText('Era uma vez uma pequena luz.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar importação como rascunho' }));
    expect(await screen.findByText(/História importada corretamente como rascunho/)).toBeInTheDocument();
    expect(confirmStoryImport).toHaveBeenCalledExactlyOnceWith(JSON.stringify(preview.document));
    expect(screen.queryByRole('button', { name: 'Confirmar importação como rascunho' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir história no editor' }));
    expect(onOpenStory).toHaveBeenCalledWith(created);
  });
  it('não envia JSON malformado e permite escolher outro arquivo', async () => {
    open(); select(file('{'));
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON inválido');
    expect(validateStoryImport).not.toHaveBeenCalled();
    select(); await screen.findByRole('heading', { name: 'Uma pequena luz' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('rejeita extensão e tamanho antes de ler ou enviar o arquivo', async () => {
    open(); select(file('{}', 'historia.txt'));
    expect(screen.getByRole('alert')).toHaveTextContent('.json');
    select(file('{}', 'historia.json', 2 * 1024 * 1024 + 1));
    expect(screen.getByRole('alert')).toHaveTextContent('2 MiB');
    expect(validateStoryImport).not.toHaveBeenCalled();
  });
  it('exibe o campo inválido informado pelo servidor e não permite confirmação', async () => {
    vi.mocked(validateStoryImport).mockRejectedValue(new Error('chapters.0.pages.1.text: campo obrigatório'));
    open(); select();
    expect(await screen.findByRole('alert')).toHaveTextContent('chapters.0.pages.1.text');
    expect(screen.queryByRole('button', { name: /Confirmar importação/ })).not.toBeInTheDocument();
  });
  it('mantém a prévia em conflitos ou falhas e encerra o estado de carregamento', async () => {
    vi.mocked(confirmStoryImport).mockRejectedValueOnce(new Error('Este slug já está em uso.'));
    open(); select();
    const button = await screen.findByRole('button', { name: /Confirmar importação/ });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('slug');
    expect(screen.getByRole('heading', { name: 'Uma pequena luz' })).toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute('aria-busy', 'false');
  });
  it('evita confirmação duplicada e saída acidental enquanto está importando', async () => {
    vi.mocked(confirmStoryImport).mockImplementation(() => new Promise(() => {}));
    open(); select(); const button = await screen.findByRole('button', { name: /Confirmar importação/ });
    fireEvent.click(button); fireEvent.click(button);
    expect(confirmStoryImport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Importando/ })).toHaveAttribute('aria-busy', 'true');
  });
  it('permite cancelar a prévia sem importar', async () => {
    const { onCancel } = open(); select(); await screen.findByRole('heading', { name: 'Uma pequena luz' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(onCancel).toHaveBeenCalledOnce(); expect(confirmStoryImport).not.toHaveBeenCalled();
  });
});
