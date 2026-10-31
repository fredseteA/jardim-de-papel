# Importação editorial de histórias — contrato v1

## Uso no painel

Em `/admin/stories`, escolha **Importar história por JSON**, selecione o arquivo `.json`, confira a validação e expanda os capítulos para ler cada página. A validação não grava registros. **Confirmar importação como rascunho** cria a história, a associação à coleção, os capítulos e as cenas em uma única transação. Depois, **Abrir história no editor** leva ao editor existente de capítulos e cenas; o retorno aos metadados permite revisar a descrição e os demais campos.

O processo não publica, não sobrescreve slugs existentes e não envia arquivos. Ilustrações, narração e música são adicionadas depois pelo editor de mídias. A publicação continua usando o fluxo e as regras existentes, sem novas permissões ou atalhos. O importador não verifica direitos de adaptação nem gera conteúdo ou mídia.

## Arquivos oficiais

- Schema JSON Schema Draft 2020-12: [`schemas/story-import-v1.schema.json`](schemas/story-import-v1.schema.json).
- Exemplo importável: [`examples/story-import-v1.json`](examples/story-import-v1.json).
- Fonte do contrato e validações adicionais: `backend/app/modules/stories/import_schema.py`.

O exemplo é uma narrativa **fictícia e demonstrativa**, com dois capítulos e duas páginas por capítulo. Usa a coleção `contos-classicos`, já utilizada pelo projeto. Esse slug precisa existir no banco de destino; em outro ambiente, substitua-o pelo slug exato de uma coleção cadastrada. Não é necessário que essa coleção esteja publicada para criar um rascunho; nesse caso, a prévia mostra um aviso. Não importamos o exemplo automaticamente em nenhum ambiente.

## Estrutura

```json
{
  "schema_version": 1,
  "story": {
    "title": "Título da história",
    "slug": "titulo-da-historia",
    "collection_slug": "contos-classicos"
  },
  "chapters": [
    {
      "order": 1,
      "title": "Primeiro capítulo",
      "pages": [
        { "order": 1, "text": "Texto completo da primeira página." }
      ]
    }
  ]
}
```

### Raiz

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `schema_version` | inteiro | Sim | Exatamente `1`; outras versões são rejeitadas. |
| `story` | objeto | Sim | Metadados conforme abaixo. |
| `chapters` | array | Sim | De 1 a 100 capítulos; máximo de 500 páginas na história inteira. |

### `story`

| Campo | Tipo | Obrigatório | Regra / padrão |
| --- | --- | --- | --- |
| `title` | string | Sim | 1–255 caracteres; não pode conter apenas espaços. |
| `slug` | string | Sim | Até 180 caracteres, letras minúsculas ASCII, números e hífens entre grupos. Único no catálogo, inclusive entre rascunhos e arquivadas. |
| `collection_slug` | string | Sim | Mesmo formato do slug; deve existir em `collections`. Uma coleção por importação v1. |
| `synopsis` | string | Não | Máximo 20.000 caracteres; padrão `""`. |
| `description` | string | Não | Máximo 20.000 caracteres; padrão `""`. |
| `minimum_age` | inteiro ou null | Não | Maior ou igual a zero. |
| `maximum_age` | inteiro ou null | Não | Maior ou igual a zero e não inferior à mínima, quando informada. |
| `language` | string | Não | 2–20 caracteres; padrão `"pt-BR"`. |
| `estimated_narration_seconds` | inteiro ou null | Não | 1–86.400 segundos. Estimativa editorial da história inteira, não um áudio real. |
| `editorial` | objeto | Não | Padrão `{}`; campos abaixo. |

### `story.editorial`

Todos opcionais, do tipo string de até 20.000 caracteres ou `null`:

| Campo | Significado |
| --- | --- |
| `author` | Autor ou atribuição editorial. |
| `literary_origin` | Origem/tradição literária. |
| `reference_work` | Obra utilizada como referência. |
| `reference_version` | Edição, tradução ou versão clássica de referência. |
| `editorial_notes` | Observações para revisão. |
| `copyright_notes` | Informações sobre autoria, licença e direitos. |

**Persistência sem migration:** o modelo atual de `stories` não possui essas colunas. O importador acrescenta os campos preenchidos à `description`, com cabeçalhos legíveis em português, e registra nela a duração estimada exata em segundos. Isso permite conferência e edição pelo formulário atual, sem uma segunda estrutura de histórias. Os campos não são recuperados como objetos separados depois da importação; a descrição é a representação persistida. Não há exportação JSON nesta etapa.

