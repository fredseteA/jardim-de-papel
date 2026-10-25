import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient, queryKeys } from './queryClient';
import { useApi } from './useApi';

const params = (limit: string, q = '') => new URLSearchParams({ limit, offset: '0', ...(q ? { q } : {}) });

describe('cache compartilhado da API', () => {
  it('deduplica consultas simultâneas, reutiliza dados e separa parâmetros', async () => {
    const client = createQueryClient();
    const fetcher = vi.fn().mockResolvedValue({ items: ['história'] });
    const key = queryKeys.stories(params('18'));
    const [one, two] = await Promise.all([client.fetchQuery({ queryKey: key, queryFn: fetcher }), client.fetchQuery({ queryKey: key, queryFn: fetcher })]);
    expect(one).toEqual(two);
    await client.fetchQuery({ queryKey: key, queryFn: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await client.fetchQuery({ queryKey: queryKeys.stories(params('20')), queryFn: fetcher });
    await client.fetchQuery({ queryKey: queryKeys.stories(params('18', 'chapeusinho')), queryFn: fetcher });
    expect(fetcher).toHaveBeenCalledTimes(3);
    client.clear();
  });

  it('mantém dados visíveis em atualização e após falha; invalidação atualiza', async () => {
    const client = createQueryClient();
    const key = queryKeys.reading('chapeuzinho');
    const load = vi.fn().mockResolvedValueOnce('cena original');
    function View() {
      const result = useApi<string>(load, key);
      if (!result.data) return <p>{result.loading ? 'carregando' : result.error}</p>;
      return <p>{result.data}{result.error && ' — atualização falhou'}</p>;
    }
    render(<QueryClientProvider client={client}><View /></QueryClientProvider>);
    expect(await screen.findByText('cena original')).toBeInTheDocument();
    let resolve!: (value: string) => void;
    load.mockImplementationOnce(() => new Promise<string>(done => { resolve = done; }));
    void act(() => { void client.invalidateQueries({ queryKey: key }); });
    expect(screen.getByText('cena original')).toBeInTheDocument();
    await act(async () => { resolve('cena atualizada'); });
    expect(await screen.findByText('cena atualizada')).toBeInTheDocument();
    load.mockRejectedValue(new Error('offline'));
    await act(async () => { await client.invalidateQueries({ queryKey: key }); });
    await waitFor(() => expect(screen.getByText('cena atualizada — atualização falhou')).toBeInTheDocument());
    client.clear();
  });

  it('retém leitura após desmontar e permite cancelamento', async () => {
    const client = createQueryClient();
    const key = queryKeys.reading('chapeuzinho');
    const load = vi.fn().mockResolvedValue('20 cenas');
    const View = () => { const result = useApi<string>(load, key); return <p>{result.data ?? 'carregando'}</p>; };
    const first = render(<QueryClientProvider client={client}><View /></QueryClientProvider>);
    expect(await screen.findByText('20 cenas')).toBeInTheDocument();
    first.unmount();
    render(<QueryClientProvider client={client}><View /></QueryClientProvider>);
    expect(screen.getByText('20 cenas')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    let aborted = false;
    const pending = client.fetchQuery({ queryKey: ['cancel-test'], queryFn: ({ signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelada')); })) }).catch(() => undefined);
    await client.cancelQueries({ queryKey: ['cancel-test'] });
    await pending;
    expect(aborted).toBe(true);
    client.clear();
  });
});

