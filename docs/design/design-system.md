# Design system inicial

Os tokens ficam em `src/styles/globals.css`: floresta (`#173B2C`), creme (`#F8F5ED`), marfim (`#FFFDF7`), dourado (`#B68A45`) e marrom editorial (`#614423`). Também centralizamos fonte, raio de card e sombra base.

Tailwind é usado para composição e responsividade; CSS Modules ficam reservados para componentes cujo estilo proprietário justifique isolamento. `globals.css` contém apenas reset, tokens, tipografia e regras de acessibilidade globais.

O container responde de 16px em celular para 24px/32px em telas maiores. Controles têm alvo mínimo de 44px, transições curtas e foco visível de alto contraste.

Na home, capas demonstrativas sem ilustração definitiva recebem fallback editorial simples. A única imagem gerada desta etapa fica em `public/assets/stories/semente-luminosa-demo.png`; ela deve ser substituída por arte aprovada antes de publicação.
