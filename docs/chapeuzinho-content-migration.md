# Importação de Chapeuzinho Vermelho

## Origem e inventário

A fonte editorial desta fase continua sendo `frontend/src/data/stories/chapeuzinho-vermelho.ts`; a apresentação da coleção vem de `frontend/src/data/collectionPresentation.ts`. O exportador `backend/tools/export-chapeuzinho.mjs` lê somente uma pequena sublinguagem estática da AST TypeScript (literais, arrays, objetos e referências estáticas). Não avalia funções, imports de código ou componentes React: expressões desconhecidas interrompem a exportação. A saída versionada `backend/content/chapeuzinho-vermelho.json` é a entrada independente de TypeScript consumida pelo backend. Ao alterar a fonte, revise o diff do inventário antes de importá-lo.

O conteúdo é a adaptação **demonstrativa existente**, não uma nova publicação editorial definitiva. Possui cinco capítulos e 20 cenas, quatro cenas por capítulo: Uma cesta cheia de carinho; O caminho pela floresta; Um encontro inesperado; A casa da vovó; O caminho de volta. Os textos e referências de cada cena estão integralmente no inventário. São oito arquivos distintos: capa/hero, sprite das prévias, capa da coleção e cinco imagens internas; existem 20 associações de ilustração a cenas. Os textos alternativos e a indicação de demonstração por uso são preservados nas configurações das associações. Não há vídeo, animação, narração, música, efeitos sonoros ou transições explícitas no conteúdo atual. Os campos ausentes permanecem ausentes ou nulos. O tempo estimado é calculado com a mesma fórmula atualmente usada no frontend; a ordem da coleção recebe zero como padrão técnico.

## Identificadores e modelo

IDs de história, coleção, capítulo, cena, mídia e associação são UUIDv5, gerados por `stable_id(kind, local_id)` com namespace fixo `b8789daa-a048-5af4-bbee-c26b5e8d9a4b`. O identificador da mídia inclui o ID local da história e o caminho, permitindo reutilização entre cenas sem tomar posse de mídias de outras histórias. A posição nunca é identidade. Para migrar progresso do localStorage, obtenha `storyId`, `chapterId` e `pageId` do registro e calcule os UUIDs correspondentes com os tipos `story`, `chapter` e `scene`; confirme a existência e a relação das entidades antes de salvar o progresso remoto. A sincronização ainda não foi implementada.

O schema inicial não possui colunas específicas para slug de capítulo, prévias, variante mobile, `featured` e ID legado. Sem alterar o schema, o importador preserva metadados da abertura em `media_assets.metadata.jdp_import_v1` da capa e `legacyPageId`, `legacyChapterId` e `legacyChapterSlug` em `scenes.presentation_config.jdp_import_v1`. Isso é uma solução transitória; o próximo contrato deve modelar esses dados explicitamente. A API de detalhe e de leitura inclui agora `cover_asset` e `hero_asset` (campos adicionais); a coleção individual inclui `cover_asset`. A leitura contém cenas, configurações e mídias com seus metadados. As listas continuam retornando os campos adicionais como nulos, portanto clientes que precisarem de mídia completa devem usar o detalhe.

Os caminhos usam `storage_provider=frontend`, `storage_bucket=public` e `storage_path` relativo, sem caminho absoluto. Eles não são URLs públicas do backend. O futuro adaptador deverá resolver esses caminhos na origem correta ou substituí-los por referências de Storage. A prévia é um único sprite com quatro recortes armazenados nos metadados, não quatro arquivos diferentes.

## Execução e segurança

```bash
node backend/tools/export-chapeuzinho.mjs
cd backend
python -m app.scripts.import_chapeuzinho
```

O importador valida formato, IDs e ordens únicos, arquivos existentes, MIME e projeto de desenvolvimento antes de abrir uma transação. Verifica `public`, `0001_initial` e usa um lock transacional. Ele cria ou atualiza somente IDs determinísticos da história e dependências; um slug ou ID pertencente a outro registro causa erro. Coleção já existente com o mesmo ID é reutilizada sem atualizar seu conteúdo. A história é publicada apenas após cenas e associações serem validadas e persistidas na mesma transação. Uma falha reverte a transação inteira. Dados removidos da origem não são excluídos automaticamente; alterações de ordem que colidam com registros existentes são rejeitadas para revisão manual. Nenhuma migration ou operação destrutiva é executada pelo importador.

## Resultado nesta fase

O banco de desenvolvimento do projeto `ijxpesqxcscyrsnibbly`, schema `public`, versão `0001_initial`, recebeu duas execuções. Contagem após ambas: 1 coleção, 1 história, 1 associação coleção-história, 5 capítulos, 20 cenas, 8 assets e 20 associações cena-mídia. Não foram criados outros registros. Consultas reais confirmaram os IDs, textos e ordenação de todas as cenas, os caminhos das mídias e os slugs legados; os endpoints de catálogo, detalhe, capítulos, leitura e coleção responderam com sucesso.

Os testes de importação, idempotência e rollback passaram usando SQLite isolado com JSONB adaptado para o teste. O teste PostgreSQL isolado existente ficou ignorado por falta de `TEST_DATABASE_URL`; a validação real no Supabase limitou-se às duas importações autorizadas e a consultas somente leitura. A próxima fase precisa implementar o adaptador de DTOs, resolver URLs de mídia, mapear o progresso legado e definir como migrar os metadados transitórios sem perder a indicação demonstrativa.
