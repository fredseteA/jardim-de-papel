import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { StoryPage } from '../../types/story';
import type { SceneFormat, SceneLayout } from '../../lib/sceneComposition';
import { sceneFormat } from '../../lib/sceneComposition';
import { useSceneViewport } from './useSceneViewport';
import { illustratedLayout, isPhoneLandscape } from './readerViewport';
import styles from './SceneRenderer.module.css';

type SceneRendererProps = {
  page: StoryPage; sceneIndex: number; revealed: boolean; reducedMotion: boolean;
  narrationPlaying: boolean; hasAudio: boolean; onReveal: () => void;
  fontSize?: number; lineHeight?: number; contrast?: 'auto'|'dark'|'light';
  onToggleControls?: () => void; format?: SceneFormat;
  // Retained for existing editor callers/data contracts. Book flow owns placement.
  editMode?: 'text'|'image'; onLayoutChange?: (layout: SceneLayout) => void;
};

/** One media tree and one text tree across all breakpoints: rotation never
 * remounts playback. Phone landscape scrolls the paper; other layouts scroll
 * the illustrated page as a whole. */
export function SceneRenderer({page,sceneIndex,revealed,reducedMotion,narrationPlaying,hasAudio,onReveal,fontSize=18,lineHeight=1.65,contrast='auto',onToggleControls,format:forcedFormat}:SceneRendererProps){
  const rootRef=useRef<HTMLDivElement>(null);
  const viewport=useSceneViewport(rootRef);
  const layout=illustratedLayout(viewport.readerWidth,viewport.readerHeight);
  const compactLandscape=isPhoneLandscape(viewport.readerWidth,viewport.readerHeight);
  const format=forcedFormat??sceneFormat(viewport.readerWidth,viewport.readerHeight);
  const [natural,setNatural]=useState({width:4,height:3});
  const [imageFailed,setImageFailed]=useState(false);
  const [videoFailed,setVideoFailed]=useState(false);
  const [videoPlaying,setVideoPlaying]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const illustration=page.illustration;
  const canPlayVideo=page.animation&&!reducedMotion&&!videoFailed;
  const fallback=illustration??page.animation?.poster;
  const effect=page.presentation?.textEffect??'words';
  const artMotion=!reducedMotion&&page.presentation?.motion!=='none';
  const tokens=page.text.split(/(\s+)/u).filter(Boolean);
  useEffect(()=>{setImageFailed(false);setNatural({width:4,height:3});},[page.illustration?.src,page.animation?.poster?.src]);
  useEffect(()=>{setVideoFailed(false);setVideoPlaying(false);},[page.animation?.src]);
  useEffect(()=>{const node=rootRef.current;if(node)node.scrollTop=0;},[page.id]);
  useEffect(()=>{const video=videoRef.current;return()=>{video?.pause();};},[page.animation?.src]);
  useEffect(()=>{
    const video=videoRef.current;
    if(!video||page.animation?.playbackBehavior!=='with-narration')return;
    if(narrationPlaying)void video.play().catch(()=>{});else video.pause();
  },[narrationPlaying,page.animation?.playbackBehavior]);
  async function toggleVideo(){
    const video=videoRef.current;if(!video)return;
    if(!video.paused){video.pause();return;}
    try{await video.play();}catch{setVideoFailed(true);}
  }
  const mediaStyle={aspectRatio:compactLandscape?undefined:`${natural.width} / ${natural.height}`,maxHeight:!compactLandscape&&layout==='spread'?Math.max(120,viewport.height-16):undefined,'--scene-art':fallback?.src&&!imageFailed&&!fallback.spritePosition?`url(${JSON.stringify(fallback.src)})`:'none'} as CSSProperties;
  return <div ref={rootRef} className={styles.scene} role="region" aria-label="Página ilustrada da história" tabIndex={compactLandscape?undefined:0} data-format={format} data-layout={layout} data-phone-landscape={compactLandscape} data-art-motion={artMotion} data-audio={hasAudio} data-reduced-motion={reducedMotion} style={{'--scene-font-size':`${fontSize}px`,'--reader-line-height':lineHeight} as CSSProperties}>
    <div className={styles.spread}>
      <div className={styles.visual} data-scene-illustration style={mediaStyle} onClick={onToggleControls}>
        {canPlayVideo?<video ref={videoRef} className={styles.image} src={page.animation?.src} poster={page.animation?.poster?.src??illustration?.src} autoPlay={!page.animation?.playbackBehavior||page.animation.playbackBehavior==='on-page-enter'} muted loop={page.animation?.loop} playsInline onLoadedMetadata={event=>{const v=event.currentTarget;if(v.videoWidth&&v.videoHeight)setNatural({width:v.videoWidth,height:v.videoHeight});}} onPlay={()=>setVideoPlaying(true)} onPause={()=>setVideoPlaying(false)} onEnded={()=>setVideoPlaying(false)} onError={()=>setVideoFailed(true)} aria-hidden="true"/>:
          fallback?.src&&!imageFailed?<div className={styles.imageFrame}><img className={fallback.spritePosition?styles.sprite:styles.image} data-sprite-position={fallback.spritePosition} src={fallback.src} alt={fallback.alt} onLoad={event=>{const img=event.currentTarget;if(img.naturalWidth&&img.naturalHeight)setNatural({width:img.naturalWidth/(fallback.spritePosition?2:1),height:img.naturalHeight/(fallback.spritePosition?2:1)});}} onError={()=>setImageFailed(true)}/></div>:
            <div className={styles.missingImage} role="img" aria-label="Ilustração da cena indisponível"><span>A ilustração não está disponível.<br/>O texto da história continua disponível.</span></div>}
      </div>
      <div data-narrative className={styles.paper} data-contrast={contrast} role={compactLandscape?'region':undefined} aria-label={compactLandscape?'Texto da cena, role para ler o restante':undefined} tabIndex={compactLandscape?0:undefined}>
        <span className={styles.pageMark} aria-hidden="true">{String(sceneIndex+1).padStart(2,'0')}</span>
        <p className={styles.text} onClick={!revealed?onReveal:undefined} data-effect={effect} data-revealed={revealed||reducedMotion} aria-label={page.text}>
          <span aria-hidden="true">{tokens.map((token,index)=><span className={styles.word} key={`${index}-${token}`} style={{animationDelay:`${Math.min(index*20,650)}ms`}}>{token}</span>)}</span>
        </p>
        {canPlayVideo&&page.animation?.playbackBehavior==='manual'&&<button type="button" className={styles.reveal} onClick={toggleVideo}>{videoPlaying?'Pausar animação':'Reproduzir animação'}</button>}
      </div>
    </div>
  </div>;
}
