import type { SearchCategoryId } from './types';

/** Single translation layer for editorial tags used by current mock/presentation data. */
export const categoryIdByTag: Record<string, Exclude<SearchCategoryId, 'todos'>> = {
  'Contos Encantados': 'contos-classicos', 'Contos Clássicos': 'contos-classicos', 'Fábulas': 'fabulas', 'Histórias da Fé': 'fe', 'Fé': 'fe', 'Fantasia': 'fantasia', 'Mundos de Fantasia': 'fantasia', 'Nárnia': 'narnia',
};

