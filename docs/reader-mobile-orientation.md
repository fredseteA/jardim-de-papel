# Leitor mobile horizontal e sugestão de orientação

> Histórico da primeira adaptação. A composição atual de livro, divisão 60/40, rolagem por orientação e botão independente de fullscreen estão documentados em [reader-illustrated-layout.md](reader-illustrated-layout.md). As regras de entrada e detecção abaixo continuam como referência; os posicionamentos livres descritos aqui não são aplicados ao novo fluxo ilustrado.

## Problema e correção

O leitor usava uma imagem de fundo cobrindo toda a tela e um bloco narrativo com máximo de 42% da altura mesmo em celulares horizontais. O tamanho do texto era derivado da largura da viewport, aumentando a fonte justamente quando havia menos altura. O rodapé, especialmente com narração e música, reduzia ainda mais o espaço disponível. A simples orientação landscape também não distinguia celulares de tablets.

A implementação agora usa duas áreas independentes no celular horizontal: aproximadamente 55% da largura útil para a ilustração e 45% para a narrativa, com separação de 16px e respeito às safe areas. Header e footer são medidos de verdade; a narrativa não ultrapassa a altura restante. O texto tem rolagem interna e indicação de continuação quando necessário. Textos curtos não precisam preencher toda a coluna; textos de 500 caracteres continuam acessíveis sem encolher a fonte para caber.

A imagem usa encaixe proporcional (`contain`) como base, sem o zoom cinematográfico automático do fundo. Um zoom/enquadramento explicitamente salvo no editor continua sendo aplicado dentro da coluna da imagem; zoom editorial maior que 1 pode produzir um recorte intencional. Vídeos usam `object-fit: contain`. GIFs e sprites continuam usando a infraestrutura atual. Não foram alterados arquivos originais ou contratos de mídia.

Os controles têm área de toque de 40px no modo compacto. Narração e música ficam no mesmo nível dos controles quando disponíveis. O botão de mostrar/recolher controles fica no header, sem cobrir a narrativa. O layout usa `100dvh`, container queries e observadores de tamanho. O modo tradicional, tablets e desktop preservam sua composição existente.

## Detecção

`src/features/reader/readerViewport.ts` centraliza as regras:

- Geometria de celular: menor dimensão até 540px e maior dimensão menor que 1180px, ambas positivas.
- Layout compacto horizontal: essa geometria e largura maior que altura. Uma janela desktop muito baixa também pode receber essa adaptação para manter seus controles utilizáveis.
- Sugestão na entrada: geometria de celular **vertical**, ponteiro primário `coarse` e ausência de hover. Uma janela pequena de desktop com mouse não recebe o convite. Não há detecção por user-agent.
- Tablets com menor dimensão de 600/768px e desktop não recebem o convite nem o layout compacto apenas por estarem na horizontal.

São heurísticas de viewport/capacidade, não uma identificação física infalível do dispositivo. Um tablet com janela muito reduzida ou dispositivo dobrável pode se enquadrar nas dimensões compactas; a interface continua responsiva.

## Entrada e escolha

1. O CTA existente da Story Opening mantém a origem de navegação e envia `suggestOrientation: true` no estado da rota de leitura. Isso também vale para continuar/recomeçar a história.
2. `ReaderPage` envolve o leitor em `ReaderEntry`, montado uma vez por história. A API e o adaptador de histórias existentes continuam sendo usados.
3. Antes de montar a experiência de leitura, `ReaderEntry` decide se deve oferecer o modal. Acesso direto à URL do leitor não impõe a sugestão.
4. **Continuar na vertical**, ou Escape, inicia a leitura sem requisitar fullscreen/lock. Caso o usuário tenha aceitado antes e depois desista, a sessão de display é liberada.
5. **Ler na horizontal** tenta fullscreen dentro do gesto do botão e, em seguida, tenta `screen.orientation.lock('landscape')`. A tela passa a orientar a rotação manual imediatamente, sem aguardar indefinidamente uma API.
6. O leitor só é montado após uma viewport realmente horizontal ou a escolha de continuar normalmente. A resolução da Promise de fullscreen/lock não comprova rotação.
7. Depois que a leitura começa, o modal não reaparece ao girar o celular. O componente do leitor, os elementos de mídia, a cena atual, as configurações e o progresso continuam montados; apenas medidas e estilos mudam.

O modal é um `<dialog>` nativo, com nome e descrição acessíveis, foco contido, botões de pelo menos 48px e opção de saída por teclado. Não são usados alertas nativos nem rotação artificial do aplicativo com CSS.

## Fullscreen e orientação

`readerDisplaySession.ts` mantém a propriedade dos recursos solicitados pelo leitor. Ele não fecha fullscreen que já existia antes da entrada. Ao desmontar a rota ou desistir da rotação, libera seu lock e tenta encerrar somente o fullscreen que abriu. Ao detectar saída pelo navegador/sistema, libera o lock e mantém o leitor utilizável.

Uma solicitação nativa pendente não pode ser cancelada pelo JavaScript. Se resolver após a desistência/saída, a sessão desfaz seu efeito. Uma concessão única impede que duas entradas concorrentes disputem as APIs; a nova entrada pode continuar por rotação manual enquanto uma solicitação antiga ainda está pendente.

