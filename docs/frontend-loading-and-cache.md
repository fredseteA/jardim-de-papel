# Carregamento e cache do frontend

## Diagnóstico

O `useApi` anterior criava um estado e uma requisição por montagem, abortava ao desmontar e perdia os dados. A navegação pelo React Router desmonta as páginas, de modo que retornar à mesma aba reabria o loading e repetia a consulta. A Home combinava catálogo e coleções em `Promise.all`, sem cache acessível às outras páginas. React StrictMode pode também montar, desmontar e montar novamente no desenvolvimento; isso não significa que toda renderização faça uma requisição, embora uma primeira requisição cancelada possa ser reiniciada.

## Solução

TanStack Query mantém um `QueryClient` compartilhado no topo da aplicação. `useApi` usa o cache e informa separadamente disponibilidade inicial, erro e atualização. As chaves são `['stories', parâmetros ordenados]`, `['collections']`, `['collection', slug]` e `['reading', slug]`; limite, deslocamento, busca e filtros fazem parte da chave de histórias. A Home e a primeira página sem filtros da Biblioteca usam a mesma consulta de 18 itens. Coleções é compartilhada entre Home e página de coleções. Story Opening e leitor usam a mesma estrutura completa de leitura, que só é carregada ao abrir a história.

Os dados são considerados frescos por 5 minutos e removidos 30 minutos após deixarem de ser usados. Consultas idênticas simultâneas são deduplicadas. Requisições com erro transitório são repetidas uma vez; erros HTTP definitivos 4xx não são repetidos. Não há atualização ao focalizar a janela. Ao voltar a uma consulta obsoleta, os dados permanecem visíveis durante a atualização; falhas na atualização preservam o cache. Uma consulta sem dados e com falha mostra o erro existente com nova tentativa. Filtros e busca não usam dados de outra chave; o debounce permanece em 150 ms e o sinal de cancelamento é propagado ao cliente HTTP.

## Prefetch, persistência e invalidação

Não há prefetch especulativo de mídia ou catálogo: a Home já carrega as consultas leves equivalentes às primeiras telas de Biblioteca e Coleções, e a abertura fornece a leitura ao leitor. Não há persistência do cache em disco nesta fase; progresso e favoritos mantêm armazenamento local independente. Para futuras operações editoriais, invalide as chaves apropriadas com `queryClient.invalidateQueries`, por exemplo prefixos `['stories']`, `['collections']`, `['collection', slug]` ou `['reading', slug]`. Nenhum conteúdo privado nem binário é armazenado no cache de consultas.

## Verificação e limites

Os testes exercitam deduplicação, parâmetros distintos, remount com dados em cache, invalidação, atualização em segundo plano, falha com dados existentes e cancelamento. Os testes existentes cobrem leitura, progresso e busca. No navegador com a API local e Supabase de desenvolvimento, a Home carregou a história, a primeira Biblioteca abriu imediatamente e a volta à Home reutilizou o cache; a abertura para o leitor também reutilizou a estrutura e retomou o progresso. Antes, cada montagem da Home consultava catálogo e coleções e a Biblioteca executava outra consulta; depois, essas duas listas equivalentes são compartilhadas durante a validade, e abrir o leitor após a abertura não executa nova consulta de leitura. Não foi feita uma medição cronometrada nem captura de tráfego detalhada. A simulação de desligamento real não foi executada, pois a porta da API já era usada por um processo existente; a falha de atualização foi testada automaticamente. Em uma primeira visita ao perfil ou uma consulta com filtros novos ainda pode haver carregamento inicial. Não há cache persistente após reiniciar o aplicativo. StrictMode pode cancelar e reiniciar uma requisição inicial em desenvolvimento.
