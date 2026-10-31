# Composição visual das cenas

> O leitor atual usa fluxo de livro, sem sobreposição livre de narrativa e arte. Os contratos abaixo continuam preservados para compatibilidade; o editor identifica seus controles antigos nessa condição. Veja [reader-illustrated-layout.md](reader-illustrated-layout.md) para a apresentação atual e sua validação.

## Diagnóstico da imagem de fundo

Os dois campos anteriores gravavam vínculos independentes em `scene_media`: `illustration` e `background`. O adaptador prioriza `illustration`; o fundo só é usado como fallback quando ela está ausente. Não eram duas camadas visuais sobrepostas. Por isso configurar um fundo junto de uma ilustração não produzia diferença.

A interface agora apresenta apenas **Imagem da cena**. `primarySceneImage()` é a regra compartilhada entre editor e leitores: menor `display_order` de ilustração primeiro, depois fundo. Ao trocar uma imagem legada, o editor atualiza o vínculo que já está ativo, inclusive seu papel e posição; em cenas novas usa `illustration` na posição zero. Vínculos antigos adicionais permanecem intactos. Nenhum arquivo ou vínculo foi apagado por esta atualização. Se uma remoção manual revelar outro vínculo legado, a mesma regra de prioridade é aplicada. Narração, música e efeitos sonoros continuam separados.

## Dados e API

O JSONB `scenes.presentation_config` já existe e contém:

```json
{
  "composition": {
    "version": 1,
    "revision": 1,
    "layouts": {
      "portrait": { "text_x": 0, "text_y": 90, "image_x": 50, "image_y": 50, "zoom": 1 },
      "landscape": { "text_x": 0, "text_y": 0, "image_x": 65, "image_y": 50, "zoom": 1.2 },
      "tablet": { "text_x": 20, "text_y": 30, "image_x": 50, "image_y": 50, "zoom": 1 }
    }
  }
}
```

Sem migration ou nova tabela. Formatos ausentes usam defaults derivados da posição editorial antiga, com imagem centralizada, zoom 1 e largura de texto responsiva. Coordenadas têm limites 0–100; zoom 1–3. Valores infinitos, formatos desconhecidos e payloads vazios são rejeitados pelo Pydantic.

`PATCH /api/v1/admin/stories/{story}/chapters/{chapter}/scenes/{scene}/composition` recebe `expected_revision` e `layouts`. Exige administrador, verifica pertencimento, bloqueia a linha da cena, confere a revisão e incrementa a versão da edição. Revisão antiga recebe 409. Formatos não enviados, metadados importados, narrativa e mídias são preservados. O formulário de texto não envia composição, e o endpoint geral também impede que uma cópia antiga de `presentation_config` sobrescreva a composição atual.

O salvamento não fecha o editor. Falhas preservam os ajustes locais. Ao sair com alterações, é possível salvar, descartar ou continuar. A navegação fora da aba também avisa sobre mudanças pendentes. Um conflito exige reabrir a cena para carregar a revisão atual; não há merge automático de edições concorrentes.

## Regras de composição e responsividade

- Texto: x/y representam o percentual do **deslocamento disponível dentro da área segura**, descontando a largura/altura do bloco. Zero alinha ao início e 100 ao fim. Isso mantém o bloco dentro da área útil mesmo em telas menores ou com texto longo.
- A área segura é medida entre header e footer reais do leitor; suas dimensões incluem safe areas do aparelho. Texto mantém altura limitada e rolagem interna. As guias e alças aparecem só durante edição.
- A imagem usa escala equivalente a `cover` multiplicada pelo zoom. Seu deslocamento usa apenas a região excedente, mantendo proporção e evitando bordas vazias. Arraste e controles alteram só números; o arquivo original não é recortado.
- Formato: áreas com largura >=768 e altura >=600, ou largura >=1180, usam tablet/desktop. Nas demais, largura maior que altura usa horizontal; o restante usa vertical. A medida vem da área efetiva do leitor via ResizeObserver, não apenas da largura da janela.
- Orientação e resize atualizam somente a apresentação da cena. Não navegam, não remontam o leitor e não alteram o progresso.
- Com composição configurada, o enquadramento permanece estável: movimentos automáticos de câmera não deslocam o recorte escolhido. Revelação textual e demais transições CSS continuam disponíveis.
- Imagens locais, privadas e sprites legados usam a mesma resolução de mídia existente. O leitor tradicional continua recebendo a mesma imagem principal, sem aplicar o recorte imersivo à página tradicional.

## Prévia

`CompositionEditor` reutiliza `SceneRenderer`, `sceneToReaderPage`, estilos do header/footer e controles de áudio. O canvas usa uma resolução de referência e é reduzido visualmente, sem reduzir as coordenadas salvas. As regras do chrome usam container queries para responder ao aparelho simulado, inclusive quando o editor está aberto no desktop. O texto em edição pode aparecer na prévia; salvar composição não salva esse texto. Os vínculos de mídia usados já estão persistidos. As preferências pessoais de fonte/contraste do leitor podem alterar a altura do bloco, que continua limitado à área segura.

