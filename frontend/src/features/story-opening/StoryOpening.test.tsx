import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoryPage } from '../../pages/StoryPage';
import { StoryOpening } from './StoryOpening';
import { chapeuzinhoVermelho } from '../../data/stories';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReaderEntry } from '../reader/ReaderEntry';

vi.mock('../../lib/api/services', () => ({ getReading: vi.fn(() => Promise.reject(new Error('História não encontrada.'))) }));

function openStory(path: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path="/historias/:slug" element={path.includes('inexistente') ? <StoryPage /> : <StoryOpening story={chapeuzinhoVermelho} />} /><Route path="/historias/:slug/ler" element={<ReadingLaunch />} /><Route path="/biblioteca" element={<p>Biblioteca</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

function ReadingLaunch() {
  const location = useLocation();
  return <ReaderEntry suggestOrientation={location.state?.suggestOrientation === true}><p>Leitor aberto</p></ReaderEntry>;
}

describe('abertura da história', () => {
  beforeEach(() => localStorage.clear());
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

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
  it('o CTA da capa oferece orientação antes de abrir a leitura em celular vertical',()=>{
    vi.spyOn(window,'innerWidth','get').mockReturnValue(390);vi.spyOn(window,'innerHeight','get').mockReturnValue(844);
    vi.stubGlobal('matchMedia',(query:string)=>({matches:query==='(pointer: coarse)'||query==='(hover: none)',addEventListener:()=>{},removeEventListener:()=>{}}));
    HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    openStory('/historias/chapeuzinho-vermelho');fireEvent.click(screen.getByRole('button',{name:'Começar a aventura'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();expect(screen.queryByText('Leitor aberto')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Continuar na vertical'}));expect(screen.getByText('Leitor aberto')).toBeInTheDocument();
  });
});
