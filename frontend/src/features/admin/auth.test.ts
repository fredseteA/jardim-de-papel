import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAdmin } from './auth';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('verificação administrativa no servidor', () => {
  it('envia bearer e aceita apenas identidade autorizada', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.invalid');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '123', email: null, role: 'admin' }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchAdmin('test-token')).role).toBe('admin');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });
  it('rejeita sessão expirada e usuário sem permissão', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.invalid');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 403 })));
    await expect(fetchAdmin('expired')).rejects.toMatchObject({ status: 401 });
    await expect(fetchAdmin('reader')).rejects.toMatchObject({ status: 403 });
  });
});
