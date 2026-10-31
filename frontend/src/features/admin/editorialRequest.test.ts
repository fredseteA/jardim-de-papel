import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorialRequest } from './editorial';
import { supabase } from './auth';
type SessionResponse = Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>;
vi.mock('./auth', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

describe('requisições editoriais com prazo limitado', () => {
  beforeEach(() => { vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000'); vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null } as SessionResponse); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
  it('encerra a espera de sessão e não envia gravação atrasada após timeout', async () => {
    vi.useFakeTimers();
    let finishSession: (value: SessionResponse) => void = () => {};
    vi.mocked(supabase!.auth.getSession).mockImplementation(() => new Promise(resolve => { finishSession = resolve; }));
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const result = editorialRequest('/save', { method: 'PATCH' });
    const assertion = expect(result).rejects.toThrow('Não foi possível confirmar');
    await vi.advanceTimersByTimeAsync(30_001); await assertion;
    finishSession({ data: { session: { access_token: 'test-token' } }, error: null } as SessionResponse);
    await Promise.resolve(); await Promise.resolve(); expect(fetch).not.toHaveBeenCalled();
  });
  it('limita inclusive a espera do corpo da resposta', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }), json: () => new Promise(() => {}) }));
    const assertion = expect(editorialRequest('/save')).rejects.toThrow('Não foi possível confirmar');
    await vi.advanceTimersByTimeAsync(30_001); await assertion;
  });
  it('mantém respostas 204 sem parsing e expõe mensagens úteis de conflito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response('{"detail":"Composição desatualizada"}', { status: 409, headers: { 'Content-Type': 'application/json' } })));
    await expect(editorialRequest('/link', { method: 'DELETE' })).resolves.toBeUndefined();
    await expect(editorialRequest('/save')).rejects.toThrow('Composição desatualizada');
  });
  it('não anuncia sucesso quando recebe HTML em vez da confirmação JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Falha do proxy</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    await expect(editorialRequest('/save')).rejects.toThrow('Não foi possível confirmar o salvamento');
  });
});
