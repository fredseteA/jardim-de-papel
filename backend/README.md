# API Jardim de Papel

Requisitos: Python 3.12 ou 3.13 e PostgreSQL. Na pasta `backend`:

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -e ".[test]"
cp .env.example .env  # se não existir; mantenha sua configuração atual
uvicorn app.main:app --reload
pytest
```

`DATABASE_URL` aceita `postgresql://` ou `postgresql+psycopg://`, usando Psycopg 3; use o Session Pooler Supabase com TLS configurado pelo provedor. `CORS_ORIGINS` é uma lista JSON de origens. Nunca publique `.env`. Swagger: `/docs`. `/health` verifica o processo; `/health/ready` executa exclusivamente `SELECT 1` no banco e retorna 503 se não estiver disponível.

A API pública é somente leitura. Catálogo: `GET /api/v1/collections`, `/api/v1/collections/{slug}`, `/api/v1/stories`, `/api/v1/stories/{slug}`, `/api/v1/stories/{slug}/chapters` e `/api/v1/stories/{slug}/reading`. Listas aceitam `limit` (1–100) e `offset`; histórias também aceitam `collection` como slug de coleção publicada. Nenhuma rota administrativa está disponível.

## Migrations

`alembic upgrade head --sql` gera SQL para revisão sem executar alterações. A migration `0001_initial` cria 11 tabelas e índices; **não foi aplicada remotamente**. Antes de aplicar, confirme separadamente o projeto e banco de destino sem divulgar a senha; revise SQL, permissões, objetos existentes e backup; obtenha autorização explícita. Só depois execute `alembic upgrade head`. Nunca use downgrade/reset em banco com dados sem plano e aprovação: o downgrade inicial remove tabelas. Para novas alterações, revise `alembic revision --autogenerate -m "descrição"` antes de aplicar; autogeração não substitui revisão.

Os testes padrões não usam o banco remoto. Os testes de integração opcionais exigem um PostgreSQL **local e isolado**, com nome começando por `test_`, informado em `TEST_DATABASE_URL`; eles criam e removem um schema temporário. Nunca informe o Supabase nessa variável.

## Importação editorial

Consulte [o inventário e procedimento de Chapeuzinho](../docs/chapeuzinho-content-migration.md). O importador não aplica migrations nem apaga conteúdo. Revise o JSON exportado e confirme o ambiente antes de executar.
