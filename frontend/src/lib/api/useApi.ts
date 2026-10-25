import { useQuery, type QueryKey } from '@tanstack/react-query';

export function useApi<T>(load: (signal: AbortSignal) => Promise<T>, key: QueryKey, enabled = true) {
  const result = useQuery({ queryKey: key, queryFn: ({ signal }) => load(signal), enabled });
  return {
    data: result.data,
    error: result.error instanceof Error ? result.error.message : result.error ? 'Erro inesperado.' : undefined,
    loading: result.isPending && enabled,
    fetching: result.isFetching,
    retry: () => { void result.refetch(); },
  };
}
