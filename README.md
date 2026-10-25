# Jardim de Papel V3

Aplicativo de histórias infantis: frontend React em `frontend/`, API FastAPI em `backend/` e documentação em `docs/`.

Para executar o frontend, use `cd frontend`, `npm ci` e `npm run dev`. Verificações: `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`. Veja [backend/README.md](backend/README.md) para a API.

Na Vercel, configure **Root Directory** como `frontend`. O arquivo `frontend/vercel.json` fornece o fallback para as rotas client-side. A configuração remota não é alterada pelo repositório.

O catálogo atual do frontend é demonstrativo. A API não é integrada a ele nesta etapa.

## Integração local frontend/backend

Consulte [docs/frontend-backend-integration.md](docs/frontend-backend-integration.md) para configuração, endpoints e limitações. A variável pública do frontend é `VITE_API_BASE_URL`; credenciais de banco ficam exclusivamente no backend.
