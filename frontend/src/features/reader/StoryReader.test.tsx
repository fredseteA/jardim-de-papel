import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story } from '../../types/story';
import { readProgress } from './logic/readerCore';
import { StoryReader } from './StoryReader';

const story: Story = {
  id: 'story-reader-test',
  slug: 'uma-aventura',
  title: 'Uma aventura',
  description: 'Um conto de teste.',
  synopsis: 'Uma pequena história de teste.',
  collectionId: 'test',
  collectionDescription: 'Testes',
  ageRange: '',
  language: 'pt-BR',
  status: 'published',
  chapters: [
    {
      id: 'start', slug: 'comeco', title: 'O começo', order: 1,
      pages: [
        { id: 'first', order: 1, text: 'Uma manhã começou no jardim.', readingSeconds: 1, presentation: { textEffect: 'words' } },
        { id: 'second', order: 2, text: 'A jornada continuou pela trilha.', readingSeconds: 1, presentation: { textEffect: 'none' } },
      ],
    },
    {
      id: 'end', slug: 'final', title: 'Um encontro', order: 2,
      pages: [{ id: 'last', order: 1, text: 'E chegaram em segurança.', readingSeconds: 1, presentation: { textEffect: 'none' } }],
    },
  ],
};

function openReader() {
  return render(
    <MemoryRouter initialEntries={['/historias/uma-aventura/ler']}>
      <Routes>
        <Route path="/historias/:slug/ler" element={<StoryReader story={story} />} />
        <Route path="/historias/:slug" element={<p>Apresentação da história</p>} />
        <Route path="/biblioteca" element={<p>Biblioteca de histórias</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function progress() {
  return screen.getByRole('progressbar', { name: 'Progresso da história' });
}

function tick(milliseconds: number) {
  act(() => { vi.advanceTimersByTime(milliseconds); });
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StoryReader', () => {
  it('revela o texto antes de avançar, transita de capítulo e permite concluir e reler', () => {
    openReader();
    expect(progress()).toHaveAttribute('aria-valuenow', '1');
    expect(screen.queryByRole('button', { name: 'Mostrar todo o texto' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(story.chapters[0].pages[0].text)).toHaveAttribute('data-revealed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Próxima cena' }));
    expect(screen.queryByRole('button', { name: 'Mostrar todo o texto' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(story.chapters[0].pages[0].text)).toHaveAttribute('data-revealed', 'true');
    expect(progress()).toHaveAttribute('aria-valuenow', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima cena' }));
    expect(progress()).toHaveAttribute('aria-valuenow', '2');

    fireEvent.click(screen.getByRole('button', { name: 'Próxima cena' }));
    const transition = screen.getByRole('dialog', { name: 'Um encontro' });
    expect(within(transition).getByText('Próximo capítulo')).toBeInTheDocument();
    expect(progress()).toHaveAttribute('aria-valuenow', '2');
    fireEvent.click(within(transition).getByRole('button', { name: 'Continuar a história' }));
    expect(progress()).toHaveAttribute('aria-valuenow', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Concluir história' }));
    const conclusion = screen.getByRole('dialog', { name: 'E assim termina esta aventura.' });
    expect(within(conclusion).getByText('História concluída')).toBeInTheDocument();
    expect(readProgress(story)).toMatchObject({ pageId: 'last', completed: true, percentage: 100 });
    fireEvent.click(within(conclusion).getByRole('button', { name: 'Ler novamente' }));
    expect(progress()).toHaveAttribute('aria-valuenow', '1');
    expect(readProgress(story)).toMatchObject({ pageId: 'first', completed: false });
  });

  it('permite selecionar capítulos e retoma a cena salva após remontagem', () => {
    const firstMount = openReader();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir capítulos' }));
    const chapters = screen.getByRole('dialog', { name: 'Capítulos' });
    fireEvent.click(within(chapters).getByRole('button', { name: /Um encontro/ }));
    expect(progress()).toHaveAttribute('aria-valuenow', '3');
    expect(readProgress(story)).toMatchObject({ chapterId: 'end', pageId: 'last', completed: false });

    firstMount.unmount();
    openReader();
    expect(progress()).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByRole('button', { name: 'Concluir história' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cena anterior' }));
    expect(progress()).toHaveAttribute('aria-valuenow', '2');
  });

  it('preserva a posição ao alternar os modos e salva a preferência de apresentação', () => {
    const firstMount = openReader();
    fireEvent.click(screen.getByLabelText(story.chapters[0].pages[0].text));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima cena' }));
    expect(progress()).toHaveAttribute('aria-valuenow', '2');

    fireEvent.click(screen.getByRole('button', { name: 'Mudar para leitura tradicional' }));
    expect(screen.getByRole('region', { name: 'Texto da história' })).toBeInTheDocument();
    expect(progress()).toHaveAttribute('aria-valuenow', '2');
    expect(readProgress(story)).toMatchObject({ pageId: 'second', mode: 'traditional' });

    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de leitura' }));
    const settings = screen.getByRole('dialog', { name: 'Ajustes de leitura' });
    fireEvent.change(within(settings).getByLabelText('Tema'), { target: { value: 'sepia' } });
    fireEvent.click(within(settings).getByRole('button', { name: 'Fechar' }));
    expect(screen.getByRole('region', { name: 'Texto da história' })).toHaveAttribute('data-theme', 'sepia');

    firstMount.unmount();
    openReader();
    expect(screen.getByRole('region', { name: 'Texto da história' })).toHaveAttribute('data-theme', 'sepia');
    expect(progress()).toHaveAttribute('aria-valuenow', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Mudar para leitura imersiva' }));
    expect(progress()).toHaveAttribute('aria-valuenow', '2');
    expect(readProgress(story)).toMatchObject({ pageId: 'second', mode: 'immersive' });
  });

  it('revela o texto ao tocar e recolhe e restaura os controles', () => {
    openReader();
    fireEvent.click(screen.getByLabelText('Uma manhã começou no jardim.'));
    expect(screen.queryByRole('button', { name: 'Mostrar todo o texto' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher controles' }));
    expect(screen.getByRole('button', { name: 'Mostrar controles' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar controles' }));
    expect(screen.getByRole('button', { name: 'Próxima cena' })).toBeInTheDocument();
  });

  it('persiste contraste e movimento entre visitas', () => {
    const view = openReader();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de leitura' }));
    fireEvent.change(screen.getByLabelText('Contraste do texto'), { target: { value: 'light' } });
    fireEvent.click(screen.getByLabelText('Reduzir movimentos'));
    fireEvent.change(screen.getByRole('slider', { name: /Tamanho do texto/ }), { target: { value: '24' } });
    view.unmount();
    openReader();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de leitura' }));
    expect(screen.getByLabelText('Contraste do texto')).toHaveValue('light');
    expect(screen.getByLabelText('Reduzir movimentos')).toBeChecked();
    expect(screen.getByRole('slider', { name: /Tamanho do texto/ })).toHaveValue('24');
  });

  it('avança exclusivamente por ação manual, inclusive entre capítulos e no encerramento', () => {
    vi.useFakeTimers(); openReader();
    expect(screen.queryByRole('button', { name: /avanço automático/ })).not.toBeInTheDocument();
    tick(20_000); expect(progress()).toHaveAttribute('aria-valuenow','1');
    fireEvent.click(screen.getByRole('button',{name:'Próxima cena'}));
    expect(progress()).toHaveAttribute('aria-valuenow','2');
    tick(20_000); expect(progress()).toHaveAttribute('aria-valuenow','2');
    fireEvent.click(screen.getByRole('button',{name:'Próxima cena'}));
    const transition=screen.getByRole('dialog',{name:'Um encontro'});
    tick(20_000);expect(progress()).toHaveAttribute('aria-valuenow','2');
    fireEvent.click(within(transition).getByRole('button',{name:'Continuar a história'}));
    tick(20_000);expect(progress()).toHaveAttribute('aria-valuenow','3');
    expect(screen.queryByRole('dialog',{name:'E assim termina esta aventura.'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Concluir história'}));
    expect(screen.getByRole('dialog',{name:'E assim termina esta aventura.'})).toBeInTheDocument();
  });
  it('mantém a cena ao ocultar a aba e retornar, sem temporizador de navegação', () => {
    vi.useFakeTimers(); const visibility=vi.spyOn(document,'hidden','get').mockReturnValue(false);
    openReader();tick(2000);
    visibility.mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));tick(20_000);
    visibility.mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));tick(20_000);
    expect(progress()).toHaveAttribute('aria-valuenow','1');
  });
});
