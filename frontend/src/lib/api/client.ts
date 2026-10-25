export class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } }
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) throw new ApiError('Configure VITE_API_BASE_URL para conectar ao Jardim de Papel.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new ApiError(response.status === 404 ? 'Conteúdo não encontrado.' : 'Não foi possível carregar o conteúdo.', response.status);
    return await response.json() as T;
  } catch (error) {
    if (timedOut) throw new ApiError('A conexão demorou demais. Tente novamente.');
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError('Não foi possível conectar ao serviço. Tente novamente.');
  } finally { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
