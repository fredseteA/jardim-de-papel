/** Layout geometry, independent of user agent and screen.orientation.type. */
export function isPhoneViewport(width: number, height: number) {
  return width > 0 && height > 0 && Math.min(width, height) <= 540 && Math.max(width, height) < 1180;
}

export function isPhoneLandscape(width: number, height: number) {
  return width > height && isPhoneViewport(width, height);
}

/** The spread needs readable columns; tablet portrait remains stacked. */
export function illustratedLayout(width: number, height: number): 'stacked' | 'spread' {
  return width >= 960 || isPhoneLandscape(width, height) ? 'spread' : 'stacked';
}

export type ReadingViewport = { width: number; height: number; coarsePointer: boolean; noHover: boolean };
export function readingViewport(): ReadingViewport {
  return { width: window.innerWidth, height: window.innerHeight,
    coarsePointer: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    noHover: typeof matchMedia === 'function' && matchMedia('(hover: none)').matches };
}
export function shouldSuggestOrientation(viewport: ReadingViewport) {
  return viewport.height > viewport.width && isPhoneViewport(viewport.width, viewport.height) && viewport.coarsePointer && viewport.noHover;
}

export function containedImageFrame(width: number, height: number, naturalWidth: number, naturalHeight: number, layout = { zoom: 1, image_x: 50, image_y: 50 }) {
  const scale = Math.min(width / (naturalWidth || width), height / (naturalHeight || height)) * layout.zoom;
  const w = (naturalWidth || width) * scale, h = (naturalHeight || height) * scale;
  return { width: w, height: h, left: (width - w) * layout.image_x / 100, top: (height - h) * layout.image_y / 100 };
}
