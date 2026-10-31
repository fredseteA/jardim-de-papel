# Exclusão de histórias

No catálogo `/admin/stories`, o botão de lixeira abre uma confirmação com o título da história. É necessário digitar o slug exato antes de habilitar **Excluir definitivamente**. Histórias publicadas, rascunhos e arquivadas usam o mesmo fluxo; as publicadas exibem um aviso adicional de remoção do catálogo dos leitores.

O diálogo informa que a operação é permanente. Durante o envio, impede cliques duplicados e fechamento acidental por Escape. Em caso de falha, mantém a confirmação, mostra o erro e libera os controles. O sucesso é confirmado somente após uma resposta `204` da API. Falhas de conexão têm resultado potencialmente desconhecido; confira o catálogo antes de reenviar.

## API

`DELETE /api/v1/admin/stories/{story_id}` exige JWT válido e papel `admin`, como os demais endpoints editoriais. O corpo obrigatório é:

```json
{
  "confirm": true,
  "confirmation_slug": "slug-atual-da-historia"
}
```

O backend não confia apenas no estado do botão. Rejeita ausência de confirmação, `false`, outros tipos, campos adicionais e slug diferente do registro atual. A história é bloqueada durante a transação para conferir o slug e executar a exclusão. Recursos inexistentes retornam `404`; confirmação de slug incorreta ou conflito de integridade retornam `409`; dados inválidos retornam `422`.

## Dados removidos e preservados

- Remove a história selecionada, seus capítulos e cenas, associações de mídia dessas cenas, associações com coleções, favoritos e progresso no banco referentes exclusivamente à história.
- Remove primeiro o progresso da história para respeitar também as foreign keys compostas para capítulos e cenas. As demais associações usam os `ON DELETE CASCADE` existentes.
- Preserva todas as coleções, contas, perfis de leitura, outras histórias, registros `media_assets` e arquivos no Storage, inclusive arquivos antes exclusivos da história. Eles podem ser revisados posteriormente pela biblioteca de mídias.
- Falhas na persistência desfazem toda a transação. Não há alteração de schema ou migration.
- Ao confirmar sucesso, a interface atualiza a lista e invalida os caches locais do catálogo, coleções e leitura da história removida. Isso não é uma limpeza remota dos caches de todos os navegadores, nem apaga cópias de progresso/favoritos já salvas localmente por clientes antigos.

## Arquivos

- Backend: `app/api/v1/admin_schemas.py`, `app/api/v1/admin_stories.py`, `app/modules/stories/admin_service.py`, `tests/test_story_delete.py`.
- Frontend: `src/features/admin/editorial.ts`, `AdminStories.tsx`, `Admin.module.css`, `DeleteStoryDialog.tsx`, `DeleteStoryDialog.module.css`, `DeleteStoryDialog.test.tsx`, `AdminStories.test.tsx`.

Os testes de exclusão usam SQLite em memória com foreign keys habilitadas. Cobrem confirmação, autorização, rollback, histórias publicadas, progresso, cascatas e preservação de arquivos/coleções e de outra história que compartilha a mesma mídia. Não excluem registros do Supabase. A integração PostgreSQL opcional continua exigindo um banco local isolado configurado pela suíte existente.
