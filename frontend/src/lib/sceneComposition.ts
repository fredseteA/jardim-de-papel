export type SceneFormat = 'portrait' | 'landscape' | 'tablet';
export type SceneLayout = { text_x: number; text_y: number; image_x: number; image_y: number; zoom: number };
export type SceneComposition = { version: 1; revision: number; layouts: Partial<Record<SceneFormat, SceneLayout>> };
export const sceneFormats: { id: SceneFormat; label: string; width: number; height: number }[] = [
  { id: 'portrait', label: 'Celular vertical · 9:16', width: 390, height: 693.333 },
  { id: 'landscape', label: 'Celular horizontal · 16:9', width: 896, height: 504 },
  { id: 'tablet', label: 'Tablet / desktop · 4:3', width: 1024, height: 768 },
];
export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export function sceneFormat(width: number, height: number): SceneFormat {
  if ((width >= 768 && height >= 600) || width >= 1180) return 'tablet';
  return width > height ? 'landscape' : 'portrait';
}
export function defaultLayout(position = 'top-left'): SceneLayout {
  return { text_x: position.endsWith('right') ? 100 : position.endsWith('center') ? 50 : 0, text_y: position.startsWith('bottom') ? 100 : 0, image_x: 50, image_y: 50, zoom: 1 };
}
export function readComposition(value: unknown): SceneComposition {
  const raw = value && typeof value === 'object' ? value as Partial<SceneComposition> : {};
  const layouts: SceneComposition['layouts'] = {};
  if (raw.version === 1) for (const { id } of sceneFormats) {
    const layout = raw.layouts?.[id];
    if (layout) layouts[id] = { text_x: clamp(Number(layout.text_x) || 0), text_y: clamp(Number(layout.text_y) || 0), image_x: clamp(Number.isFinite(layout.image_x) ? layout.image_x : 50), image_y: clamp(Number.isFinite(layout.image_y) ? layout.image_y : 50), zoom: clamp(Number(layout.zoom) || 1, 1, 3) };
  }
  return { version: 1, revision: raw.revision ?? 0, layouts };
}
export function imageFrame(width: number, height: number, naturalWidth: number, naturalHeight: number, layout: SceneLayout) {
  const scale = Math.max(width / (naturalWidth || width), height / (naturalHeight || height)) * layout.zoom;
  const w = (naturalWidth || width) * scale, h = (naturalHeight || height) * scale;
  return { width: w, height: h, left: -(w - width) * layout.image_x / 100, top: -(h - height) * layout.image_y / 100 };
}
export function primarySceneImage<T extends { role: string; display_order: number }>(media: readonly T[]): T | undefined {
  const sorted = [...media].sort((a, b) => a.display_order - b.display_order);
  return sorted.find(m => m.role === 'illustration') ?? sorted.find(m => m.role === 'background');
}
