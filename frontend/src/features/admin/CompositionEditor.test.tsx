import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositionEditor } from './CompositionEditor';
import { editorialRequest, type AdminScene } from './editorial';
vi.mock('./editorial', () => ({ editorialRequest: vi.fn() }));
vi.mock('../reader/ReaderAudio', () => ({ ReaderAudio: () => null }));
const scene: AdminScene = { id: 'scene', chapter_id: 'chapter', display_order: 0, title: null, narrative_text: 'Uma história', estimated_duration_seconds: null, text_position: null, text_animation: null, transition_type: null, presentation_config: { motion: 'none' }, media: [] };
function open(onClose = vi.fn()) { return render(<CompositionEditor scene={scene} previewScene={scene} storyId="story" slug="slug" storyTitle="Uma história" onSaved={vi.fn()} onClose={onClose} />); }
describe('editor de composição', () => {
  beforeEach(() => { vi.clearAllMocks(); HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; });
  it('simula os tamanhos mínimo e máximo sem marcar a história como alterada', () => {
    const { container } = open();
    const text = () => container.querySelector<HTMLElement>('[data-layout]')!.style.getPropertyValue('--scene-font-size');
    fireEvent.click(screen.getByRole('button', { name: 'Mínimo' }));
    expect(screen.getByRole('slider', { name: 'Tamanho do texto na prévia' })).toHaveValue('14');
    const minimum = parseFloat(text());
    fireEvent.click(screen.getByRole('button', { name: 'Máximo' }));
    expect(screen.getByRole('slider', { name: 'Tamanho do texto na prévia' })).toHaveValue('28');
    expect(parseFloat(text())).toBeGreaterThan(minimum);
    expect(screen.getByRole('button', { name: 'Salvar composição' })).toBeDisabled();
    expect(editorialRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Padrão' }));
    expect(screen.getByRole('slider', { name: 'Tamanho do texto na prévia' })).toHaveValue('18');
  });
  it('edita cada formato independentemente e aguarda o salvamento real', async () => {
    vi.mocked(editorialRequest).mockImplementation(async (_path, init) => { const payload = JSON.parse(String(init?.body)); return { ...scene, presentation_config: { composition: { version: 1, revision: 1, layouts: payload.layouts } } } as never; });
    open(); fireEvent.click(screen.getByText('Ajustes anteriores · compatibilidade'));
    fireEvent.change(screen.getByLabelText('Texto · posição vertical'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Formato de tela'), { target: { value: 'landscape' } });
    expect(screen.getByLabelText('Texto · posição vertical')).toHaveValue('0');
    fireEvent.change(screen.getByLabelText('Imagem · zoom'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Formato de tela'), { target: { value: 'portrait' } });
    expect(screen.getByLabelText('Texto · posição vertical')).toHaveValue('80');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar composição' }));
    await screen.findByText('Composição salva corretamente.');
    expect(screen.getByRole('button', { name: 'Composição salva' })).toHaveAttribute('aria-busy', 'false');
    fireEvent.change(screen.getByLabelText('Texto · posição vertical'), { target: { value: '70' } });
    expect(screen.getByRole('button', { name: 'Salvar composição' })).toBeEnabled();
    const payload = JSON.parse(String(vi.mocked(editorialRequest).mock.calls[0][1]?.body));
    expect(payload.expected_revision).toBe(0); expect(payload.layouts.portrait.text_y).toBe(80); expect(payload.layouts.landscape.zoom).toBe(1.5);
    expect(payload).not.toHaveProperty('narrative_text');
  });
  it('mantém ajustes após falha e permite cancelar sem perder alterações do editor principal', async () => {
    vi.mocked(editorialRequest).mockRejectedValue(new Error('Falha de conexão')); const close = vi.fn(); open(close);
    fireEvent.click(screen.getByText('Ajustes anteriores · compatibilidade'));
    fireEvent.change(screen.getByLabelText('Texto · posição horizontal'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar composição' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão');
    expect(screen.getByLabelText('Texto · posição horizontal')).toHaveValue('40');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao editor' }));
    expect(close).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao editor' })); fireEvent.click(screen.getByRole('button', { name: 'Descartar e sair' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it('mostra a composição automática de livro e preserva ajustes antigos sem aplicá-los sobre a ilustração', () => {
    const {container}=open();
    expect(screen.queryByRole('button', { name: /Mover texto com as setas/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Prévia do leitor em formato de livro/)).toBeInTheDocument();
    expect(container.querySelector('[data-scene-illustration]')?.contains(container.querySelector('[data-narrative]'))).toBe(false);
    expect(screen.getByRole('button',{name:'Salvar composição'})).toBeDisabled();
  });
});
