# Jardim de Papel V3

Fundação técnica da plataforma de histórias infantis ilustradas. O catálogo atual é estritamente demonstrativo e não representa conteúdo publicado.

## Desenvolvimento

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

## Verificações

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Estrutura

- `src/app`: composição do aplicativo e rotas.
- `src/components`: componentes reutilizáveis de UI, layout e histórias.
- `src/data`: catálogo de demonstração e contrato do repositório.
- `src/types`: modelo editorial compartilhado pelos modos de leitura.
- `src/pages`: telas e estados provisórios das rotas.
- `docs`: decisões de arquitetura, design e roteiro de implementação.
