import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoryPage } from '../../pages/StoryPage';

function openStory(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/historias/:slug" element={<StoryPage />} /><Route path="/historias/:slug/ler" element={<p>Leitor aberto</p>} /><Route path="/biblioteca" element={<p>Biblioteca</p>} /></Routes></MemoryRouter>);
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

  it('trata histórias desconhecidas sem abrir um leitor inexistente', () => {
    openStory('/historias/inexistente');
    expect(screen.getByRole('heading', { name: 'História indisponível' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar à biblioteca' })).toHaveAttribute('href', '/biblioteca');
  });
});
