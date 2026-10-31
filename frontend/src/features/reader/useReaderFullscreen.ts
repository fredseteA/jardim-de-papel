import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ReaderDisplayContext } from './ReaderDisplayContext';
import { createReaderDisplaySession } from './readerDisplaySession';

/** Shares display ownership with the orientation prompt; standalone previews
 * receive their own controller. Actual fullscreenchange is the source of truth. */
export function useReaderFullscreen(){
  const shared=useContext(ReaderDisplayContext);
  const own=useRef<ReturnType<typeof createReaderDisplaySession>|null>(null);
  const mounted=useRef(false),inFlight=useRef(false);
  const[active,setActive]=useState(()=>!!document.fullscreenElement);
  const[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    mounted.current=true;if(!shared)own.current=createReaderDisplaySession();
    const update=()=>{setActive(!!document.fullscreenElement);if(document.fullscreenElement)setMessage('');};
    document.addEventListener('fullscreenchange',update);update();
    return()=>{mounted.current=false;document.removeEventListener('fullscreenchange',update);const value=own.current;own.current=null;void value?.release();};
  },[shared]);
  const toggle=useCallback(async()=>{
    if(inFlight.current)return;
    const session=shared?.()??own.current;if(!session)return;
    inFlight.current=true;setBusy(true);setMessage('');
    try{
      const result=document.fullscreenElement?await session.exitFullscreen():await session.requestFullscreen();
      if(mounted.current){
        setActive(!!document.fullscreenElement);
        if(!result.ok)setMessage(result.reason==='busy'?'Há uma solicitação de tela cheia em andamento. Continue lendo e tente novamente.':'O navegador não permitiu alterar a tela cheia. Você pode continuar lendo e usar o botão do olho para recolher os controles.');
      }
    }catch{if(mounted.current)setMessage('Não foi possível alterar a tela cheia. A leitura continua disponível.');}
    finally{inFlight.current=false;if(mounted.current)setBusy(false);}
  },[shared]);
  return{active,busy,message,toggle,clearMessage:()=>setMessage('')};
}