Arraste usa Pointer Events, captura de ponteiro, conversão da escala da prévia e cancelamento adequado. Setas movem em passos de 1%, Shift em 5%. Sliders oferecem alternativa acessível ao gesto. “Ver resultado” remove ferramentas e libera a seleção/rolagem do texto.

## Arquivos

- Novos: `backend/app/modules/stories/composition.py`, `backend/tests/test_composition.py`, `frontend/src/lib/sceneComposition.ts`, `sceneComposition.test.ts`, `frontend/src/features/reader/useSceneViewport.ts`, `frontend/src/features/admin/CompositionEditor.tsx`, `CompositionEditor.module.css`, `CompositionEditor.test.tsx`.
- Alterados: `chapter_scene_service.py`, `admin_content.py`, `ChapterSceneEditor.tsx`, `SceneMediaManager.tsx`, `SceneRenderer.tsx`, `SceneRenderer.module.css`, `StoryReader.tsx`, `StoryReader.module.css`, `types/story.ts`, `lib/api/adapters.ts`.
- Fixture isolada de desenvolvimento: `frontend/tests/visual/composition.html` e `composition.tsx`. Não cria rota de produção e não é usada pelo leitor. Não use seu botão salvar para editar conteúdo real: IDs demonstrativos são rejeitados pela API.

## Validação manual

1. Reinicie o backend atualizado e abra uma cena pelo painel.
2. Clique **Editar composição**. O salvamento da composição é separado do texto.
3. Escolha horizontal, arraste o texto, ajuste zoom e arraste a imagem.
4. Troque para vertical e tablet e configure posições distintas. Retorne ao primeiro formato para confirmar a independência.
5. Teste restaurar e copiar para outro formato. Confira **Ver resultado** e a rolagem de textos longos.
6. Clique **Salvar composição**, aguarde confirmação, recarregue e reabra a cena.
7. Abra o leitor, redimensione/gire a tela e confirme que a cena/progresso não mudou e a composição correspondente foi aplicada.
8. Teste Escape com alterações pendentes: salvar, descartar ou continuar. Teste uma falha de API e tente salvar novamente.

## Verificações e limites

### Feedback e tamanho de texto na prévia

O editor tem controle de tamanho de texto apenas para simulação: Mínimo (14), Padrão (18), Máximo (28) e slider contínuo. Esses limites são compartilhados com o leitor por `lib/readerTextSettings.ts`; não entram no payload da composição e não mudam as preferências pessoais do usuário.

Após gravar, mensagens confirmam explicitamente texto, capítulo, história, mídia e composição. O botão da composição mostra “Composição salva”, com `aria-busy=false`, e fica indisponível apenas enquanto não houver novas alterações. Cursor de espera é reservado às operações em andamento.

Texto e capítulo aplicam diretamente a resposta persistida da API, sem aguardar uma segunda consulta para encerrar o estado de salvamento. As operações têm prazo total de 30 segundos, incluindo renovação de sessão e leitura do corpo da resposta; uploads têm 90 segundos. Se esse prazo expirar, a mensagem informa que não foi possível confirmar o resultado e recomenda verificar antes de repetir. Não se presume que o servidor desfez uma transação já concluída. Campos locais são preservados em falhas. Respostas HTML inesperadas não são interpretadas como sucesso.

A fixture visual demonstra esses controles, mas sua gravação é desabilitada e identificada como demonstração. Conteúdo real deve ser editado em `/admin/stories`.

Testes HTTP usam banco SQLite temporário para gravação, recarga, preservação de outros campos, conflitos de revisão e serialização pública. O teste PostgreSQL específico continua dependendo de `TEST_DATABASE_URL` local; o banco Supabase de conteúdo não é usado em testes.

A inspeção real de navegador foi feita com a fixture local: texto arrastado, zoom até 3×, enquadramento arrastado, alternância dos três formatos e ausência de overflow horizontal em 390px. Isso não equivale a salvar a composição de Chapeuzinho no banco remoto; nenhum dado editorial remoto foi modificado. A interface usa Pointer Events para toque, mas a conferência em aparelho físico continua recomendada.

Verificações finais: lint, TypeScript e build aprovados; 63 testes do frontend e 49 do backend aprovados. Um teste de integração PostgreSQL foi ignorado por falta de banco local configurado. A suíte backend foi executada fora do sandbox, onde o TestClient funciona normalmente. Continuam os avisos conhecidos de chunk do Vite acima de 500 kB, API de pause do jsdom e depreciação do transporte TestClient, sem falhas nas suítes.
