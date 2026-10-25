import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoryPage } from '../../pages/StoryPage';
import { StoryOpening } from './StoryOpening';
import { chapeuzinhoVermelho } from '../../data/stories';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../lib/api/services', () => ({ getReading: vi.fn(() => Promise.reject(new Error('História não encontrada.'))) }));

function openStory(path: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path="/historias/:slug" element={path.includes('inexistente') ? <StoryPage /> : <StoryOpening story={chapeuzinhoVermelho} />} /><Route path="/historias/:slug/ler" element={<p>Leitor aberto</p>} /><Route path="/biblioteca" element={<p>Biblioteca</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('abertura da história', () => {
  beforeEach(() => localStorage.clear());

  it('apresenta os dados reais, sinaliza as imagens demonstrativas e permite favoritar', () => {
    openStory('/historias/chapeuzinho-vermelho');
    expect(screen.getByRole('heading', { name: 'Chapeuzinho Vermelho' })).toBeInTheDocument();
    expect(screen.getByText(/^\d+ min$/)).toBeInTheDocument();
    expect(screen.getByText('Imagens de prévia demonstrativas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Começar a aventura' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar aos favoritos' }));
    expect(screen.getByRole('button', { name: 'Remover dos favoritos' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('jardim-de-papel:favorites') ?? '[]')).toContain('story-chapeuzinho-vermelho');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByText('Biblioteca')).toBeInTheDocument();
  });

  it('abre o leitor real quando a história possui cenas', () => {
    openStory('/historias/chapeuzinho-vermelho');
    fireEvent.click(screen.getByRole('button', { name: 'Começar a aventura' }));
    expect(screen.getByText('Leitor aberto')).toBeInTheDocument();
  });

  it('trata histórias desconhecidas sem abrir um leitor inexistente', async () => {
    openStory('/historias/inexistente');
    expect(await screen.findByRole('alert')).toHaveTextContent('História não encontrada.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
