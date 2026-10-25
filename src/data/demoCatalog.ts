import type { Collection, Story } from '../types/editorial';

/** Conteúdo fictício para validar a arquitetura; não representa catálogo publicado. */
export const demoCollections: Collection[] = [
  { id: 'narnia', slug: 'narnia', title: 'Nárnia', description: 'Descubra um mundo de magia, coragem e aventuras.' },
  { id: 'contos-encantados', slug: 'contos-encantados', title: 'Contos Encantados', description: 'Aventuras delicadas e imaginativas.' },
  { id: 'historias-da-fe', slug: 'historias-da-fe', title: 'Histórias da Fé', description: 'Narrativas de afeto e esperança.' },
  { id: 'mundos-de-fantasia', slug: 'mundos-de-fantasia', title: 'Mundos de Fantasia', description: 'Portais para o extraordinário.' },
  { id: 'fabulas', slug: 'fabulas', title: 'Fábulas', description: 'Pequenos encontros com grandes ideias.' },
];

export const demoStories: Story[] = [{
  id: 'historia-semente-luminosa', collectionId: 'contos-encantados', slug: 'a-semente-luminosa',
  title: 'A semente luminosa', synopsis: 'Uma história demonstrativa sobre curiosidade e cuidado.',
  coverImage: '/assets/stories/semente-luminosa-demo.png', ageRange: 'A partir de 5 anos', collectionName: 'Contos Encantados', availableReadingModes: ['immersive', 'traditional'],
  chapters: [{ id: 'capitulo-1', title: 'O começo', order: 1, pages: [{ id: 'pagina-1', text: 'Era uma vez uma pequena semente que guardava uma luz gentil.' }] }],
},
  { id: 'demo-2', collectionId: 'mundos-de-fantasia', slug: 'a-casa-das-nuvens', title: 'A casa das nuvens', synopsis: 'Uma visita imaginária acima do bosque.', ageRange: 'A partir de 4 anos', collectionName: 'Mundos de Fantasia', availableReadingModes: ['traditional'], chapters: [] },
  { id: 'demo-3', collectionId: 'fabulas', slug: 'o-passarinho-e-o-vento', title: 'O passarinho e o vento', synopsis: 'Uma fábula breve sobre coragem.', ageRange: 'A partir de 6 anos', collectionName: 'Fábulas', availableReadingModes: ['traditional'], chapters: [] },
  { id: 'demo-4', collectionId: 'historias-da-fe', slug: 'uma-luz-no-caminho', title: 'Uma luz no caminho', synopsis: 'Uma história de cuidado compartilhado.', ageRange: 'A partir de 5 anos', collectionName: 'Histórias da Fé', availableReadingModes: ['traditional'], chapters: [] },
];