Não existe promessa de forçar fullscreen ou orientação: permissões, versão do navegador, políticas de incorporação e ativação do usuário podem impedir as APIs. O fallback de girar fisicamente ou continuar na vertical está sempre disponível. Nenhuma configuração de segurança do navegador é alterada.

### Android, iOS e contexto de teste

- Em navegadores Android com suporte, o lock costuma depender de fullscreen e das políticas do navegador. O aplicativo tenta as APIs sem presumir sucesso.
- Em iPhone/Safari, não se deve depender de fullscreen de elementos HTML ou de lock de orientação. Use a rotação física quando essas APIs não estiverem disponíveis ou forem recusadas. Instalação como app/PWA e diferenças de versão podem mudar o comportamento; esta tarefa não adiciona uma PWA.
- APIs de fullscreen/orientação têm disponibilidade limitada. HTTPS/contexto seguro, gesto direto e permissões podem ser necessários. Acesso por HTTP ao IP da máquina na rede local pode limitar o teste dessas APIs, embora a rotação física e o layout continuem testáveis.
- A aplicação não consegue desativar o bloqueio de rotação escolhido pelo usuário no sistema operacional.

Referências consultadas: [MDN — orientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock), [MDN — requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [WebKit — suporte de fullscreen no iOS](https://bugs.webkit.org/show_bug.cgi?id=fullscreen-ios).

## Validação e como testar

No `frontend/`, execute `npm run lint`, `npm run typecheck`, `npm test -- --run` e `npm run build`.

Os testes novos cobrem classificação de viewport e ponteiro, navegação do CTA até a sugestão, recusa, aceite sem rotação efetiva, APIs rejeitadas/ausentes, saída do fullscreen pelo sistema, desistência durante Promise pendente, liberação tardia do lock, propriedade de fullscreen preexistente e preservação de cena/progresso/configurações/elementos de áudio ao girar.

O cenário DEV `/tests/visual/reader.html` reutiliza o leitor real com dados demonstrativos isolados, sem API remota. Parâmetros: `text=short`, `text=medium` ou padrão de 500 caracteres; `audio=1` inclui um WAV silencioso de teste apenas para conferir os controles; `prompt=1` mostra o componente visual real do convite, independentemente da detecção de ponteiro do computador. O fluxo real de detecção/entrada continua no CTA e em `ReaderPage`, não depende desse cenário.

Verificações em navegador: 568×280, 568×320, 667×320, 844×390, 360×740, 390×844, 430×932, 768×1024, 1024×768 e 1440×900. Conferir scroll interno do texto, controles com áudio, retrato e tablets sem overflow horizontal. A emulação de viewport não substitui testes físicos de fullscreen/rotação no Android/iOS; os caminhos das APIs são cobertos por testes automatizados com simulação.

Teste manual no aparelho:

1. Abra a capa de uma história com cenas e toque em Começar/Continuar a aventura no celular vertical.
2. Recuse o convite e confirme que o leitor abre normalmente. Gire para os dois lados e confira a mesma cena/progresso.
3. Saia para a capa e inicie novamente. Aceite o convite e confira fullscreen/rotação, ou a mensagem para girar manualmente. Se a tela não girar, use Continuar na vertical.
4. No horizontal, teste páginas curtas, médias e longas, fonte mínima/máxima, configurações e controles recolhidos. Role o bloco narrativo até o final.
5. Em uma cena com arquivos reais, ative narração e música, gire o aparelho e confira continuidade. A simulação silenciosa testa somente layout.
6. Saia de fullscreen pelos controles do sistema e depois saia da leitura. Confirme ausência de lock persistente.
7. Repita a abertura em tablet e desktop: o convite não deve aparecer.

## Arquivos desta implementação

Novos: `src/features/reader/readerViewport.ts`, `readerViewport.test.ts`, `ReaderEntry.tsx`, `ReaderEntry.module.css`, `ReaderEntry.test.tsx`, `readerDisplaySession.ts`, `readerDisplaySession.test.ts`, `tests/visual/reader.html`, `tests/visual/reader.tsx` e este documento.

Modificados: `src/features/reader/SceneRenderer.tsx`, `SceneRenderer.module.css`, `SceneRenderer.test.tsx`, `StoryReader.tsx`, `StoryReader.module.css`, `useSceneViewport.ts`, `src/features/story-opening/StoryOpening.tsx`, `StoryOpening.test.tsx` e `src/pages/ReaderPage.tsx`. Em `src/features/admin/CompositionEditor.tsx`, somente a marcação do rodapé de prévia acompanha o rodapé real (slot de áudio e indicação de existência de áudio), sem mudanças no salvamento ou contratos de composição. O teste legado `src/features/admin/ChapterSceneEditor.test.tsx` passou a aguardar a inicialização do texto antes de simular digitação; o editor de capítulos/cenas não foi alterado.

Não há mudanças no backend, banco, dados das histórias, importador JSON, serviços de narração/música ou implementação de avanço automático. O avanço automático que já existia foi preservado, sem novos comportamentos.
