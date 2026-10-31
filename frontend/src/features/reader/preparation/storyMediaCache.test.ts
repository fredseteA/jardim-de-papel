import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story } from '../../../types/story';
import { collectStoryMedia, prepareStoryMedia, withPreparedMedia } from './storyMediaCache';

export const story: Story = { id:'s', slug:'aventura', title:'Aventura', description:'', synopsis:'', collectionId:'c', collectionDescription:'', ageRange:'', language:'pt-BR', status:'published', coverImage:{desktop:{src:'/cover.webp',alt:'Capa'}}, audio:{backgroundMusic:{src:'/music.mp3',loop:true}}, chapters:[{id:'ch',slug:'ch',title:'Um',order:0,pages:[{id:'p',order:0,text:'Era uma vez.',illustration:{src:'/scene.webp',alt:'Cena'},animation:{src:'/video.mp4',poster:{src:'/poster.webp',alt:'Poster'},loop:true,muted:true},narration:{src:'/voice.mp3'},music:{src:'/music.mp3',loop:true}}]}] };
const fetcher = vi.fn(); const revoke = vi.fn(); const create = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetcher); vi.stubGlobal('caches', undefined);
  fetcher.mockReset().mockImplementation(async () => new Response(new Blob(['image-bytes'],{type:'image/webp'})));
  create.mockReset().mockImplementation(() => `blob:local-${create.mock.calls.length}`); revoke.mockReset();
  vi.stubGlobal('URL', class extends URL { static createObjectURL=create;static revokeObjectURL=revoke; });
});
afterEach(() => {vi.unstubAllGlobals();vi.useRealTimers();});

describe('preparação completa das mídias',()=>{
  it('coleta imagens, vídeo, poster, narração, trilha compartilhada e extras sem duplicar',()=>{
    expect(collectStoryMedia(story,['/effect.ogg','/scene.webp'])).toEqual(['/cover.webp','/music.mp3','/scene.webp','/video.mp4','/poster.webp','/voice.mp3','/effect.ogg']);
  });
  it('aguarda os bytes completos, limita a três downloads e relata progresso real',async()=>{
    const finish: (()=>void)[]=[];
    fetcher.mockImplementation(()=>new Promise<Response>(resolve=>finish.push(()=>resolve(new Response('bytes')))));
    const progress=vi.fn();const result=prepareStoryMedia(['/1','/2','/3','/4'],new AbortController().signal,progress);
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(3));
    expect(create).not.toHaveBeenCalled();finish[0]();
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(4));
    finish.slice(1).forEach(done=>done());
    const media=await result;expect(media.urls.size).toBe(4);expect(progress).toHaveBeenLastCalledWith({loaded:4,total:4});
    media.dispose();expect(revoke).toHaveBeenCalledTimes(4);
  });
  it('reaproveita CacheStorage e não depende de uma segunda transferência no leitor',async()=>{
    const stored=new Map<string,Response>();
    const cache={match:vi.fn(async(url:string)=>stored.get(url)?.clone()),put:vi.fn(async(url:string,response:Response)=>{stored.set(url,response);})};
    vi.stubGlobal('caches',{open:vi.fn(async()=>cache)});
    const first=await prepareStoryMedia(['/scene.webp'],new AbortController().signal,()=>{});first.dispose();
    fetcher.mockRejectedValue(new Error('offline'));
    const second=await prepareStoryMedia(['/scene.webp'],new AbortController().signal,()=>{});
    expect(fetcher).toHaveBeenCalledTimes(1);expect(second.urls.get('/scene.webp')).toMatch(/^blob:/);second.dispose();
  });
  it('funciona em sessão mesmo com CacheStorage bloqueado ou quota excedida',async()=>{
    vi.stubGlobal('caches',{open:vi.fn(async()=>({match:vi.fn(async()=>undefined),put:vi.fn(async()=>{throw new Error('QuotaExceeded');})}))});
    const media=await prepareStoryMedia(['/scene.webp'],new AbortController().signal,()=>{});
    expect(media.urls.size).toBe(1);media.dispose();
    vi.stubGlobal('caches',{open:vi.fn(async()=>{throw new Error('Denied');})});
    const fallback=await prepareStoryMedia(['/voice.mp3'],new AbortController().signal,()=>{});expect(fallback.urls.size).toBe(1);fallback.dispose();
  });
  it('não inicia a história com arquivos ausentes e libera URLs já criadas',async()=>{
    fetcher.mockResolvedValueOnce(new Response('bytes')).mockResolvedValueOnce(new Response('missing',{status:404}));
    await expect(prepareStoryMedia(['/good','/missing'],new AbortController().signal,()=>{})).rejects.toThrow('Um arquivo não chegou');
    expect(revoke).toHaveBeenCalledTimes(1);
  });
  it('recusa respostas HTML vazias ou erros servidos como arquivos',async()=>{
    fetcher.mockResolvedValue(new Response('<html>404</html>',{headers:{'Content-Type':'text/html'}}));
    await expect(prepareStoryMedia(['/bad'],new AbortController().signal,()=>{})).rejects.toThrow('arquivo não chegou');
    expect(create).not.toHaveBeenCalled();
  });
  it('cancela downloads quando o usuário sai e não cria URLs após o cancelamento',async()=>{
    let resolve!: (response:Response)=>void;
    fetcher.mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));
    const controller=new AbortController(); const promise=prepareStoryMedia(['/slow'],controller.signal,()=>{});
    await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());controller.abort();resolve(new Response('bytes'));
    await expect(promise).rejects.toHaveProperty('name','AbortError');expect(create).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('encerra um download que não responde, sem deixar loading infinito',async()=>{
    vi.useFakeTimers();
    fetcher.mockImplementation((_url:string,{signal}:{signal:AbortSignal})=>new Promise<Response>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')))));
    const result=prepareStoryMedia(['/slow'],new AbortController().signal,()=>{});
    const rejected=expect(result).rejects.toThrow('arquivo não chegou');
    await vi.advanceTimersByTimeAsync(120_001);await rejected;
  });
  it('remapeia todos os consumidores sem mudar textos, IDs, metadados ou fonte original',async()=>{
    const media=await prepareStoryMedia(collectStoryMedia(story),new AbortController().signal,()=>{});
    const result=withPreparedMedia(story,media.urls);const page=result.chapters[0].pages[0];
    expect(page.id).toBe('p');expect(page.text).toBe('Era uma vez.');expect(page.illustration?.src).toMatch(/^blob:/);
    expect(page.animation?.src).toMatch(/^blob:/);expect(page.animation?.poster?.src).toMatch(/^blob:/);
    expect(page.narration?.src).toMatch(/^blob:/);expect(page.music?.src).toBe(result.audio?.backgroundMusic?.src);
    expect(story.chapters[0].pages[0].illustration?.src).toBe('/scene.webp');media.dispose();
  });
});
