export class EditorialTimeoutError extends Error {
  constructor() {
    super('O serviço demorou para responder. Não foi possível confirmar a operação. Verifique o conteúdo antes de tentar novamente; suas alterações foram mantidas nesta tela.');
    this.name = 'EditorialTimeoutError';
  }
}

/** Bounds session refresh, fetch and response body together, not just fetch. */
export async function withEditorialDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new EditorialTimeoutError()); controller.abort(); }, timeoutMs);
  });
  try { return await Promise.race([operation(controller.signal), deadline]); }
  finally { clearTimeout(timer); }
}
