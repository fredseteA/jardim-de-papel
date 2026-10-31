// DEV-only fixture. Reuses the real reader and local art, never the remote API.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { StoryReader } from '../../src/features/reader/StoryReader';
import { OrientationPrompt } from '../../src/features/reader/ReaderEntry';
import { readReaderSettings, writeReaderSettings } from '../../src/features/reader/logic/readerCore';
import { chapeuzinhoVermelho } from '../../src/data/stories';
import '../../src/styles/globals.css';
const query = new URLSearchParams(location.search);
const long = 'Chapeuzinho caminhou entre as árvores, observando as flores e os pequenos animais que encontrava pelo caminho. A luz atravessava as folhas e desenhava manchas douradas na trilha. Ela segurou a cesta com cuidado e lembrou do conselho de sua mãe: seguir pelo caminho conhecido e não conversar com estranhos. Ao ouvir um pássaro cantar, parou por um instante, respirou fundo e sorriu. Ainda havia muito para descobrir naquela floresta, mas o abraço da vovó era o destino mais importante de sua aventura.';
const chars=Number(query.get('chars'));
const text = [150,350,500].includes(chars) ? long.slice(0,chars) : query.get('text') === 'short' ? 'A aventura começou no jardim.' : query.get('text') === 'medium' ? long.slice(0,250) : long.slice(0,500);
const font=Number(query.get('font'));
if(import.meta.env.DEV&&[14,18,28].includes(font))writeReaderSettings({...readReaderSettings(),fontSize:font,contrast:'auto'});
// Silent empty WAV only exercises the real audio-control layout in this fixture.
const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const story = { ...chapeuzinhoVermelho, id: 'reader-visual-demo', title: 'Prévia local — Chapeuzinho Vermelho', chapters: [{ ...chapeuzinhoVermelho.chapters[0], id: 'chapter-visual-demo', pages: [{ ...chapeuzinhoVermelho.chapters[0].pages[0], id: 'page-visual-demo', text, ...(query.has('audio') ? { narration: {src: silent}, music: {src:silent,loop:true} } : {}), illustration: { src: '/assets/stories/chapeuzinho-vermelho/cover/cover-hero.webp', alt: 'Ilustração local para teste do leitor.' }, presentation: { textEffect: 'none' as const } }] }] };
export function VisualReader() {
  const [prompt,setPrompt] = useState<'ask'|'rotate'|null>(()=>query.has('prompt')?'ask':null);
  if(prompt) return <OrientationPrompt waiting={prompt==='rotate'} onAccept={()=>setPrompt('rotate')} onContinue={()=>setPrompt(null)}/>;
  return <StoryReader story={story}/>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<MemoryRouter><VisualReader /></MemoryRouter>);
