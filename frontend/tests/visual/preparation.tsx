// DEV-only visual preview. No remote API, editorial writes or production mocks.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdventureLoading } from '../../src/features/reader/preparation/AdventureLoading';
import { StoryPreparation } from '../../src/features/reader/preparation/StoryPreparation';
import { StoryReader } from '../../src/features/reader/StoryReader';
import type { Story } from '../../src/types/story';
import '../../src/styles/globals.css';
const query=new URLSearchParams(location.search);
const sources=['cesta-demonstrativa','floresta-demonstrativa','encontro-demonstrativo','casa-vovo-demonstrativa'];
const story:Story={id:'preparation-visual-demo',slug:'preparation-visual-demo',title:'Prévia local — Chapeuzinho Vermelho',description:'',synopsis:'',collectionId:'',collectionDescription:'',ageRange:'',language:'pt-BR',status:'published',chapters:[{id:'demo-chapter',slug:'demo',title:'Prévia',order:0,pages:sources.map((name,index)=>({id:`demo-${index}`,order:index,text:'Uma prévia local da aventura. Estas cenas demonstrativas verificam o carregamento antes da leitura.',illustration:{src:`/assets/stories/chapeuzinho-vermelho/scenes/${name}.webp`,alt:`Cena demonstrativa ${index+1}`},presentation:{textEffect:'none'}}))}]};
export function Preview(){
  const[started,setStarted]=useState(false);
  if(query.has('flow'))return started?<StoryPreparation story={story} onBack={()=>setStarted(false)}>{prepared=><StoryReader story={prepared}/>}</StoryPreparation>:<button style={{margin:32,padding:16}} onClick={()=>setStarted(true)}>Testar preparação real com quatro imagens locais</button>;
  return <AdventureLoading title={story.title} progress={{loaded:8,total:20}} error={query.has('error')?'Não foi possível buscar um arquivo. Esta é uma prévia visual local.':undefined} onRetry={()=>location.assign('preparation.html?flow=1')} onBack={()=>location.assign('preparation.html?flow=1')}/>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')!).render(<MemoryRouter><Preview/></MemoryRouter>);
