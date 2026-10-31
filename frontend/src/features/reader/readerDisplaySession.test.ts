import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReaderDisplaySession } from './readerDisplaySession';

let element:Element|null;
const request=vi.fn(),exit=vi.fn(),lock=vi.fn(),unlock=vi.fn();
let sessions:Array<ReturnType<typeof createReaderDisplaySession>>;
const create=()=>{const session=createReaderDisplaySession(document,{lock,unlock});sessions.push(session);return session;};
beforeEach(()=>{
  vi.clearAllMocks();element=null;sessions=[];
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>element});
  Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:request});
  Object.defineProperty(document,'exitFullscreen',{configurable:true,value:exit});
  request.mockImplementation(async()=>{element=document.documentElement;});exit.mockImplementation(async()=>{element=null;});lock.mockResolvedValue(undefined);
});
afterEach(async()=>{await Promise.all(sessions.map(s=>s.release()));});

describe('posse de fullscreen e orientação do leitor',()=>{
  it('não encerra fullscreen que já existia antes da leitura',async()=>{
    element=document.documentElement;const session=create();await session.requestLandscape();await session.release();
    expect(request).not.toHaveBeenCalled();expect(exit).not.toHaveBeenCalled();expect(unlock).toHaveBeenCalled();
  });
  it('funciona quando nenhuma API está disponível',async()=>{
    Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:undefined});
    const session=createReaderDisplaySession(document,{});sessions.push(session);
    await expect(session.requestLandscape()).resolves.toBeUndefined();await session.release();expect(exit).not.toHaveBeenCalled();
  });
  it('libera lock que terminou de ser aplicado depois de sair do leitor',async()=>{
    let finish:()=>void=()=>{};lock.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
    const session=create();const pending=session.requestLandscape();await Promise.resolve();
    await session.release();finish();await pending;expect(unlock.mock.calls.length).toBeGreaterThanOrEqual(2);expect(exit).toHaveBeenCalledOnce();
  });
  it('não deixa uma requisição antiga interferir em uma nova entrada',async()=>{
    let finish:()=>void=()=>{};request.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=()=>{element=document.documentElement;resolve();};}));
    const old=create();const pending=old.requestLandscape();await old.release();
    const next=create();await next.requestLandscape();expect(request).toHaveBeenCalledOnce();
    finish();await pending;expect(element).toBeNull();expect(lock).not.toHaveBeenCalled();
  });
});
