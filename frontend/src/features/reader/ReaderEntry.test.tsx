import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ReaderEntry } from './ReaderEntry';
import { StoryReader } from './StoryReader';
import type { Story } from '../../types/story';
import { readProgress, readReaderSettings, writeReaderSettings } from './logic/readerCore';

let fullscreen: Element | null;
const lock = vi.fn(); const unlock = vi.fn(); const request = vi.fn(); const exit = vi.fn();
function resize(width: number, height: number) {
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
  Object.defineProperty(window,'innerHeight',{configurable:true,value:height});
  act(() => window.dispatchEvent(new Event('resize')));
}
function pointer(coarse = true) {
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches:coarse && (q==='(pointer: coarse)' || q==='(hover: none)'), media:q, addEventListener:vi.fn(),removeEventListener:vi.fn() })));
}
function open(suggestOrientation = true) { return render(<ReaderEntry suggestOrientation={suggestOrientation}><p>Leitor iniciado</p></ReaderEntry>); }

beforeEach(() => {
  localStorage.clear(); fullscreen=null; vi.clearAllMocks(); pointer(); resize(390,844);
  HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');};
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>fullscreen});
  Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:request});
  Object.defineProperty(document,'exitFullscreen',{configurable:true,value:exit});
  Object.defineProperty(window.screen,'orientation',{configurable:true,value:{lock,unlock}});
  request.mockImplementation(async()=>{fullscreen=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));});
  exit.mockImplementation(async()=>{fullscreen=null;document.dispatchEvent(new Event('fullscreenchange'));});
  lock.mockResolvedValue(undefined);
});
afterEach(async()=>{cleanup();await Promise.resolve();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('convite de orientação na entrada do leitor',()=>{
  it('sugere apenas ao iniciar em celular vertical e permite recusar sem chamar APIs',()=>{
    open(); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.queryByText('Leitor iniciado')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Continuar na vertical'}));
    expect(screen.getByText('Leitor iniciado')).toBeInTheDocument(); expect(request).not.toHaveBeenCalled();expect(lock).not.toHaveBeenCalled();
    resize(844,390);resize(390,844);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each([[844,390],[768,1024],[1024,768],[1440,900]])('não sugere em %ix%i', (w,h)=>{
    resize(w,h);open();expect(screen.getByText('Leitor iniciado')).toBeInTheDocument();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('não sugere em janela pequena de desktop nem em acesso direto',()=>{
    pointer(false);const view=open();expect(screen.queryByRole('dialog')).not.toBeInTheDocument();view.unmount();
    pointer();open(false);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('tenta fullscreen e lock, mas aguarda a viewport real para iniciar',async()=>{
    const view=open();fireEvent.click(screen.getByRole('button',{name:'Ler na horizontal'}));
    await waitFor(()=>expect(lock).toHaveBeenCalledWith('landscape'));
    expect(request).toHaveBeenCalledOnce();expect(screen.getByText(/Aguardando a orientação/)).toBeInTheDocument();expect(screen.queryByText('Leitor iniciado')).not.toBeInTheDocument();
    resize(844,390);expect(screen.getByText('Leitor iniciado')).toBeInTheDocument();resize(390,844);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();await waitFor(()=>expect(exit).toHaveBeenCalledOnce());expect(unlock).toHaveBeenCalled();
  });
  it('oferece rotação manual em APIs ausentes ou rejeitadas e nunca prende a leitura',async()=>{
    request.mockRejectedValue(new Error('NotAllowed'));lock.mockRejectedValue(new Error('NotSupported'));
    open();fireEvent.click(screen.getByRole('button',{name:'Ler na horizontal'}));
    await waitFor(()=>expect(lock).toHaveBeenCalled());expect(screen.getByText(/rotação manual/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Continuar na vertical'}));expect(screen.getByText('Leitor iniciado')).toBeInTheDocument();
  });
  it('libera o lock quando o usuário sai do fullscreen pelos controles do sistema',async()=>{
    open();fireEvent.click(screen.getByRole('button',{name:'Ler na horizontal'}));await waitFor(()=>expect(lock).toHaveBeenCalled());
    resize(844,390);act(()=>{fullscreen=null;document.dispatchEvent(new Event('fullscreenchange'));});
    expect(unlock).toHaveBeenCalled();expect(screen.getByText('Leitor iniciado')).toBeInTheDocument();
  });
  it('cancela com Escape e desfaz fullscreen que terminou de abrir após a desistência',async()=>{
    let finish:()=>void=()=>{};
    request.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{fullscreen=document.documentElement;resolve();};}));
    open();fireEvent.click(screen.getByRole('button',{name:'Ler na horizontal'}));
    fireEvent(screen.getByRole('dialog'),new Event('cancel',{cancelable:true}));
    expect(screen.getByText('Leitor iniciado')).toBeInTheDocument();
    await act(async()=>finish());expect(exit).toHaveBeenCalledOnce();expect(lock).not.toHaveBeenCalled();
  });
  it('preserva cena, progresso, configurações e elementos de áudio ao girar o celular',()=>{
    const story: Story={id:'orientation-test',slug:'teste',title:'Teste',description:'',synopsis:'',collectionId:'test',collectionDescription:'',ageRange:'',language:'pt-BR',status:'published',chapters:[{id:'chapter',slug:'capitulo',title:'Um',order:1,pages:[{id:'first',order:1,text:'Primeira cena.',presentation:{textEffect:'none'}},{id:'second',order:2,text:'Segunda cena.',narration:{src:'/test-narration.mp3'},music:{src:'/test-music.mp3',loop:true},presentation:{textEffect:'none'}}]}]};
    vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
    writeReaderSettings({...readReaderSettings(),fontSize:22,contrast:'light'});
    const {container}=render(<MemoryRouter><ReaderEntry suggestOrientation={false}><StoryReader story={story}/></ReaderEntry></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Próxima cena'}));
    const audio=[...container.querySelectorAll('audio')];const progress=readProgress(story);
    resize(844,390);resize(390,844);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','2');expect([...container.querySelectorAll('audio')]).toEqual(audio);
    expect(readProgress(story)).toMatchObject({pageId:progress!.pageId,chapterId:progress!.chapterId,mode:progress!.mode});
    expect(readReaderSettings()).toMatchObject({fontSize:22,contrast:'light'});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