**Esses dados não são privados:** a descrição pode ser entregue pela API pública após a publicação. Não inclua segredos ou dados pessoais em observações. O aviso aparece também na prévia. Se futuramente forem necessárias notas editoriais privadas e estruturadas, será necessário um campo próprio com controle de acesso, em uma etapa separada.

### Capítulo (`chapters[]`)

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `order` | inteiro | Sim | Sequência `1, 2, 3…`, na mesma ordem do array. |
| `title` | string | Sim | Não vazia, até 255 caracteres. |
| `pages` | array | Sim | Pelo menos uma página; até 500, respeitando o limite global. |

### Página (`chapters[].pages[]`)

| Campo | Tipo | Obrigatório | Regra / padrão |
| --- | --- | --- | --- |
| `order` | inteiro | Sim | Sequência `1, 2, 3…`, reiniciada em cada capítulo. |
| `text` | string | Sim | Texto integral; 1–20.000 caracteres, sem aceitar apenas espaços. Use `\n\n` para separar parágrafos. |
| `title` | string ou null | Não | Não vazia quando informada; até 255 caracteres. |
| `illustration_description` | string ou null | Não | Sugestão editorial de ilustração, até 20.000 caracteres. Não cria mídia. |
| `estimated_narration_seconds` | inteiro ou null | Não | 1–86.400 segundos; gravado na duração estimada da cena. |

Os campos de identificação e o texto são normalizados removendo espaços externos. O conteúdo interno e as quebras de linha são preservados. Números devem ser números JSON, não strings, e booleanos não substituem inteiros. Campos desconhecidos em qualquer nível, inclusive `status`, `id`, URLs de mídia ou configurações arbitrárias de composição, são rejeitados. Não envie esses campos com `null`; omita-os.

Não há campos de arquivos nesta versão. A ausência de registros de mídia significa ilustração, narração e música ainda não fornecidas; não é preciso enviar placeholders.

## Ordenação e estimativas

- Arrays já devem estar ordenados. Ordens repetidas, saltos ou uma ordem diferente da posição no array são erros; o servidor não reordena silenciosamente.
- O JSON usa numeração humana a partir de 1. O banco recebe `display_order = order - 1`, conforme as operações atuais do editor. IDs são UUIDs novos, gerados no servidor.
- A estimativa de narração da história tem prioridade. Se estiver ausente, soma-se a duração das páginas **somente quando todas as páginas tiverem duração**. Caso contrário, a duração geral permanece desconhecida.
- O campo já existente `estimated_reading_minutes` recebe a aproximação em minutos da estimativa de narração, arredondada para cima. A descrição identifica a origem desse valor; não é uma medição do áudio nem uma segunda estimativa independente de leitura silenciosa.
- Estimativas da história e das páginas podem ser diferentes; a estimativa total explícita é uma decisão editorial, não é corrigida automaticamente.

## Mapeamento para os leitores e o editor

| Entrada | Destino atual |
| --- | --- |
| Metadados principais | `stories`, sempre `status = draft` e `published_at = null`. |
| Coleção | `collection_stories`; não altera a coleção existente. |
| Capítulos | `chapters`, vinculados ao novo UUID da história. |
| Páginas | `scenes`, vinculadas ao capítulo correto. |
| `text` | `scenes.narrative_text`. |
| Duração de página | `scenes.estimated_duration_seconds`. |
| Sugestão de ilustração | `scenes.presentation_config.editorial.illustration_description`; campo editável no editor de cenas. |
| Animação/transição | Valores padrão `fade`; composição usa os defaults atuais do leitor. |
| Mídias | Nenhum `media_asset` ou `scene_media` criado. |

O editor de composição continua independente; salvar textos ou a sugestão de ilustração preserva sua configuração. O rascunho não aparece no catálogo, coleções, busca ou endpoints públicos de leitura. Depois de revisar e adicionar as mídias, o administrador pode utilizar o fluxo normal de publicação. A importação não modifica histórias existentes, seu progresso ou os contratos dos leitores.

## API e segurança

Ambas as rotas exigem Bearer JWT válido e o papel `admin` verificado pelo backend:

- `POST /api/v1/admin/stories/import/validate`: corpo é o documento JSON; retorna documento normalizado, coleção, contagens, duração e avisos. Nenhuma escrita.
- `POST /api/v1/admin/stories/import`: recebe o mesmo contrato, refaz todas as validações e retorna `201` com `AdminStoryOut`. A prévia não é uma autorização nem uma garantia de disponibilidade futura do slug.

Limite de corpo: **2 MiB** (2.097.152 bytes), inclusive no backend, com leitura limitada do stream. Use `Content-Type: application/json` e UTF-8 (BOM inicial é aceito). O JSON não pode conter chaves repetidas. Erros de estrutura informam caminhos como `chapters.0.pages.1.text` — os índices nesses caminhos começam em zero.

