# Leitor: preparação para integração com backend

## Modelo e contrato atual

Os tipos em `src/types/story.ts` descrevem `Story`, seus capítulos (`StoryChapter`) e cenas (`StoryPage`). Histórias, capítulos e páginas precisam de IDs estáveis; capítulos e páginas possuem `order` e são ordenados sem alterar os dados de origem. A história contém `slug`, título, descrição, sinopse, idioma, status e coleção. Cada cena contém texto e pode conter `illustration`, `animation`, `narration`, `music`, duração estimada e opções de apresentação. Os campos de mídia são opcionais; o leitor precisa continuar funcionando sem eles.

O contrato de imagem contém `src` e `alt`, com indicação opcional de conteúdo demonstrativo. Vídeo contém URL, poster opcional, loop e comportamento de reprodução (`manual`, `on-page-enter` ou `with-narration`). Narração tem URL e duração opcional; música tem URL e opção de loop. Uma música da cena tem prioridade sobre `audio.backgroundMusic` da história. Uma cena sem música própria herda a trilha geral, se existente. URLs devem apontar para mídia autorizada e acessível pelo navegador; o vídeo é reproduzido sem som, enquanto narração e música têm controles próprios.

## Carregamento e persistência

Hoje `ReaderPage` consulta o catálogo local `src/data/stories`, selecionando apenas histórias publicadas. `StoryReader` recebe a história por propriedade, sem importar o catálogo; `getStoryPages` e `getScenes` organizam os capítulos e páginas. Na integração, substitua essa consulta por um repositório assíncrono que obtenha a história e apresente estados de carregamento, erro e indisponibilidade. Valide a resposta antes de entregá-la ao leitor; mantenha os IDs e a ordem ao editar conteúdo.

O progresso local é isolado em `logic/readerCore.ts`, por história, com versão, IDs de capítulo e página, modo, conclusão e data. As configurações são armazenadas separadamente no navegador, incluindo fonte, contraste e redução de movimento. A API futura deverá persistir posição e conclusão por conta ou perfil, reconciliar atualizações locais e remotas e tratar cenas removidas, alterações de ordem, conflitos e uso offline. Não há sincronização remota implementada.

## Mídia e operação futura

A cena ativa é renderizada individualmente; a próxima imagem ou poster é pré-carregada quando disponível. Vídeos são pausados ao sair da cena e usam poster quando fornecido. GIFs e WebP animados são exibidos como imagens nativas: não oferecem pausa ou sincronização precisa; prefira vídeo curto em loop quando esses controles forem necessários. Narração exige interação do usuário; as políticas de autoplay variam entre navegadores.

Para produção, fornecer versões responsivas e comprimidas de imagens, posters leves, formatos de vídeo e áudio suportados pelos dispositivos, URLs duráveis ou renováveis, cache/CDN e política de acesso apropriada. Considerar CORS, range requests para áudio/vídeo, metadados de direitos e atribuição, acessibilidade dos textos alternativos e limites de tamanho. Validar em redes lentas e dispositivos físicos antes de publicar. As ilustrações da história atual permanecem identificadas como demonstrativas nos dados editoriais.
