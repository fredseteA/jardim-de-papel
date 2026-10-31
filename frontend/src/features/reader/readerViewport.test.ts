import { describe, expect, it } from 'vitest';
import { containedImageFrame, illustratedLayout, isPhoneLandscape, isPhoneViewport, shouldSuggestOrientation } from './readerViewport';

describe('geometria do leitor horizontal', () => {
  it.each([[568,320], [667,375], [844,390], [932,430], [896,504]])('reconhece celular horizontal %ix%i', (w,h) => {
    expect(isPhoneViewport(w,h)).toBe(true); expect(isPhoneLandscape(w,h)).toBe(true);
  });
  it.each([[390,844], [768,1024], [1024,768], [1180,820], [1440,900], [600,960]])('não aplica duas colunas compactas a %ix%i', (w,h) => expect(isPhoneLandscape(w,h)).toBe(false));
  it('preserva toda a ilustração vertical ou horizontal sem distorcer', () => {
    for (const [w,h] of [[600,1000], [1200,600]]) {
      const frame = containedImageFrame(400,240,w,h);
      expect(frame.width).toBeLessThanOrEqual(400); expect(frame.height).toBeLessThanOrEqual(240);
      expect(frame.width/frame.height).toBeCloseTo(w/h); expect(frame.left).toBeGreaterThanOrEqual(0); expect(frame.top).toBeGreaterThanOrEqual(0);
    }
  });
  it('sugere apenas em viewport de celular vertical com entrada de toque primária',()=>{
    expect(shouldSuggestOrientation({width:390,height:844,coarsePointer:true,noHover:true})).toBe(true);
    for(const viewport of [{width:390,height:844,coarsePointer:false,noHover:false},{width:768,height:1024,coarsePointer:true,noHover:true},{width:844,height:390,coarsePointer:true,noHover:true}]) expect(shouldSuggestOrientation(viewport)).toBe(false);
  });
  it.each([[360,800,'stacked'],[390,844,'stacked'],[430,932,'stacked'],[800,360,'spread'],[844,390,'spread'],[932,430,'spread'],[768,1024,'stacked'],[820,1180,'stacked'],[1024,768,'spread'],[1180,820,'spread'],[1366,768,'spread'],[1920,1080,'spread']])('seleciona a composição de livro para %ix%i', (w,h,layout)=>expect(illustratedLayout(Number(w),Number(h))).toBe(layout));
});
