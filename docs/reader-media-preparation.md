# Preparação e cache completo da aventura

Ao acionar Começar, Continuar ou Recomeçar na Story Opening, a rota do leitor apresenta **Estamos preparando sua aventura!**. Primeiro obtém a estrutura pelo cache/API já existente; depois conclui o download dos arquivos antes de montar o leitor. O convite de orientação continua disponível após a preparação. Não é necessário iniciar novamente a história para girar a tela.

## Arquivos e arquitetura

- `ReaderPage` integra o fluxo, mantém a origem de navegação e obtém os dados existentes. Inclui todos os `scene_media` retornados pela API, mesmo papéis que o leitor ainda não apresenta.
- `preparation/storyMediaCache.ts` coleta/deduplica capas, imagens de cenas, GIFs, vídeos, posters, prévias, trilhas compartilhadas e narrações. Faz no máximo **três downloads simultâneos** e aguarda os corpos completos, não apenas cabeçalhos ou metadados. Cada arquivo tem timeout de 120 segundos.
- `StoryPreparation` impede montar o leitor antes do sucesso, administra tentativas, cancelamento e liberação de recursos.
- `AdventureLoading` apresenta livro ilustrado já existente, animação suave, progresso real por número de arquivos, retorno à capa e erro com nova tentativa. Não reproduz áudio. Respeita movimento reduzido e safe areas.

## Uso do cache

O cache binário persistente usa **CacheStorage**, namespace `jardim-de-papel:reader-media:v1`, com a URL original absoluta como chave. Os UUIDs de mídia e caminhos de upload existentes são imutáveis; arquivos substituídos recebem outra URL/UUID e são baixados novamente. A leitura anterior não altera os contratos de mídia ou o banco.

Cada resposta bem-sucedida vira um Blob. O leitor recebe uma cópia da história com URLs `blob:` locais para todos os consumidores; assim imagem, vídeo e áudio não fazem um segundo download ao entrar em uma cena. A história original, IDs e narrativas permanecem intactos. Arquivos compartilhados usam a mesma URL local, preservando a continuidade da música. O progresso continua identificado pelos IDs originais.

Ao sair da rota ou trocar de história, as transferências pendentes são canceladas e as URLs temporárias são revogadas. O cache persistente permanece reutilizável. Apenas a próxima ilustração é antecipada para decodificação durante a leitura; não se mantêm dezenas de imagens decodificadas ou players de áudio/vídeo ativos.

Se CacheStorage estiver bloqueado ou sem quota, os Blobs continuam disponíveis durante a sessão atual. O navegador pode remover o cache persistente sob pressão de armazenamento. Isso **não constitui um modo offline completo**: o catálogo/contrato de leitura ainda utiliza a API existente. Também não elimina o tempo de decodificação dos formatos, embora elimine uma transferência de rede por página durante a sessão preparada.

Mídias externas precisam permitir leitura via CORS para que os bytes possam ser armazenados. Os assets públicos do backend usam a rota de entrega e o Storage já existentes, sem credenciais administrativas no frontend. URLs assinadas completas são preservadas, sem remover seus parâmetros. Respostas 404, opacas, vazias ou HTML/JSON de erro não contam como mídia pronta. Não são criados áudios nem modificados arquivos editoriais.

## Falhas e testes

Se um download falhar, o leitor não inicia com arquivos ausentes. A tela oferece tentar novamente ou voltar à capa, sem marcar progresso de leitura. Arquivos já persistidos são reaproveitados na nova tentativa. Cache indisponível pode exigir novo download.

Testes em `preparation/storyMediaCache.test.ts` e `StoryPreparation.test.tsx`: coleta e deduplicação, concorrência, progresso, bytes completos, reuso offline do cache binário, quota, falhas, timeout, cancelamento, revogação, remapeamento, bloqueio de entrada, tentativas, rotação e ausência de progresso antecipado.

Prévia visual DEV: `/tests/visual/preparation.html`; acrescente `?error=1` para erro, ou `?flow=1` para executar a preparação real de quatro imagens locais demonstrativas. Não consulta o Supabase.

Validação desta implementação: **155 testes frontend aprovados**, lint sem avisos, TypeScript e build aprovados. Permanece o aviso de bundle acima de 500 kB. Navegador revisado em 360×800, 390×844, 430×932, 844×390, 768×1024, 1024×768 e 1366×768, sem overflow horizontal e com áreas de toque de pelo menos 40px. O fluxo real com quatro imagens demonstrativas foi executado; as cenas carregadas utilizavam URLs `blob:` e imagens completas, inclusive após retomar o progresso. Não houve alteração de dados nem teste de upload no Supabase. A validação não substitui testes em aparelhos físicos ou arquivos audiovisuais grandes.
