# Integração entre frontend e backend

O React obtém coleções, catálogo e estrutura de leitura na API FastAPI; o PostgreSQL é a fonte do conteúdo publicado. O navegador não recebe credenciais do banco. Não há fallback silencioso para os mocks quando a API falha: a interface informa o erro e oferece nova tentativa.

## Ambiente local

Configure `backend/.env` com a conexão PostgreSQL já existente, sem versioná-la. Copie `frontend/.env.example` para `frontend/.env` e ajuste `VITE_API_BASE_URL=http://127.0.0.1:8000`. No diretório `backend`, inicie `uvicorn app.main:app --host 127.0.0.1 --port 8000` no ambiente virtual; em `frontend`, execute `npm install` e `npm run dev -- --host 127.0.0.1 --port 5173`. O CORS de desenvolvimento permite localhost e 127.0.0.1 na porta 5173. Configure explicitamente as origens autorizadas no ambiente de produção.

## Fluxo e contratos

`src/lib/api/client.ts` concentra requisições, timeout de 15 segundos, cancelamento e erros; `services.ts` define os acessos e `types.ts` os DTOs. O catálogo usa `GET /api/v1/stories` (paginação e filtros `q`, `collection`, `min_minutes`, `max_minutes`), coleções usam `GET /api/v1/collections` e `GET /api/v1/collections/{slug}`; abertura e leitor usam `GET /api/v1/stories/{slug}/reading`, que retorna capítulos, cenas e mídias. `adapters.ts` converte esses DTOs para os contratos existentes de livros e leitor. Somente conteúdo publicado é exposto pela API.

As referências de mídia `frontend` são resolvidas a partir de `/assets/` no Vite; URLs HTTP(S) são usadas diretamente. O projeto importado mantém metadados de compatibilidade em `jdp_import_v1`, inclusive identificadores antigos, prévias e informações editoriais. Mídias com outros provedores de armazenamento ainda precisam de uma estratégia de URLs públicas ou assinadas; não são expostas credenciais ao navegador.

## Busca, progresso e erros

Busca, coleção e duração são combinadas pelo servidor; paginação usa limite e deslocamento. A busca tolera acentos e erros de digitação. O progresso e favoritos permanecem locais; ao abrir uma história importada, `progress.ts` copia o progresso antigo para a chave UUID somente quando capítulo e cena são identificáveis, sem apagar o registro anterior. Mudanças futuras nos IDs exigem mapeamento estável. Estados de carregamento e erros são exibidos, e requisições são canceladas ao sair da tela.

## Testes

No frontend execute `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`. No backend execute `python -m pytest`; testes de integração PostgreSQL exigem um banco de testes isolado, nunca o Supabase de desenvolvimento. O endpoint `/health` e os endpoints de catálogo/leitura também podem ser consultados em modo somente leitura para verificar a integração real.

## Limitações e produção

A busca textual atualmente filtra registros publicados em memória no servidor antes de paginar; para catálogos grandes, substitua por busca indexada no PostgreSQL mantendo os contratos. As páginas de detalhes de coleção e perfil atualmente consultam até 100 histórias, e favoritos antigos são reconhecidos por seus identificadores legados. Os placeholders de destaque da Home e metadados visuais locais de apresentação continuam sendo apenas elementos da interface; não são histórias publicadas. Prévia e música legadas referenciadas por metadados usam caminhos locais `/assets/`. A sincronização de progresso e favoritos entre dispositivos, autenticação, uploads, CDN e URLs assinadas não fazem parte desta fase. Em produção, configure `VITE_API_BASE_URL` com a URL HTTPS pública da API, CORS restrito e a publicação dos arquivos de mídia; nunca use localhost ou inclua a URL de conexão PostgreSQL no frontend.
