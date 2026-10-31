# Editor de cenas e imagens

## Contrato e persistência

`media_assets` mantém o arquivo; `scene_media` mantém seu uso. Nenhuma migration foi necessária. A imagem principal usa `illustration`, o fundo usa `background`, e os áudios usam `narration`, `ambient_music` ou `sound_effect`.

O POST administrativo de mídia da cena agora substitui atomicamente o arquivo do mesmo papel e `display_order`, sob bloqueio da cena. Não cria um segundo vínculo para a mesma posição. Ao confirmar a biblioteca, a resposta persistida atualiza a miniatura e invalida o cache `reading` da história. A troca ou remoção de mídia preserva o texto ainda não salvo. Remover imagem chama apenas DELETE do vínculo; excluir o arquivo continua sendo uma operação separada na biblioteca.

## Causas corrigidas

- Biblioteca geral apenas atualizava um select sem abrir uma interface visual.
- Arquivos enviados para uma história ainda sem vínculos eram excluídos pelo filtro contextual.
- A substituição tentava inserir outro vínculo na mesma posição, causando conflito de unicidade.
- O adaptador do leitor considerava apenas `illustration` e ignorava imagens com papel `background`.
- URLs assinadas de curta duração ficavam armazenadas no cache da leitura e podiam expirar antes de o usuário chegar à cena.
- Alterar mídia recarregava o objeto inteiro da cena e podia sobrescrever texto ainda em edição.

## Arquivos privados

O painel recebe URLs assinadas usando o bucket gravado no próprio asset, com encoding do caminho e renovação de miniatura quando necessário. A chave privilegiada permanece no backend. `MEDIA_SIGNED_URL_SECONDS` controla a duração (padrão 900 segundos).

O leitor público recebe `/api/v1/media/{id}/content`. O adaptador acrescenta a origem da API. Cada acesso verifica que existe uma referência em história ou coleção publicada, solicita uma URL assinada nova e redireciona com `Cache-Control: no-store`. Uma mídia exclusiva de rascunho recebe 404. Uma mídia compartilhada com uma história publicada pode ser exibida por essa história. URLs temporárias já emitidas continuam válidas até expirar; despublicação não revoga tokens já emitidos pelo Storage.

Os arquivos locais `storage_provider=frontend` continuam usando `/assets/...`. O contrato legado de vídeo/animação foi mantido para preservar registros existentes, mas novos uploads/vínculos desses tipos são recusados. JPEG (incluindo `.jpeg`), PNG, WebP, MP3, WAV e OGG são aceitos. AVIF não foi habilitado porque não há validação completa desse formato no backend. Não foram excluídos arquivos ou registros legados. A migração de arquivos legados exige revisão editorial e substituição manual, seguida de remoção explícita dos vínculos antigos.

## Biblioteca e prévia

O modal de seleção é um `dialog` nativo: foco contido, Escape, seleção destacada, busca, filtros de coleção/história/capítulo, arquivos sem vínculos, paginação e upload sem associação automática. A prévia ampliada é acessível pelo arquivo selecionado. A biblioteca administrativa identifica compartilhamento e informa vínculos com links para o editor correspondente.

“Pré-visualizar cena” usa `SceneRenderer` e `sceneToReaderPage`, também utilizados na leitura. A mensagem distingue texto em edição e vínculos já salvos. A prévia não grava progresso nem publica a história.

## Validação manual local

1. Inicie API atualizada em `backend` e Vite em `frontend`, mantendo o bucket privado e as credenciais apenas no backend.
2. Abra `/admin/stories`, edite uma história e escolha Capítulos e cenas.
3. Em Ilustração da cena, clique Escolher imagem. Use Todas as imagens para acessar arquivos gerais.
4. Selecione uma miniatura e clique Confirmar seleção. Aguarde “Imagem ou áudio associado e salvo”.
5. Recarregue a página e reabra a cena: o arquivo deve permanecer associado.
6. Abra a prévia e o leitor. Fundo também é utilizado quando não há ilustração.
7. Troque o arquivo: deve permanecer um único vínculo na mesma posição. Remova a imagem: o arquivo deve continuar na biblioteca.
8. Envie PNG, JPEG ou WebP pelo modal. A imagem fica selecionada, mas só será vinculada após Confirmar seleção. GIF e vídeos devem ser recusados pela API mesmo com requisições fora da interface.

## Testes e limites

Arquivos principais desta etapa:

- Frontend: `SceneMediaManager.tsx`, `SceneMediaManager.module.css`, `SceneMediaManager.test.tsx` (novos); `ChapterSceneEditor.tsx`, `AdminStories.tsx`, `AdminMedia.tsx`, `Admin.module.css`, `editorial.ts`, `lib/api/adapters.ts` e `SceneRenderer.tsx` (alterados).
- Backend: `modules/stories/media_service.py`, `chapter_scene_service.py`, `api/v1/admin_media.py`, `admin_schemas.py`, `router.py`, `core/config.py`, `.env.example` (alterados); `tests/test_editorial_media_flow.py` (novo).
- Documentação: este arquivo (novo) e `media-library-storage.md` (atualizado).

Endpoints alterados/adicionados:

- `GET /api/v1/admin/media`: filtros de coleção, história, capítulo, cena, tipo e ausência de vínculo; contador de histórias para identificar compartilhamento.
- `GET /api/v1/admin/media/context`: histórias, capítulos e coleções para filtros administrativos.
- `POST /api/v1/admin/media/upload`: validação dos formatos estáticos e áudio.
- `POST /api/v1/admin/stories/{story}/chapters/{chapter}/scenes/{scene}/media`: inserção/substituição transacional do slot, protegida por administrador.
- `DELETE` do vínculo da cena: preservado, devolve 204 sem JSON.
- `GET /api/v1/stories/{slug}/reading`: referências estáveis para imagens privadas publicadas.
- `GET /api/v1/media/{id}/content`: autorização editorial por publicação e redirecionamento temporário para o Storage.

`tests/test_editorial_media_flow.py` usa SQLite em memória para verificar persistência, recarga, substituição, serialização pública, desassociação, exclusão e proteção de publicação. Não substitui os testes específicos de PostgreSQL/JSONB, que precisam de `TEST_DATABASE_URL` para um banco de teste local. Não aponta para o Supabase remoto.

`SceneMediaManager.test.tsx` cobre seleção explícita, falha/repetição, upload sem vínculo automático, remoção e consumo do papel background pelo renderizador real.

O Storage e o PostgreSQL não compartilham uma transação distribuída. A exclusão protege o registro com lock e verifica uso antes de remover o objeto; falhas excepcionais de commit após sucesso do Storage exigem reconciliação operacional. Não há exclusão em massa. O fluxo real autenticado no navegador e a entrega pelo bucket remoto precisam ser conferidos manualmente, sem modificar Chapeuzinho durante testes automatizados.
