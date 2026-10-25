# Arquitetura da API

A API é um monólito modular. `app/core` concentra configuração, sessão e conexão; `app/models` contém o modelo relacional; `app/api/v1` fornece consultas de leitura e contratos Pydantic. O frontend continua independente e não importa o backend. A API não usa mocks do frontend. Rotas de escrita, autenticação e painel são etapas futuras.

## Entidades

`collections` e `stories` têm relacionamento muitos-para-muitos via `collection_stories`; capítulos pertencem a histórias e cenas a capítulos. `media_assets` guarda referências e metadados, não binários; `scene_media` associa mídias, papéis, ordem e configuração. `users` representa responsáveis; `reading_profiles` representam leitores; `reading_progress` e `favorites` são únicos por perfil e história. FKs compostas garantem que capítulo e cena de progresso pertençam à história. Ordens por capítulo e cena são únicas, e status e porcentagem têm checks. Somente conteúdo publicado é retornado publicamente.

A API de leitura entrega dados e referências de mídia, mas os campos ainda não reproduzem automaticamente o contrato TypeScript: um adaptador e uma política de URL pública/assinada são necessários. Não existe upload; caminhos de armazenamento são metadados. Defina buckets, validação de tipo/tamanho, acesso privado e URLs temporárias antes de publicar mídia. Não armazene credenciais no frontend.

O pool SQLAlchemy é limitado e usa pre-ping com Session Pooler; falhas retornam 503 genérico. TLS não é desativado. Não há cadastro ou autorização nesta etapa; as tabelas de usuário não conferem acesso. O futuro sistema deve autenticar responsáveis e verificar a propriedade do perfil em cada operação, minimizando dados infantis. Não exponha endpoints administrativos ou progresso sem essas garantias.

O contrato de detalhe e leitura agora inclui `cover_asset` e `hero_asset`; o detalhe da coleção inclui `cover_asset`. A estratégia transitória de metadados legados está descrita em [chapeuzinho-content-migration.md](chapeuzinho-content-migration.md).
