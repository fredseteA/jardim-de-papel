import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AdminContext } from './AdminContext';
import { AdminAuthError, fetchAdmin, supabase, type AdminIdentity } from './auth';

export function AdminProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const verify = useCallback(async (session: Session | null) => {
    const current = ++sequence.current;
    setIdentity(null);
    if (!session) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { const admin = await fetchAdmin(session.access_token); if (current === sequence.current) setIdentity(admin); }
    catch (e) { if (current === sequence.current) setError(e instanceof Error ? e.message : 'Não foi possível verificar o acesso.'); }
    finally { if (current === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!supabase) { setError('A autenticação administrativa não está configurada.'); setLoading(false); return; }
    const sequenceRef = sequence;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { void verify(session); });
    return () => { ++sequenceRef.current; data.subscription.unsubscribe(); };
  }, [verify]);
  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new AdminAuthError('A autenticação administrativa não está configurada.');
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw new AdminAuthError(authError.status === 400 || authError.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Verifique sua conexão e tente novamente.');
  };
  const signOut = async () => {
    ++sequence.current; setIdentity(null); setError(null); setLoading(false);
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
  };
  const retry = () => { if (supabase) void supabase.auth.getSession().then(({ data }) => verify(data.session)); };
  return <AdminContext.Provider value={{ loading, identity, error, signIn, signOut, retry }}>{children}</AdminContext.Provider>;
}
