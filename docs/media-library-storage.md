# Biblioteca editorial de mídias

`media_assets` já representa arquivos externos: `storage_provider`, `storage_bucket`, `storage_path`, MIME, tamanho e metadados. Por isso esta etapa não requer migration. Arquivos legados continuam com `storage_provider = frontend` e caminhos em `public/assets`; eles não são migrados nem removidos.

## Política adotada

O bucket recomendado é `editorial-media`, **privado**. O backend é o único componente que recebe `SUPABASE_SERVICE_ROLE_KEY`; o navegador nunca a recebe. O upload é mediado pelo FastAPI para validar assinatura do conteúdo, extensão, MIME e limite antes do envio ao Storage. Um registro é criado em `media_assets` somente após a resposta de sucesso do Storage. Em falha ao persistir no banco, o backend tenta remover o objeto recém-enviado.

Objetos usam caminhos sem colisão: `stories/{story_id}/{media_type}/{uuid}-{nome-seguro}.{ext}` ou `library/{media_type}/{uuid}-{nome-seguro}.{ext}`. Os metadados JSONB armazenam título, descrição, nome original e estado editorial.

## Configuração manual no Supabase

1. Crie manualmente o bucket privado `editorial-media` no projeto correto.
2. Não crie policy de escrita para `anon` ou `authenticated`: apenas o backend usa a service role.
3. Configure apenas no ambiente do backend:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<segredo-do-backend>
SUPABASE_STORAGE_BUCKET=editorial-media
```

4. Nunca configure `SUPABASE_SERVICE_ROLE_KEY` ou credenciais PostgreSQL no Vite/Vercel frontend.
5. O endpoint `/api/v1/media/{id}/content` verifica publicação antes de emitir uma URL temporária. O bucket permanece privado. Configure `MEDIA_SIGNED_URL_SECONDS=900` para a duração das URLs.

## Limites iniciais

- JPG, PNG, WebP: 12 MB
- Novos GIFs e vídeos são recusados. Registros legados são preservados.
- MP3, WAV, OGG: 40 MB

O endpoint de exclusão verifica referências em cenas, capas/heroes de histórias e coleções, bloqueando mídia em uso. Arquivos locais nunca são removidos pelo endpoint. O fluxo visual, contratos e validação manual estão em [editorial-image-workflow.md](editorial-image-workflow.md).

## Upload de capa nos metadados da história

Em **Histórias → Editar → Capa da história** (ou **Hero da história**), clique em **Enviar imagem**, escolha um JPEG, PNG ou WebP de até 12 MB e aguarde a prévia. Depois clique em **Salvar história** para aplicar o vínculo. Não é necessário copiar UUIDs. A opção de referência existente continua disponível numa área expansível.

`StoryImageField` reutiliza `uploadAdminMedia` e o endpoint protegido de envio das cenas. Em histórias existentes, o upload informa `story_id`; histórias novas enviam o arquivo à biblioteca antes de receberem um ID. O salvamento existente de metadados persiste `cover_asset_id` e `hero_asset_id`, sem tocar em capítulos ou cenas. Não há endpoint ou migration adicional.

Durante o envio, salvar/cancelar/abrir capítulos ficam desabilitados. Se houver falha, a imagem anterior permanece; se apenas o salvamento falhar, o arquivo enviado continua selecionado para tentar salvar novamente sem reenviá-lo. Cancelar o formulário não exclui o arquivo já enviado da biblioteca. Os caches públicos são invalidados após salvar.

O resumo administrativo de capa inclui `resolved_url`, obtido pelo mesmo resolvedor das mídias de cena. Isso permite mostrar arquivos do bucket privado na listagem, além da prévia no editor. Falha temporária do Storage não impede o carregamento dos metadados.

Testes: `StoryCoverUpload.test.tsx` cobre upload, prévia, aplicação explícita, capa e hero em histórias novas, falhas e bloqueios. Os testes backend de metadados e fluxo editorial validam persistência e o contrato público em banco isolado, com Storage simulado; não enviam arquivos ao Supabase real.
