import type {
  Story,
  StoryCoverImages,
  StoryIllustration,
} from '../../types/story'
import coverHero from '../../../public/assets/stories/chapeuzinho-vermelho/cover/cover-hero.webp'

const demonstrativeIllustration: StoryIllustration = {
  src: '/assets/collections/contos-encantados.jpg',
  alt: 'Uma criança de capa vermelha atravessa uma floresta rumo a uma casa encantada.',
}

const coverImages: StoryCoverImages = {
  desktop: {
    src: coverHero,
    alt: 'Chapeuzinho Vermelho na trilha da floresta.',
  },
  mobile: {
    src: coverHero,
    alt: 'Chapeuzinho Vermelho na trilha da floresta.',
  },
}

export const chapeuzinhoVermelho: Story = {
  id: 'story-chapeuzinho-vermelho',
  slug: 'chapeuzinho-vermelho',
  title: 'Chapeuzinho Vermelho',
  description: 'Uma nova forma de viver um grande clássico. Coragem, amizade e descobertas em uma jornada inesquecível.',
  synopsis:
    'Nesta história demonstrativa, uma menina leva uma cesta para sua avó e aprende a seguir o caminho com atenção e coragem.',
  coverImage: coverImages,
  collectionId: 'contos-classicos',
  collectionDescription: 'Contos Clássicos',
  ageRange: '4–8 anos',
  language: 'pt-BR',
  status: 'published',
  featured: true,
  chapters: [
    {
      id: 'chapter-capa-vermelha',
      slug: 'a-cesta-e-o-caminho',
      title: 'A cesta e o caminho',
      order: 1,
      pages: [
        {
          id: 'page-cesta-pronta',
          order: 1,
          text: 'Em uma manhã dourada, Chapeuzinho preparou uma pequena cesta para a avó. Em uma manhã dourada, Chapeuzinho preparou uma pequena cesta para a avó. Em uma manhã dourada, Chapeuzinho preparou uma pequena cesta para a avó. Em uma manhã dourada, Chapeuzinho preparou uma pequena cesta para a avó. Em uma manhã dourada, Chapeuzinho preparou uma pequena cesta para a avó.',
          illustration: demonstrativeIllustration,
        },
        {
          id: 'page-conselho-da-mae',
          order: 2,
          text: 'Antes de sair, sua mãe lembrou: “Observe o caminho e volte antes de o sol se despedir.”',
          illustration: demonstrativeIllustration,
          presentation: { textAlignment: 'center' },
        },
      ],
    },
    {
      id: 'chapter-floresta',
      slug: 'a-floresta-que-escuta',
      title: 'A floresta que escuta',
      order: 2,
      pages: [
        {
          id: 'page-passarinhos',
          order: 1,
          text: 'Na floresta, passarinhos cantavam entre as folhas e o vento contava histórias baixinho.',
          illustration: demonstrativeIllustration,
        },
        {
          id: 'page-escolha-do-caminho',
          order: 2,
          text: 'Ao encontrar uma trilha desconhecida, ela escolheu seguir as marcas que conhecia.',
          illustration: demonstrativeIllustration,
        },
      ],
    },
    {
      id: 'chapter-casa-da-avo',
      slug: 'a-porta-azul',
      title: 'A porta azul',
      order: 3,
      pages: [
        {
          id: 'page-chegada',
          order: 1,
          text: 'Quando a porta azul apareceu, Chapeuzinho respirou aliviada e bateu três vezes.',
          illustration: demonstrativeIllustration,
        },
        {
          id: 'page-cha-compartilhado',
          order: 2,
          text: 'A avó a recebeu com um abraço, e as duas dividiram chá, pão e as histórias do dia.',
          illustration: demonstrativeIllustration,
        },
      ],
    },
  ],
}
