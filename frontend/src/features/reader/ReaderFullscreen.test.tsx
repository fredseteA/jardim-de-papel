import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { ReaderEntry } from './ReaderEntry';
import { StoryReader } from './StoryReader';
import { readProgress } from './logic/readerCore';
import type { Story } from '../../types/story';

const story:Story={id:'fullscreen-story',slug:'fullscreen',title:'Uma aventura',description:'',synopsis:'',collectionId:'test',collectionDescription:'',ageRange:'',language:'pt-BR',status:'published',chapters:[{id:'chapter',slug:'um',title:'Um capítulo',order:1,pages:[{id:'first',order:1,text:'Primeira cena.',presentation:{textEffect:'none'}},{id:'second',order:2,text:'Segunda cena.',presentation:{textEffect:'none'},narration:{src:'/test.mp3'},music:{src:'/music.mp3',loop:true}}]}]};
let fullscreen:Element|null;
const request=vi.fn(),exit=vi.fn(),lock=vi.fn(),unlock=vi.fn();
function open(){return render(<MemoryRouter><ReaderEntry suggestOrientation={false}><StoryReader story={story}/></ReaderEntry></MemoryRouter>);}
beforeEach(()=>{
  localStorage.clear();vi.clearAllMocks();fullscreen=null;
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>fullscreen});
  Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:true});
  Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:request});
  Object.defineProperty(document,'exitFullscreen',{configurable:true,value:exit});
  Object.defineProperty(window.screen,'orientation',{configurable:true,value:{lock,unlock}});
  request.mockImplementation(async()=>{fullscreen=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));});
  exit.mockImplementation(async()=>{fullscreen=null;document.dispatchEvent(new Event('fullscreenchange'));});
});
afterEach(async()=>{cleanup();await Promise.resolve();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('controle de tela cheia independente',()=>{
  it('entra e sai sem mudar a cena nem substituir áudio e mantém o olho separado',async()=>{
    const{container}=open();fireEvent.click(screen.getByRole('button',{name:'Próxima cena'}));
    const audio=[...container.querySelectorAll('audio')];fireEvent.play(audio[0]);fireEvent.play(audio[1]);
    const pauseCalls=vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
    fireEvent.click(screen.getByRole('button',{name:'Entrar em tela cheia'}));
    expect(await screen.findByRole('button',{name:'Sair da tela cheia'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','2');
    expect(container.querySelectorAll('audio')[0]).toBe(audio[0]);expect(container.querySelectorAll('audio')[1]).toBe(audio[1]);
    expect(screen.getByRole('button',{name:'Pausar narração desta cena'})).toBeInTheDocument();
    expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length).toBe(pauseCalls);
    fireEvent.click(screen.getByRole('button',{name:'Recolher controles'}));
    expect(screen.getByRole('button',{name:'Mostrar controles'})).toBeInTheDocument();expect(fullscreen).toBe(document.documentElement);
    fireEvent.click(screen.getByRole('button',{name:'Sair da tela cheia'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Entrar em tela cheia'})).toBeEnabled());
    expect(exit).toHaveBeenCalledOnce();expect(lock).not.toHaveBeenCalled();expect(readProgress(story)?.pageId).toBe('second');
  });
  it('sincroniza o botão quando o sistema sai de fullscreen',async()=>{
    open();fireEvent.click(screen.getByRole('button',{name:'Entrar em tela cheia'}));await screen.findByRole('button',{name:'Sair da tela cheia'});
    act(()=>{fullscreen=null;document.dispatchEvent(new Event('fullscreenchange'));});
    expect(screen.getByRole('button',{name:'Entrar em tela cheia'})).toHaveAttribute('aria-pressed','false');
  });
  it.each(['ausente','rejeitada','sem confirmação'])('não simula fullscreen quando a API é %s',async failure=>{
    if(failure==='ausente')Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:undefined});
    else if(failure==='rejeitada')request.mockRejectedValue(new Error('NotAllowedError'));
    else request.mockResolvedValue(undefined);
    open();fireEvent.click(screen.getByRole('button',{name:'Entrar em tela cheia'}));
    expect(await screen.findByRole('status')).toHaveTextContent('O navegador não permitiu alterar a tela cheia');
    expect(screen.getByRole('button',{name:'Entrar em tela cheia'})).toBeEnabled();
    expect(screen.queryByRole('button',{name:'Sair da tela cheia'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Recolher controles'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Fechar aviso de tela cheia'}));expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('bloqueia solicitações simultâneas e limpa fullscreen que chega após sair da rota',async()=>{
    let finish:()=>void=()=>{};
    request.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{fullscreen=document.documentElement;resolve();};}));
    const view=open();const button=screen.getByRole('button',{name:'Entrar em tela cheia'});fireEvent.click(button);fireEvent.click(button);
    expect(request).toHaveBeenCalledOnce();expect(button).toBeDisabled();
    view.unmount();await act(async()=>finish());expect(exit).toHaveBeenCalledOnce();expect(fullscreen).toBeNull();
  });
  it('compartilha a tela cheia iniciada pelo convite de orientação, sem uma segunda solicitação',async()=>{
    const width=vi.spyOn(window,'innerWidth','get').mockReturnValue(390),height=vi.spyOn(window,'innerHeight','get').mockReturnValue(844);
    vi.stubGlobal('matchMedia',(q:string)=>({matches:q==='(pointer: coarse)'||q==='(hover: none)',addEventListener:()=>{},removeEventListener:()=>{}}));
    HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    lock.mockResolvedValue(undefined);
    render(<MemoryRouter><ReaderEntry suggestOrientation><StoryReader story={story}/></ReaderEntry></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Ler na horizontal'}));await waitFor(()=>expect(lock).toHaveBeenCalledWith('landscape'));
    act(()=>{width.mockReturnValue(844);height.mockReturnValue(390);window.dispatchEvent(new Event('resize'));});
    expect(screen.getByRole('button',{name:'Sair da tela cheia'})).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByRole('button',{name:'Sair da tela cheia'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Entrar em tela cheia'})).toBeEnabled());
    expect(request).toHaveBeenCalledOnce();expect(exit).toHaveBeenCalledOnce();expect(unlock).toHaveBeenCalled();
  });
});
