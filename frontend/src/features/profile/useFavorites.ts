import { useCallback, useState } from 'react';

const FAVORITES_KEY = 'jardim-de-papel:favorites';

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readFavorites);
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* Remains available for this session. */ }
      return next;
    });
  }, []);
  return { favoriteIds, toggleFavorite };
}
