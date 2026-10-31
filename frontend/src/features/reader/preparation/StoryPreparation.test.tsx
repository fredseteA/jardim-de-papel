import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryPreparation } from './StoryPreparation';
import { prepareStoryMedia } from './storyMediaCache';
import type { PreparedMedia } from './storyMediaCache';
import type { Story } from '../../../types/story';
import { StoryReader } from '../StoryReader';

vi.mock('./storyMediaCache',async importOriginal=>({...await importOriginal<typeof import('./storyMediaCache')>(),prepareStoryMedia:vi.fn()}));
const story:Story={id:'prep',slug:'aventura',title:'Uma aventura',synopsis:'',description:'',collectionId:'',collectionDescription:'',ageRange:'',language:'pt-BR',status:'published',chapters:[{id:'ch',slug:'ch',title:'Capítulo',order:0,pages:[{id:'p',order:0,text:'Uma cena.',illustration:{src:'/scene.webp',alt:'Cena'},presentation:{textEffect:'none'}}]}]};
const dispose=vi.fn();
const media=():PreparedMedia=>({urls:new Map([['/scene.webp','blob:prepared-scene']]),dispose});
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('entrada com preparação da aventura',()=>{
  it('não monta o leitor nem grava progresso antes de concluir os arquivos',async()=>{
    let finish!:(value:PreparedMedia)=>void;
    vi.mocked(prepareStoryMedia).mockImplementation((_sources,_signal,progress)=>{progress({loaded:0,total:1});return new Promise(resolve=>{finish=resolve;});});
    const result=render(<MemoryRouter><StoryPreparation story={story} onBack={()=>{}}>{prepared=><StoryReader story={prepared}/>}</StoryPreparation></MemoryRouter>);
    expect(screen.getByRole('heading',{name:'Estamos preparando sua aventura!'})).toBeInTheDocument();
    expect(screen.queryByRole('region',{name:'Página ilustrada da história'})).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    await act(async()=>finish(media()));
    expect(await screen.findByAltText('Cena')).toHaveAttribute('src','blob:prepared-scene');
    expect(screen.getByRole('region',{name:'Página ilustrada da história'})).toBeInTheDocument();
    result.unmount();expect(dispose).toHaveBeenCalledOnce();
  });
  it('mostra falha real, permite tentar de novo e não inicia com mídia ausente',async()=>{
    vi.mocked(prepareStoryMedia).mockRejectedValueOnce(new Error('Falha de conexão.')).mockResolvedValueOnce(media());
    render(<StoryPreparation story={story} onBack={()=>{}}>{()=> <p>Leitura iniciada</p>}</StoryPreparation>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão.');expect(screen.queryByText('Leitura iniciada')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));expect(await screen.findByText('Leitura iniciada')).toBeInTheDocument();
    expect(prepareStoryMedia).toHaveBeenCalledTimes(2);
  });
  it('voltar permanece disponível e o cancelamento impede montar a história tarde',async()=>{
    let finish!:(value:PreparedMedia)=>void;let signal!:AbortSignal;
    vi.mocked(prepareStoryMedia).mockImplementation((_sources,value)=>{signal=value;return new Promise(resolve=>{finish=resolve;});});
    const back=vi.fn();const result=render(<StoryPreparation story={story} onBack={back}>{()=> <p>Leitura iniciada</p>}</StoryPreparation>);
    fireEvent.click(screen.getByRole('button',{name:'Voltar à capa'}));expect(back).toHaveBeenCalledOnce();result.unmount();expect(signal.aborted).toBe(true);
    await act(async()=>finish(media()));expect(dispose).toHaveBeenCalledOnce();
  });
  it('rotação e novas referências ao mesmo manifesto não reiniciam os downloads',async()=>{
    vi.mocked(prepareStoryMedia).mockResolvedValue(media());
    const view=(value:Story)=><StoryPreparation story={value} onBack={()=>{}}>{()=> <p>Leitura iniciada</p>}</StoryPreparation>;
    const result=render(view(story));await screen.findByText('Leitura iniciada');
    result.rerender(view({...story}));fireEvent(window,new Event('resize'));
    await waitFor(()=>expect(prepareStoryMedia).toHaveBeenCalledOnce());expect(screen.getByText('Leitura iniciada')).toBeInTheDocument();
  });
});
