import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function createAuthClient(): SupabaseClient | null {
  if (!url || !key) return null;
  try { return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }); }
  catch { return null; }
}
export const supabase = createAuthClient();

const recoveryStorageKey = 'jardim-de-papel.admin-password-recovery';
const invalidRecoveryMessage = 'Este link de recuperação é inválido ou expirou. Solicite um novo link para continuar.';

export type AdminIdentity = { id: string; email: string | null; role: 'admin' };
export class AdminAuthError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

function recoveryRedirectUrl() {
  return new URL('/admin/reset-password', window.location.origin).toString();
}

function hasRecoveryProof(subject?: string) {
  if (typeof window === 'undefined') return false;
  const savedSubject = window.sessionStorage.getItem(recoveryStorageKey);
  return subject ? savedSubject === subject : Boolean(savedSubject);
}

function rememberRecoveryProof(subject: string) {
  window.sessionStorage.setItem(recoveryStorageKey, subject);
}

function clearRecoveryProof() {
  window.sessionStorage.removeItem(recoveryStorageKey);
}

export async function requestPasswordRecovery(email: string) {
  if (!supabase) throw new AdminAuthError('A autenticação administrativa não está configurada.');
  // Supabase intentionally does not reveal whether this e-mail has an account.
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirectUrl() });
  if (error) throw new AdminAuthError('Não foi possível preparar a recuperação agora.');
}

export type RecoverySessionResult = { valid: true } | { valid: false; message: string };

/**
 * Completes only a Supabase password-recovery callback. Both PKCE (`?code=`)
 * and the browser implicit-flow fragment are supported because this client
 * deliberately has detectSessionInUrl disabled for the rest of the admin app.
 */
export async function establishRecoverySession(): Promise<RecoverySessionResult> {
  if (!supabase || typeof window === 'undefined') return { valid: false, message: invalidRecoveryMessage };

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const callbackHasError = url.searchParams.has('error') || hash.has('error');
  const code = url.searchParams.get('code');

  try {
    let session = null;
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) return { valid: false, message: invalidRecoveryMessage };
      session = data.session;
    } else if (hash.get('type') === 'recovery') {
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (!accessToken || !refreshToken) return { valid: false, message: invalidRecoveryMessage };
      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error || !data.session) return { valid: false, message: invalidRecoveryMessage };
      session = data.session;
    } else if (hasRecoveryProof()) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }

    if (!session || callbackHasError) return { valid: false, message: invalidRecoveryMessage };
    rememberRecoveryProof(session.user.id);
    // Do not leave recovery credentials or codes in browser history.
    window.history.replaceState({}, document.title, '/admin/reset-password');
    return { valid: true };
  } catch {
    return { valid: false, message: invalidRecoveryMessage };
  }
}

export async function updatePasswordFromRecovery(password: string) {
  if (!supabase || !hasRecoveryProof()) throw new AdminAuthError(invalidRecoveryMessage);
  const { data } = await supabase.auth.getSession();
  if (!data.session || !hasRecoveryProof(data.session.user.id)) throw new AdminAuthError(invalidRecoveryMessage);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new AdminAuthError('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
  clearRecoveryProof();
  await supabase.auth.signOut({ scope: 'local' });
}
export async function fetchAdmin(token: string, signal?: AbortSignal): Promise<AdminIdentity> {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) throw new AdminAuthError('Serviço administrativo não configurado.');
  let response: Response;
  try { response = await fetch(`${base.replace(/\/+$/, '')}/api/v1/admin/me`, { signal, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); }
  catch (error) { if (signal?.aborted) throw error; throw new AdminAuthError('Não foi possível conectar ao serviço administrativo.'); }
  if (!response.ok) throw new AdminAuthError(response.status === 403 ? 'Esta conta não possui acesso administrativo.' : response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível verificar o acesso. Tente novamente.', response.status);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('role' in data) || data.role !== 'admin' || !('id' in data) || typeof data.id !== 'string') throw new AdminAuthError('Resposta administrativa inválida.');
  return data as AdminIdentity;
}
