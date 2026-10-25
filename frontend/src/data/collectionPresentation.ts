export type CollectionPresentation = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
};

/** Metadados de apresentação da Home; não representam histórias publicadas. */
export const collectionPresentations: readonly CollectionPresentation[] = [
  { id: 'narnia', slug: 'narnia', title: 'Nárnia', description: 'Descubra um mundo de magia, coragem e aventuras.', image: '/assets/collections/narnia-collection.png' },
  { id: 'historias-da-fe', slug: 'historias-da-fe', title: 'Histórias da Fé', description: 'Valores que inspiram e iluminam o coração das crianças.', image: '/assets/collections/historias-da-fe.webp' },
  { id: 'fabulas', slug: 'fabulas', title: 'Fábulas', description: 'Pequenos animais, grandes lições.', image: '/assets/collections/fabulas.webp' },
  { id: 'contos-classicos', slug: 'contos-classicos', title: 'Contos Clássicos', description: 'Clássicos que atravessam gerações.', image: '/assets/collections/contos-encantados.webp' },
  { id: 'mundos-de-fantasia', slug: 'mundos-de-fantasia', title: 'Mundos de Fantasia', description: 'Universos incríveis para explorar.', image: '/assets/collections/mundos-de-fantasia.webp' },
];
