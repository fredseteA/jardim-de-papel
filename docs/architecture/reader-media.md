# Mídias de uma história no leitor

Cada objeto em `chapters[].pages[]` é uma cena independente. Seus campos `illustration`, `animation` e `narration` são opcionais e pertencem àquela cena: uma história com 20 cenas pode ter 20 imagens distintas, inclusive misturadas com vídeos e narrações em apenas algumas cenas. Os arquivos de demonstração atuais são reutilizados somente para demonstrar o leitor.

Os caminhos abaixo são exemplos de cadastro; os arquivos precisam existir em `public/` ou em outra URL acessível e autorizada. Não é necessário alterar os componentes do leitor para acrescentar as mídias.

```ts
// Em uma página de chapters[].pages[]:
{
  id: 'cena-01',
  order: 1,
  text: 'O texto desta cena.',
  illustration: {
    src: '/assets/stories/minha-historia/scenes/cena-01.webp',
    alt: 'Descrição da ilustração para leitores de tela.',
  },
  narration: { src: '/assets/stories/minha-historia/audio/cena-01.mp3' },
}
```

Uma imagem pode ser estática ou um formato animado compatível com o navegador, como GIF ou WebP animado. Para usar vídeo na cena, acrescente `animation`; no modo imersivo ele tem prioridade sobre `illustration`, que serve como imagem de reserva se o vídeo falhar. No modo tradicional, a imagem ou o `poster` é apresentada entre os textos.

```ts
animation: {
  src: '/assets/stories/minha-historia/scenes/cena-02.mp4',
  poster: {
    src: '/assets/stories/minha-historia/scenes/cena-02-poster.webp',
    alt: 'Descrição da cena.',
  },
  loop: true,
  muted: true,
  playbackBehavior: 'on-page-enter',
},
```

`on-page-enter` inicia o vídeo silencioso ao entrar na cena; `manual` oferece um botão para iniciá-lo; `with-narration` acompanha a reprodução da narração daquela cena. O vídeo visual é reproduzido sem som para não conflitar com narração e música. Para movimento reduzido, o leitor usa a imagem estática ou o `poster`; para imagens animadas, forneça uma versão estática quando for necessário garantir essa preferência.

A música é configurada uma vez na história, fora das páginas:

```ts
audio: {
  backgroundMusic: {
    src: '/assets/stories/minha-historia/audio/tema.mp3',
    loop: true,
  },
},
```

Ao existir música, o leitor oferece o botão **Ativar música**; depois, é possível silenciá-la ou reativá-la. A faixa continua entre cenas e capítulos e encerra ao concluir ou sair da história. A narração é independente, iniciada pelo botão da própria cena e interrompida ao mudar de cena. Nenhum áudio é iniciado antes de uma escolha do usuário. A disponibilidade e os formatos reproduzíveis dependem do arquivo e do navegador; falhas são informadas na interface.
