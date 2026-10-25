import { chapeuzinhoVermelho } from './stories';
import { getEstimatedReadingMinutes } from '../lib/readingTime';

export type DiscoverStoryBook = {
  id: string;
  title: string;
  category: string;
  cover: string;
  coverPosition?: string;
  href?: string;
  estimatedMinutes?: number;
  isComingSoon?: boolean;
};

/** Mistura a história publicada com prévias de apresentação, que não entram no repositório editorial. */
export const discoverStoryBooks: readonly DiscoverStoryBook[] = [
  { id: chapeuzinhoVermelho.id, title: chapeuzinhoVermelho.title, category: chapeuzinhoVermelho.collectionDescription, cover: chapeuzinhoVermelho.coverImage?.mobile?.src ?? chapeuzinhoVermelho.coverImage?.desktop.src ?? '', coverPosition: '60% center', href: `/historias/${chapeuzinhoVermelho.slug}`, estimatedMinutes: getEstimatedReadingMinutes(chapeuzinhoVermelho) },
  { id: 'preview-lia-rio-estrelas', title: 'As Aventuras de Lia e o Rio de Estrelas', category: 'Fantasia', cover: '/assets/stories/previews/lia-rio-estrelas.webp', isComingSoon: true },
  { id: 'preview-pequeno-carvalho', title: 'O Pequeno Carvalho', category: 'Fábulas', cover: '/assets/stories/previews/pequeno-carvalho.webp', isComingSoon: true },
  { id: 'preview-farol-dos-sonhos', title: 'O Farol dos Sonhos', category: 'Mundos de Fantasia', cover: '/assets/stories/previews/farol-dos-sonhos.webp', isComingSoon: true },
];
