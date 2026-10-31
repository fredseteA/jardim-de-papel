import { describe, expect, it } from 'vitest';
import { defaultLayout, imageFrame, primarySceneImage, readComposition, sceneFormat } from './sceneComposition';

describe('composição responsiva', () => {
  it('seleciona formato pela área útil e pela orientação', () => {
    expect(sceneFormat(390, 740)).toBe('portrait'); expect(sceneFormat(844, 390)).toBe('landscape');
    expect(sceneFormat(768, 1024)).toBe('tablet'); expect(sceneFormat(1024, 768)).toBe('tablet'); expect(sceneFormat(1440, 900)).toBe('tablet');
  });
  it('preenche a moldura sem deformação ou bordas vazias em imagens e zooms distintos', () => {
    for (const [width, height] of [[390, 693], [896, 504], [1024, 768]]) for (const [nw, nh] of [[600, 1200], [1920, 1080], [800, 800]]) for (const zoom of [1, 1.5, 3]) for (const x of [0, 50, 100]) {
      const frame = imageFrame(width, height, nw, nh, { ...defaultLayout(), zoom, image_x: x, image_y: x });
      expect(frame.width).toBeGreaterThanOrEqual(width - .0001); expect(frame.height).toBeGreaterThanOrEqual(height - .0001);
      expect(frame.left).toBeLessThanOrEqual(0); expect(frame.top).toBeLessThanOrEqual(0);
      expect(frame.left + frame.width).toBeGreaterThanOrEqual(width - .0001); expect(frame.top + frame.height).toBeGreaterThanOrEqual(height - .0001);
      expect(frame.width / frame.height).toBeCloseTo(nw / nh);
    }
  });
  it('mantém fallback legado sem alterar vínculos', () => {
    const media = [{ role: 'background', display_order: 0, id: 'bg' }, { role: 'illustration', display_order: 1, id: 'image' }];
    expect(primarySceneImage(media)?.id).toBe('image'); expect(primarySceneImage(media.slice(0, 1))?.id).toBe('bg'); expect(media).toHaveLength(2);
    expect(readComposition(undefined).layouts).toEqual({}); expect(defaultLayout('bottom-right')).toMatchObject({ text_x: 100, text_y: 100 });
  });
});
