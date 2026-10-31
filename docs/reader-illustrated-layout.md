# Leitor ilustrado — layout mobile e tela cheia

## Composição atual

O leitor mantém uma única árvore de mídia e narrativa durante mudanças de orientação. A composição usa o tamanho efetivo do leitor, não o tamanho da fonte, para escolher o formato. Header e rodapé participam do flex vertical de `100dvh`; a cena recebe apenas a altura restante, com `min-height: 0`.

- **Celular horizontal:** coluna de ilustração com 60% e narrativa com 40%. A cena não rola; apenas o papel possui `overflow-y: auto`, foco por teclado e barra de rolagem discreta. Fonte maior aumenta o conteúdo rolável, sem deslocar a arte ou os controles.
- **Celular vertical:** ilustração quase na largura total, acima do papel. O papel cresce com o texto; a página ilustrada inteira rola na área entre header e rodapé. Não há rolagem interna da narrativa.
- **Tablet:** composição empilhada em retrato e duas áreas em larguras a partir de 960px. A página ilustrada mantém rolagem natural, largura máxima de 1160px e fonte configurável.
- **Desktop:** composição de livro com largura controlada, sem ampliar indefinidamente as capas.

A ilustração usa sua proporção intrínseca e `object-fit: contain`, sem zoom editorial que recorte o conteúdo. O fallback inicial é 4:3; o carregamento fornece a proporção real. Os assets locais disponíveis são 1536×1024 (3:2), portanto não são forçados a 4:3. Um teste simula uma imagem 2048×1536 para verificar também 4:3. No horizontal, uma cópia desfocada e discreta da própria arte integra o espaço que sobra ao redor da imagem inteira. Não foram substituídas ilustrações.

O texto usa `var(--font-editorial)`, cuja família global é **Chewy**. As opções existentes permanecem 14px, 18px e 28px. A preferência de contraste continua respeitada: padrão marfim, claro ou escuro.

## Movimento e controles

A arte estática recebe uma animação CSS de 22 segundos, alternada, com escala entre .985 e .995 e deslocamento vertical de .2%. O movimento fica dentro da área disponível, sem alterar medidas ou cortar as bordas. A opção editorial `motion: none`, a preferência do leitor e `prefers-reduced-motion` desativam o efeito. Vídeos mantêm o comportamento de reprodução já existente.

O celular horizontal usa botões de 40px, header/rodapé compactos e safe areas. Narração e música permanecem disponíveis, assim como capítulos, modo tradicional e progresso. O olho continua recolhendo somente os controles. A navegação é manual; nenhuma mudança de cena é causada por um timer de leitura.

## Tela cheia independente

`useReaderFullscreen` utiliza o controlador de display compartilhado por `ReaderEntry` através de `ReaderDisplayContext`. O convite para orientação horizontal e o botão expandir/recolher têm a mesma propriedade sobre fullscreen e orientation lock.

- A chamada nativa ocorre diretamente no gesto do usuário.
- `fullscreenchange` e o estado real do navegador determinam o estado do botão; uma Promise resolvida sem fullscreen não representa sucesso.
- Chamadas simultâneas são bloqueadas; saída pelo navegador atualiza o botão.
- Recusa, API ausente ou falha de saída mostram uma mensagem dispensável; a leitura continua e o olho permanece independente.
- Ao desmontar, apenas a sessão proprietária libera fullscreen/orientação. Uma solicitação que termina após a desmontagem também é limpa.
- Abrir ajustes, mudar orientação ou entrar/sair de fullscreen não remonta a cena nem os elementos de áudio.

Fullscreen e bloqueio de orientação dependem do navegador, gesto, permissões e contexto de execução. iOS e navegadores incorporados podem não oferecer todas as APIs. Não há confirmação falsa nem rotação artificial por CSS.

## Compatibilidade editorial

IDs, narrativa, links de mídia, importador JSON, persistência de progresso e serviços de áudio permanecem separados da apresentação. Configurações antigas de posicionamento/zoom são conservadas nos dados, mas não sobrepõem texto e ilustração no novo fluxo de livro. O editor usa o renderizador real; ajustes antigos ficam numa área de compatibilidade identificada.

## Validação local

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 26 arquivos, **136 testes aprovados**.
- `npm run build`: aprovado; permanece o aviso de bundle JavaScript acima de 500kB.
- Fixture DEV `frontend/tests/visual/reader.html`: leitor real, arte local e narrativa explicitamente demonstrativa, sem consultar ou alterar o PostgreSQL. O áudio silencioso da fixture verifica somente a organização dos controles.
- Navegador: **81 combinações**, com 150/350/500 caracteres e fontes 14/18/28 em 360×800, 390×844, 430×932, 800×360, 844×390, 932×430, 768×1024, 1024×768 e 1366×768. Sem overflow horizontal, sobreposição do header/rodapé ou controles fora da viewport; imagens carregadas com `contain`.
- Rolagem por teclado até o fim da narrativa horizontal de 500 caracteres/fonte 28: papel alcança o final e a cena permanece em `scrollTop = 0`. Na vertical, a rolagem é da página ilustrada.
- Inspeção de capturas reais em retrato e paisagem; verificação dos estados do botão de fullscreen e ajustes. Testes automatizados cobrem fullscreen, rejeição, API ausente, saída pelo sistema, chamada duplicada, desmontagem tardia, integração com orientação e preservação dos elementos de áudio/cena.

Não houve teste em hardware físico iOS/Android. As políticas reais de áudio/fullscreen e o comportamento das barras do navegador devem receber uma checagem final nesses dispositivos. Não houve alteração remota, migration, deploy ou commit.

## Arquivos principais

- `frontend/src/features/reader/SceneRenderer.tsx` e `.module.css`: proporções, narrativa, rolagem, fonte e animação da arte.
- `frontend/src/features/reader/StoryReader.tsx` e `.module.css`: controle de fullscreen, mensagem de falha e chrome compacto.
- `frontend/src/features/reader/ReaderEntry.tsx`, `ReaderDisplayContext.ts`, `readerDisplaySession.ts`, `useReaderFullscreen.ts`: sessão nativa compartilhada e ciclo de vida.
- `frontend/src/features/reader/ReaderFullscreen.test.tsx` e `SceneRenderer.test.tsx`: cobertura das novas capacidades.
- `readerViewport.ts`, `useSceneViewport.ts` e testes: medidas, formatos e entrada responsiva preservados do ajuste anterior.
