import { useLayoutEffect, useState, type RefObject } from 'react';

/** Measures the scroll area separately from the device canvas (including the
 * scaled editorial preview). Changing font/content cannot change its breakpoint. */
export function useSceneViewport(ref: RefObject<HTMLDivElement | null>) {
  const [size,setSize]=useState({width:390,height:550,readerWidth:390,readerHeight:693});
  useLayoutEffect(()=>{
    const root=ref.current; if(!root)return;
    const parent=root.parentElement;
    const measure=()=>{
      if(!root.clientWidth||!root.clientHeight)return;
      const next={width:root.clientWidth,height:root.clientHeight,readerWidth:parent?.clientWidth||root.clientWidth,readerHeight:parent?.clientHeight||root.clientHeight};
      setSize(old=>Object.keys(next).every(k=>old[k as keyof typeof old]===next[k as keyof typeof next])?old:next);
    };
    measure();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    observer?.observe(root);if(parent)observer?.observe(parent);
    window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
  },[ref]);
  return size;
}
