# Plano de integração

1. Adaptar `CatalogRepository` e `ReaderPage` para uma fonte HTTP assíncrona, com estados de erro e carregamento; usar as listas, detalhes e `/stories/{slug}/reading`. Não substituir o mock antes de preparar o adaptador de DTOs e URLs de mídia.
2. Migrar Chapeuzinho após revisão editorial, associando coleções, história, capítulos, cenas e mídias na ordem correta. Os IDs locais são strings legadas e os IDs do banco são UUID: criar e persistir um mapa explícito de IDs por entidade; sem esse mapa, o progresso local não pode ser retomado automaticamente. O inventário demonstrativo foi importado; consulte `chapeuzinho-content-migration.md` para o mapeamento UUID e as limitações.
3. Sincronizar progresso somente após autenticação e autorização por perfil; definir reconciliação de conflitos, operação offline e migração segura do localStorage.
4. Criar fluxo de upload autenticado com validação de conteúdo, tamanho, MIME, permissões, metadados, armazenamento e entrega; não fazer upload diretamente para o banco.
5. Implementar painel administrativo com autenticação/autorização, edição, ordenação, rascunhos, publicação, auditoria e tratamento de conflitos. Não existem endpoints administrativos nesta versão.
