/** Best-effort browser display APIs, owned by one reader entry and never by audio.
 * A pending native request cannot be cancelled. Keep its lease until it settles
 * so a late resolution cannot undo another entry's fullscreen/orientation. */
type LockableOrientation = { lock?: (orientation: 'landscape') => Promise<void>; unlock?: () => void };
let displayLease: symbol | null = null;
export type ReaderDisplayResult = {ok:true}|{ok:false;reason:'unsupported'|'busy'|'denied'|'cancelled'};

export function createReaderDisplaySession(doc: Document = document, orientation: LockableOrientation = screen.orientation as LockableOrientation) {
  const token = Symbol('reader-display');
  const root = doc.documentElement;
  let released = false, pending = false, ownsFullscreen = false, attemptedLock = false, lockCancelled = false, cancelDisplay = false;
  let requested: Promise<void> | null = null;
  const unlock = () => {
    if (attemptedLock && displayLease === token) {
      attemptedLock = false;
      try { orientation?.unlock?.(); } catch { /* Some browsers expose an unsupported stub. */ }
    }
  };
  const tidy = async () => {
    unlock();
    if (ownsFullscreen && displayLease === token) {
      ownsFullscreen = false;
      if (doc.fullscreenElement === root && typeof doc.exitFullscreen === 'function') {
        try { await doc.exitFullscreen(); } catch { /* System may already have exited. */ }
      }
    }
    if (!pending && displayLease === token) displayLease = null;
  };
  const fullscreenChanged = () => {
    if ((ownsFullscreen && doc.fullscreenElement !== root) || (attemptedLock && !doc.fullscreenElement)) {
      lockCancelled = true; ownsFullscreen = false; unlock();
      if (!pending && displayLease === token) displayLease = null;
    }
  };
  doc.addEventListener('fullscreenchange', fullscreenChanged);
  return {
    requestLandscape() {
      if (requested) return requested;
      if (released || (displayLease !== null && displayLease !== token)) return Promise.resolve();
      displayLease = token; pending = true;
      cancelDisplay = false;
      requested = (async () => {
        try {
          if (!doc.fullscreenElement && typeof root.requestFullscreen === 'function') {
            try { await root.requestFullscreen(); ownsFullscreen = doc.fullscreenElement === root; } catch { /* Rotation may still be available without fullscreen. */ }
          }
          if (!released && !cancelDisplay && typeof orientation?.lock === 'function') {
            attemptedLock = true;
            try {
              await orientation.lock('landscape');
              // release() may have called unlock while the native promise was pending.
              if (released || lockCancelled || cancelDisplay) { attemptedLock = true; unlock(); }
            } catch { unlock(); }
          }
        } finally {
          pending = false;
          if (released || cancelDisplay) await tidy();
          else if (!ownsFullscreen && !attemptedLock && displayLease === token) displayLease = null;
        }
      })();
      return requested;
    },
    async requestFullscreen():Promise<ReaderDisplayResult> {
      if(released)return{ok:false,reason:'cancelled'};
      if(doc.fullscreenElement===root)return{ok:true};
      if(pending||(displayLease!==null&&displayLease!==token))return{ok:false,reason:'busy'};
      if(typeof root.requestFullscreen!=='function'||doc.fullscreenEnabled===false)return{ok:false,reason:'unsupported'};
      displayLease=token;pending=true;cancelDisplay=false;lockCancelled=false;
      try{
        await root.requestFullscreen();ownsFullscreen=doc.fullscreenElement===root;
        if(released||cancelDisplay)return{ok:false,reason:'cancelled'};
        return ownsFullscreen?{ok:true}:{ok:false,reason:'denied'};
      }catch{return{ok:false,reason:'denied'};}
      finally{pending=false;if(released||cancelDisplay)await tidy();else if(!ownsFullscreen&&!attemptedLock&&displayLease===token)displayLease=null;}
    },
    async exitFullscreen():Promise<ReaderDisplayResult> {
      cancelDisplay=true;lockCancelled=true;unlock();
      if(!doc.fullscreenElement)return{ok:true};
      if(typeof doc.exitFullscreen!=='function')return{ok:false,reason:'unsupported'};
      try{
        await doc.exitFullscreen();
        if(doc.fullscreenElement)return{ok:false,reason:'denied'};
        ownsFullscreen=false;
        if(!pending&&displayLease===token)displayLease=null;
        return{ok:true};
      }catch{return{ok:false,reason:'denied'};}
    },
    release() {
      released = true;cancelDisplay = true;
      doc.removeEventListener('fullscreenchange', fullscreenChanged);
      return tidy();
    },
  };
}
