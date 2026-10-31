import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminProvider } from './AdminProvider';
import { useAdmin } from './AdminContext';
import type { Session } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), callback: null as ((event: string, session: unknown) => void) | null }));
vi.mock('./auth', () => ({
  AdminAuthError: class extends Error {},
  fetchAdmin: mocks.verify,
  supabase: { auth: {
    onAuthStateChange: (callback: (event: string, session: unknown) => void) => { mocks.callback = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    signInWithPassword: mocks.signIn,
    signOut: mocks.signOut,
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  } },
}));

function Probe() { const { loading, identity, error, signOut } = useAdmin(); return <><p>{loading ? 'verificando' : identity?.email ?? 'sem acesso'}</p>{error && <p role="alert">{error}</p>}<button onClick={() => void signOut()}>Sair</button></>; }
const session = { access_token: 'token' } as Session;

describe('sessão administrativa', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.callback = null; });
  it('restaura sessão somente depois da autorização e limpa no logout', async () => {
    mocks.verify.mockResolvedValue({ id: 'id', email: 'admin@example.invalid', role: 'admin' }); mocks.signOut.mockResolvedValue({ error: null });
    render(<AdminProvider><Probe /></AdminProvider>);
    await act(async () => { mocks.callback?.('INITIAL_SESSION', session); });
    expect(await screen.findByText('admin@example.invalid')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sair'));
    expect(await screen.findByText('sem acesso')).toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('mantém acesso bloqueado quando a verificação falha', async () => {
    mocks.verify.mockRejectedValue(new Error('Sua sessão expirou.'));
    render(<AdminProvider><Probe /></AdminProvider>);
    await act(async () => { mocks.callback?.('TOKEN_REFRESHED', session); });
    expect(screen.getByText('sem acesso')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('expirou');
  });
});
