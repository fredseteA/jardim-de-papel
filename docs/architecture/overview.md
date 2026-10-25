# Visão de arquitetura

O aplicativo usa React, TypeScript estrito, Vite e React Router. As páginas consomem componentes de apresentação; estas não conhecem detalhes de persistência.

`CatalogRepository` é o contrato de acesso ao conteúdo. Nesta etapa ele é implementado por `localCatalogRepository`, abastecido por dados demonstrativos. Uma futura implementação HTTP pode cumprir o mesmo contrato sem alterar as rotas ou os componentes.

O modelo editorial organiza `Collection → Story → Chapter → StoryPage`. Mídias de uma página são opcionais, permitindo leitura textual quando uma ilustração, animação ou áudio não estiver disponível. Os modos `immersive` e `traditional` compartilham o mesmo modelo.