Respostas: `401/403` sem autorização, `413` arquivo grande, `415` tipo de conteúdo incorreto, `422` JSON ou coleção inválidos, `409` slug já existente ou conflito de integridade, `503` indisponibilidade do banco. Falhas de persistência fazem rollback da história e de todos os vínculos, capítulos e cenas da tentativa. A constraint única de slug também protege confirmações concorrentes.

O botão de confirmação bloqueia cliques duplicados. Não há chave de idempotência nesta versão: reenvios com o mesmo slug são rejeitados, nunca sobrescrevem a história. Em timeout ou queda de conexão, o commit pode ter ocorrido antes da resposta se perder; confira o catálogo pelo slug antes de repetir. A interface preserva a prévia e o erro; não afirma que o servidor desfez uma operação cujo resultado é desconhecido.

## Instruções para um produtor de JSON

1. Utilize exatamente a versão e os nomes documentados. Não envie blocos Markdown, comentários ou campos inventados dentro do arquivo.
2. Consulte o slug real da coleção; não use o título como identificador.
3. Gere um slug único e estável para a nova história.
4. Entregue a narrativa inteira em capítulos e páginas consecutivos, sem resumir o texto.
5. Forneça sugestões de ilustração como texto; não envie imagens, base64, URLs, narrações ou músicas.
6. Declare a origem literária, versão de referência e observações de direitos de forma verificável; não presuma domínio público ou autorização.
7. Não invente idade ou duração se não houver uma estimativa editorial: omita esses campos ou use `null` nos campos que aceitam null.
8. Valide o arquivo com o schema oficial e depois no painel; ordem, existência da coleção e unicidade do slug também são verificadas no servidor.
9. O administrador deve conferir os textos e direitos antes de publicar; a importação gera apenas um rascunho.

## Verificações locais

No `frontend/`: `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`.

No `backend/`: `.venv312\Scripts\python.exe -m pytest tests/test_story_import.py -q` (ou `python -m pytest` no ambiente virtual ativo). Os testes do importador usam banco SQLite isolado em memória com foreign keys ligadas, nunca Supabase. A suíte opcional PostgreSQL requer um banco local `test_*` via `TEST_DATABASE_URL` conforme os testes já existentes.

Para regenerar o schema a partir da fonte, execute no backend:

```powershell
.venv312\Scripts\python.exe -m app.modules.stories.export_import_schema
```

O schema gerado é testado contra a fonte Pydantic para evitar divergências. Validações de sequência e contagens globais continuam sendo regras adicionais no backend, descritas acima.

## Arquivos desta implementação

Criados:

- `backend/app/modules/stories/import_schema.py`: contrato e validações estruturais.
- `backend/app/modules/stories/import_service.py`: prévia e persistência transacional.
- `backend/app/modules/stories/export_import_schema.py`: geração do schema, sem banco.
- `backend/tests/test_story_import.py`: validações, autorização, persistência, rollback, ordenação, integração com o editor e visibilidade pública.
- `frontend/src/features/admin/storyImport.ts`: contratos TypeScript e chamadas autenticadas.
- `frontend/src/features/admin/StoryImportPanel.tsx`: seleção, prévia e confirmação.
- `frontend/src/features/admin/StoryImportPanel.module.css`: estilos responsivos locais.
- `frontend/src/features/admin/StoryImportPanel.test.tsx`: estados e interações do importador.
- `docs/schemas/story-import-v1.schema.json`: schema oficial gerado.
- `docs/examples/story-import-v1.json`: exemplo demonstrativo completo.
- `docs/story-json-import.md`: este guia.

Modificados:

- `backend/app/api/v1/admin_stories.py`: rotas protegidas de validação e importação; parser com limite de tamanho.
- `backend/app/modules/stories/admin_service.py`: preparação de histórias reutilizável sem commit antecipado.
- `frontend/src/features/admin/AdminStories.tsx`: entrada do importador e abertura da história criada.
- `frontend/src/features/admin/AdminStories.test.tsx`: integração com o catálogo administrativo.
- `frontend/src/features/admin/ChapterSceneEditor.tsx`: sugestão de ilustração editável, sem sobrescrever a composição.
- `frontend/src/features/admin/ChapterSceneEditor.test.tsx`: preservação da composição ao salvar a sugestão.

Nenhuma migration, coluna, tabela ou dependência foi adicionada. Os testes usam conteúdo isolado; não inserem o exemplo no banco remoto nem alteram Chapeuzinho Vermelho.
