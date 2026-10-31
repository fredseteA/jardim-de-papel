# Instalação inicial como PWA

O frontend agora possui manifest instalável, ícones oficiais, favicon, suporte ao ícone iOS, modo standalone e service worker mínimo de produção. A orientação não é bloqueada: o leitor continua oferecendo a escolha existente. Nenhuma dependência nova foi instalada.

## Como testar no celular

1. Publique o conteúdo do build em um endereço **HTTPS**. Na Vercel existente, o Root Directory continua `frontend`; comando `npm run build`, saída `dist`. Esta implementação não faz deploy, commit ou push.
2. O build precisa ter `VITE_API_BASE_URL` apontando para uma API HTTPS acessível pelo celular. `localhost` e `127.0.0.1` no telefone são o próprio telefone, não o computador. O CORS da API deve permitir a origem pública do frontend. Não envie `.env` ou credenciais do backend para a hospedagem.
3. **Android / Chrome:** abra o endereço HTTPS, menu ⋮ → Instalar aplicativo ou Adicionar à tela inicial (o nome varia conforme o navegador). Confirme a instalação.
4. **iPhone / Safari:** abra o endereço HTTPS, Compartilhar → Adicionar à Tela de Início; mantenha Abrir como App habilitado se essa opção aparecer. Confirme.
5. Abra pelo novo ícone Jardim de Papel. O aplicativo inicia na Home, em janela independente; a splash é produzida pelo sistema a partir do manifest/ícones.

As rotas de autenticação continuam iguais. Ao usar outro domínio/preview, revise as origens e redirecionamentos autorizados no Supabase Auth antes de testar o painel. Nenhuma configuração remota é alterada automaticamente.

## Build e pacote

```powershell
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

O preview usa `http://127.0.0.1:4173` no próprio computador, onde localhost é aceito como contexto seguro. Acesso por IP da rede local via HTTP **não** atende ao requisito de instalação PWA no celular; use a hospedagem HTTPS existente. Não é necessário abrir portas, criar túneis públicos ou desabilitar proteções do navegador.

O pacote `artifacts/jardim-de-papel-pwa.zip`, quando gerado, contém somente `frontend/dist`: é um pacote para hospedagem estática, não um APK nem um ZIP que se instala no telefone. A instalação é realizada pelo navegador a partir do site HTTPS publicado.

Ao usar outro servidor estático para o ZIP, configure fallback SPA para `index.html` nas rotas do aplicativo, preserve arquivos reais como `sw.js`/manifest e use `application/manifest+json` para o manifest. As regras Vercel estão em `frontend/vercel.json`, fora do ZIP de conteúdo estático.

## Logos e ícones

A fonte oficial é `frontend/public/assets/branding/logo-symbol.png`: árvore sobre livro aberto, sem o texto longo da marca. O arquivo original permanece intacto.

- `public/pwa/icon-192.png`, `icon-512.png`: ícones comuns.
- `icon-maskable-512.png`: variante com margem de segurança para máscaras Android.
- `apple-touch-icon.png`: 180×180, fundo creme opaco.
- `favicon-32.png`, `favicon-48.png`: ícones do navegador.

Para regenerá-los no Windows: `./scripts/generate-pwa-icons.ps1` dentro de `frontend`. O script recorta apenas margens transparentes e redimensiona a logo oficial proporcionalmente sobre creme, sem redesenhar a marca. Nome, splash e cores são configurados em `public/manifest.webmanifest`; links/meta estão em `index.html`.

## Service worker e atualizações

`pwa/plugin.ts` gera `dist/sw.js` com uma versão derivada dos hashes do bundle e dos assets PWA. Registro somente em produção e contexto seguro, em `src/pwa/register.ts`. O modo dev não instala workers novos.

O worker armazena apenas uma lista explícita de JS/CSS de build, ícones, manifest e página de desconexão. Navegações públicas usam rede; sem conexão, mostram `offline.html`. API, administração, autenticação, requisições com Authorization, outros domínios e mídias das histórias não são interceptados por esse cache. O cache completo de preparação do leitor mantém sua implementação e namespace próprios.

Atualizações aguardam fechar as janelas antigas; não existe reload ou ativação forçada durante a leitura. A ativação limpa apenas versões antigas de `jdp-pwa-shell-*`, preservando o cache das histórias, progresso e preferências. Isso não implementa catálogo offline completo, notificações, push, sincronização ou instalação nativa.

## Validação

Verifique no build servido por HTTPS/localhost: manifest JSON, PNGs com dimensões corretas, `sw.js` JavaScript sem fallback HTML, favicon e apple-touch-icon. Os testes em `pwa/serviceWorker.test.ts` validam as políticas de cache, navegação offline, isolamento da administração/API, preservação do cache do leitor e dimensões reais dos ícones. A confirmação final de instalação requer abrir o endereço publicado em Android/iOS reais.

Resultado local: 160 testes aprovados, lint sem avisos, TypeScript e build aprovados. Preview de produção retornou HTTP 200 e MIME correto para manifest, worker, ícones e página offline; a rota `/biblioteca` respondeu com o fallback HTML. O ZIP foi inspecionado e contém manifest/worker, sem `.env` ou backend. Permanece o aviso anterior de bundle acima de 500 kB. Não houve instalação em aparelho físico, deploy ou alteração remota.
