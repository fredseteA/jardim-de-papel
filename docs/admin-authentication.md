# Autenticação administrativa

## Arquitetura e segurança

A área `/admin` tem layout separado do aplicativo público. `/admin/login` autentica com e-mail e senha pelo SDK oficial do Supabase Auth. O SDK restaura e renova a sessão; o frontend envia o access token via Bearer para `GET /api/v1/admin/me` e só mostra a área após uma resposta autorizada. O FastAPI verifica assinatura, algoritmo permitido, `iss`, `aud`, `exp`, `iat` e `sub` UUID; para ES256/RS256 obtém a chave pública do JWKS do projeto configurado. Para instalações legadas HS256, o segredo de assinatura deve ser configurado exclusivamente no backend. O backend consulta `users.auth_provider_subject` e exige `users.role = 'admin'`; um token ausente/inválido retorna 401, uma identidade sem permissão retorna 403. Não há endpoint de promoção nem senha armazenada na aplicação.

A migration `0002_user_role` adiciona apenas `role VARCHAR(20) NOT NULL DEFAULT 'reader'` e uma constraint que aceita `reader` e `admin`; todos os usuários existentes permanecem leitores. O vínculo pré-existente `auth_provider_subject` continua único. A migration foi aplicada ao banco de desenvolvimento e está registrada como `0002_user_role`. Ela não altera a importação de Chapeuzinho ou o schema editorial. O downgrade remove o campo e a constraint e é destrutivo para os papéis: não execute sem revisar e autorizar explicitamente.

## Ambiente

Frontend (Vite/Vercel): `VITE_API_BASE_URL` é a URL pública da API; `VITE_SUPABASE_URL` é a URL HTTPS do mesmo projeto Supabase; `VITE_SUPABASE_PUBLISHABLE_KEY` é a chave publicável (ou anon pública compatível). Essas variáveis são incorporadas ao build. Nunca use `service_role`, segredo JWT ou credenciais PostgreSQL no frontend.

Backend (Render/ambiente local): mantenha `DATABASE_URL` privada; configure `SUPABASE_URL` com a URL HTTPS do projeto, `SUPABASE_JWT_AUDIENCE=authenticated` (ou a audiência real dos seus tokens) e `CORS_ORIGINS` como JSON com as origens autorizadas da Vercel e desenvolvimento. O backend permite `Authorization` nos headers CORS. Para uma chave assimétrica, o JWKS em `https://<projeto>.supabase.co/auth/v1/.well-known/jwks.json` deve estar acessível. Se o projeto ainda usa HS256, configure `SUPABASE_JWT_SECRET` apenas no backend com o segredo de assinatura real, de pelo menos 32 bytes. Confirme o algoritmo efetivo em Supabase Auth antes de escolher; não configure uma chave pública ou service role como segredo JWT. Documentação oficial: https://supabase.com/docs/guides/auth/signing-keys e https://supabase.com/docs/guides/auth/jwts.

No painel Supabase, confirme que autenticação por senha está habilitada e configure a política de cadastro para não abrir criação pública de contas administrativas. Uma conta Auth comum não recebe acesso administrativo por padrão. Não use `app_metadata` ou campos enviados pelo cliente para conceder acesso.

## Primeira conta — procedimento restrito

1. Confirme que o banco de destino está na revisão `0002_user_role`. Em novos ambientes, revise e autorize explicitamente a aplicação da migration antes de prosseguir. Não aplique em produção sem a aprovação apropriada.
2. No Supabase Auth, utilize uma conta já existente e verifique manualmente o UUID exato do usuário que deve ser administrador. Não compartilhe a senha, a chave de serviço ou a URL privada de banco em conversas ou logs.
3. Após autorização explícita para conceder esse acesso, conecte-se usando um operador de banco autorizado e execute a transação a seguir, substituindo `UUID_DO_USUARIO_AUTH` pelo UUID conferido. Ela é idempotente e não cria usuário Auth:

```sql
BEGIN;
INSERT INTO users (id, auth_provider_subject, role)
VALUES (gen_random_uuid(), 'UUID_DO_USUARIO_AUTH', 'admin')
ON CONFLICT (auth_provider_subject) DO UPDATE
SET role = 'admin', updated_at = now();
COMMIT;
```

Confirme que a identidade existe no Auth antes de executar; o banco da aplicação não consulta `auth.users` automaticamente. A associação e a permissão são verificadas no servidor. Revogue o acesso mudando o papel para `reader` por procedimento administrativo autorizado; tokens já emitidos permanecem sujeitos à validade definida pelo Supabase, mas cada chamada administrativa consulta o papel atual no banco.

## Execução e verificação

Instale dependências do backend com `uv pip install --python .venv312/Scripts/python.exe -e ".[test]"` ou outro ambiente Python 3.12/3.13 equivalente. Configure `.env` local sem versioná-lo e inicie `uvicorn app.main:app --reload --port 8000` em `backend/`. Em `frontend/`, configure `.env` a partir de `.env.example`, execute `npm install` e `npm run dev`; acesse `/admin/login`. Em Render e Vercel as variáveis são configuradas nos respectivos ambientes antes de um deploy autorizado; este trabalho não faz deploy.

Testes: backend `python -m pytest -q`; frontend `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`. Os testes usam contas, chaves e sessões simuladas, sem gravar no Supabase. Há testes criptográficos HS256 e ES256, emissor/audiência, expiração, ausência de token, permissão e respostas da API. A validação com login real e banco migrado depende das configurações e autorização acima; ela não foi executada nesta etapa.

## Limitações

O SDK persiste a sessão no armazenamento do navegador; proteja o frontend contra XSS e use HTTPS, política de segurança de conteúdo e dependências atualizadas. A verificação criptográfica local não consulta o Supabase para revogação imediata de um JWT já emitido: mudanças no papel são refletidas imediatamente pelo banco, enquanto a expiração/revogação de identidade depende do ciclo de vida do token. O logout implementado encerra a sessão local do dispositivo; não encerra outras sessões. Os cards são apenas indicação de funcionalidades futuras, sem CRUD.

## Recuperação de senha administrativa

`/admin/forgot-password` solicita a recuperação pelo cliente Supabase já configurado e sempre apresenta a mesma confirmação, independentemente de o e-mail existir. O redirecionamento é construído a partir da origem atual para `/admin/reset-password`; a tela conclui callbacks PKCE (`?code=`) e implícitos (`#type=recovery...`) sem habilitar detecção global de URLs para a área administrativa.

No Supabase Auth > URL Configuration, mantenha na lista de **Redirect URLs** pelo menos:

- `http://localhost:5173/admin/reset-password`
- A URL de produção equivalente, por exemplo `https://SEU-DOMINIO/admin/reset-password`

Confirme também que o template de e-mail de recuperação usa `{{ .ConfirmationURL }}` ou respeita `{{ .RedirectTo }}`. A página de redefinição só chama `updateUser({ password })` depois de validar o callback e uma sessão de recuperação na mesma aba; ao concluir, encerra a sessão local e remove a prova temporária. Uma sessão de recuperação nunca é tratada como autorização de administrador: o backend continua exigindo token válido e `users.role = 'admin'` para `/api/v1/admin/me`.
