import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { serviceWorkerSource } from './serviceWorker';

function setup() {
  type FetchEvent = { request: { url: string; method: string; mode: string; headers: Headers }; respondWith: ReturnType<typeof vi.fn> };
  const handlers = new Map<string, (event: FetchEvent) => void>();
  const match = vi.fn(async () => new Response('cached'));
  const network = vi.fn(async () => new Response('online'));
  const remove = vi.fn();
  const store = { open: vi.fn(async () => ({ match, addAll: vi.fn() })), keys: vi.fn(async () => ['jdp-pwa-shell-old','jardim-de-papel:reader-media:v1','other-app']), delete: remove };
  runInNewContext(serviceWorkerSource('new', ['/offline.html','/assets/app.js']), { self: { location: new URL('https://example.test/'), addEventListener: (name: string, handler: (event: FetchEvent) => void) => handlers.set(name, handler), clients: { claim: vi.fn() } }, caches: store, fetch: network, URL });
  function request(path: string, mode='cors', method='GET', authorization=false) {
    const event: FetchEvent = { request:{url:new URL(path,'https://example.test').href,method,mode,headers:new Headers(authorization ? {Authorization:'Bearer test'} : {})},respondWith:vi.fn() };
    handlers.get('fetch')!(event);return event;
  }
  return { handlers, store, match, network, remove, request };
}

describe('PWA mínima e cache isolado', () => {
  it('deixa API, administração, credenciais, mídia e outros domínios fora do cache', () => {
    const worker=setup();
    for(const url of ['/api/v1/stories','/admin/login','/admin/reset-password','/auth/callback','/assets/stories/cena.webp','https://supabase.example.test/auth/v1/token'])expect(worker.request(url).respondWith).not.toHaveBeenCalled();
    expect(worker.request('/assets/app.js','cors','POST').respondWith).not.toHaveBeenCalled();
    expect(worker.request('/assets/app.js','cors','GET',true).respondWith).not.toHaveBeenCalled();
  });
  it('reutiliza apenas os arquivos estáticos declarados',async()=>{
    const worker=setup();const event=worker.request('/assets/app.js');
    expect(await event.respondWith.mock.calls[0][0]).toBeInstanceOf(Response);
    expect(worker.match).toHaveBeenCalled();expect(worker.network).not.toHaveBeenCalled();
  });
  it('usa rede para navegação e oferece página offline sem guardar respostas',async()=>{
    const worker=setup();let event=worker.request('/biblioteca','navigate');
    expect(await (await event.respondWith.mock.calls[0][0]).text()).toBe('online');
    worker.network.mockRejectedValue(new Error('offline'));event=worker.request('/','navigate');
    expect(await (await event.respondWith.mock.calls[0][0]).text()).toBe('cached');
    expect(worker.match).toHaveBeenCalledWith('/offline.html');
  });
  it('não ativa atualizações à força e preserva o cache de histórias',async()=>{
    const worker=setup();const waitUntil=vi.fn();
    worker.handlers.get('activate')!({waitUntil} as never);await waitUntil.mock.calls[0][0];
    expect(worker.remove).toHaveBeenCalledExactlyOnceWith('jdp-pwa-shell-old');
    expect(serviceWorkerSource('new',[])).not.toContain('skipWaiting');
  });
  it('declara ícones PNG reais e tamanhos corretos, incluindo iOS e máscara',()=>{
    const root=resolve(import.meta.dirname,'../public');
    const manifest=JSON.parse(readFileSync(resolve(root,'manifest.webmanifest'),'utf8')) as {display:string;start_url:string;icons:{src:string;sizes:string;purpose:string}[]};
    expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('/');
    expect(manifest.icons.some(icon=>icon.purpose==='maskable')).toBe(true);
    for(const icon of manifest.icons){const bytes=readFileSync(resolve(root,icon.src.slice(1)));expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);}
    expect(existsSync(resolve(root,'pwa/apple-touch-icon.png'))).toBe(true);
  });
});
