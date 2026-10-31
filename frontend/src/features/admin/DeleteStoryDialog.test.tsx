import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteStoryDialog } from './DeleteStoryDialog';
import { deleteAdminStory, type AdminStory } from './editorial';

vi.mock('./editorial', () => ({ deleteAdminStory: vi.fn() }));
const story = { id: 'id', title: 'Uma história', slug: 'uma-historia', status: 'published' } as AdminStory;
function open() { const onClose = vi.fn(); const onDeleted = vi.fn(); render(<DeleteStoryDialog story={story} onClose={onClose} onDeleted={onDeleted} />); return { onClose, onDeleted }; }

describe('exclusão editorial confirmada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    vi.mocked(deleteAdminStory).mockResolvedValue(undefined);
  });
  it('explica as consequências e só habilita a exclusão com o slug exato', async () => {
    const { onDeleted } = open();
    expect(screen.getByRole('dialog', { name: 'Excluir “Uma história”?' })).toBeInTheDocument();
    expect(screen.getByText(/está publicada/)).toBeInTheDocument();
    expect(screen.getByText(/arquivos da biblioteca de mídias serão preservados/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Excluir definitivamente' }); expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Slug para confirmar exclusão'), { target: { value: 'outro-slug' } }); expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Slug para confirmar exclusão'), { target: { value: story.slug } }); fireEvent.click(button);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(story));
    expect(deleteAdminStory).toHaveBeenCalledExactlyOnceWith(story.id, story.slug);
  });
  it('cancelar não chama a API', () => {
    const { onClose } = open(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(deleteAdminStory).not.toHaveBeenCalled();
  });
  it('preserva a confirmação e libera o botão em caso de erro', async () => {
    vi.mocked(deleteAdminStory).mockRejectedValueOnce(new Error('Vínculo de dados impede a exclusão.'));
    const { onDeleted } = open();
    fireEvent.change(screen.getByLabelText('Slug para confirmar exclusão'), { target: { value: story.slug } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vínculo de dados');
    expect(screen.getByLabelText('Slug para confirmar exclusão')).toHaveValue(story.slug);
    expect(screen.getByRole('button', { name: 'Excluir definitivamente' })).toBeEnabled(); expect(onDeleted).not.toHaveBeenCalled();
  });
  it('bloqueia confirmação dupla e fechamento por Escape enquanto exclui', async () => {
    vi.mocked(deleteAdminStory).mockImplementation(() => new Promise(() => {}));
    const { onClose } = open();
    fireEvent.change(screen.getByLabelText('Slug para confirmar exclusão'), { target: { value: story.slug } });
    const button = screen.getByRole('button', { name: 'Excluir definitivamente' }); fireEvent.click(button); fireEvent.click(button);
    expect(deleteAdminStory).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Excluindo/ })).toHaveAttribute('aria-busy', 'true');
  });
});
