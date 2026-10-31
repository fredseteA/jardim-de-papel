import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Settings2, ChevronLeft, ChevronRight, List, BookOpenText } from 'lucide-react';
import { SceneRenderer } from '../reader/SceneRenderer';
import { ReaderAudio } from '../reader/ReaderAudio';
import { sceneToReaderPage } from '../../lib/api/adapters';
import { defaultLayout, readComposition, sceneFormats, type SceneFormat, type SceneLayout } from '../../lib/sceneComposition';
import { editorialRequest, type AdminScene } from './editorial';
import { queryClient, queryKeys } from '../../lib/api/queryClient';
import readerStyles from '../reader/StoryReader.module.css';
import { READER_TEXT_SIZE } from '../../lib/readerTextSettings';
import { SaveFeedback } from './SaveFeedback';
import styles from './CompositionEditor.module.css';

export function CompositionEditor({ scene, previewScene, storyId, slug, storyTitle, onSaved, onClose, demo = false }: { demo?: boolean; scene: AdminScene; previewScene: AdminScene; storyId: string; slug: string; storyTitle: string; onSaved: (scene: AdminScene) => void; onClose: () => void }) {
  const initial = readComposition(scene.presentation_config.composition);
  const [composition, setComposition] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [format, setFormat] = useState<SceneFormat>('portrait');
  const [previewFontSize, setPreviewFontSize] = useState<number>(READER_TEXT_SIZE.default);
  const [copyTarget, setCopyTarget] = useState<SceneFormat>('landscape');
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [leaving, setLeaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.5);
  const device = sceneFormats.find(item => item.id === format)!;
  const page = sceneToReaderPage({ ...previewScene, presentation_config: { ...previewScene.presentation_config, composition } });
  const layout = composition.layouts[format] ?? defaultLayout(page.presentation?.textPosition);
  const dirty = JSON.stringify(composition) !== baseline;
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  useLayoutEffect(() => {
    const node = stage.current; if (!node) return;
    const measure = () => setScale(Math.min(node.clientWidth / device.width, window.innerHeight * .7 / device.height, 1));
    measure(); const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure); observer?.observe(node); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [device]);
  const update = (value: SceneLayout) => { setComposition(current => ({ ...current, layouts: { ...current.layouts, [format]: value } })); setMessage(''); };
  const save = async (closeAfter = false) => {
    if (saving || demo) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await editorialRequest<AdminScene>(`/api/v1/admin/stories/${storyId}/chapters/${scene.chapter_id}/scenes/${scene.id}/composition`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: composition.revision, layouts: composition.layouts }) });
      const saved = readComposition(result.presentation_config.composition);
      setComposition(saved); setBaseline(JSON.stringify(saved)); onSaved(result); setMessage('Composição salva corretamente.'); setLeaving(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.reading(slug) });
      if (closeAfter) onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar a composição. Seus ajustes foram preservados.'); }
    finally { setSaving(false); }
  };
  const exit = () => { if (saving) return; if (dirty) setLeaving(true); else onClose(); };
  const sliders: { key: keyof SceneLayout; label: string; min: number; max: number; step: number }[] = [
    { key: 'text_x', label: 'Texto · posição horizontal', min: 0, max: 100, step: 1 }, { key: 'text_y', label: 'Texto · posição vertical', min: 0, max: 100, step: 1 },
    { key: 'zoom', label: 'Imagem · zoom', min: 1, max: 3, step: .05 }, { key: 'image_x', label: 'Imagem · enquadramento horizontal', min: 0, max: 100, step: 1 }, { key: 'image_y', label: 'Imagem · enquadramento vertical', min: 0, max: 100, step: 1 },
  ];
  return <dialog ref={dialog} className={styles.editor} aria-labelledby="composition-title" onCancel={event => { event.preventDefault(); exit(); }}>
    <header className={styles.toolbar}><div><h2 id="composition-title">Composição da cena</h2><SaveFeedback busy={saving} success={message} error={error} pending={dirty ? 'Alterações de composição não salvas' : ''} /></div><button type="button" onClick={exit} disabled={saving}>Voltar ao editor</button><select aria-label="Formato de tela" value={format} onChange={e => setFormat(e.target.value as SceneFormat)} disabled={saving}>{sceneFormats.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button type="button" className={styles.primary} aria-busy={saving} title={!dirty ? "Altere a composição para salvar novamente" : undefined} onClick={() => void save()} disabled={demo || saving || !dirty}>{saving ? 'Salvando…' : !dirty && message ? 'Composição salva' : 'Salvar composição'}</button></header>
    
    {demo && <p className={styles.demoNotice}>Demonstração visual sem gravação. Para salvar conteúdo real, abra uma cena no <a href="/admin/stories">painel de histórias</a>.</p>}
    {leaving && <div className={styles.leave} role="alert"><strong>Há ajustes não salvos.</strong><button type="button" disabled={demo || saving} onClick={() => void save(true)}>Salvar e sair</button><button type="button" disabled={saving} onClick={onClose}>Descartar e sair</button><button type="button" onClick={() => setLeaving(false)}>Continuar editando</button></div>}
    <div className={styles.workspace}><div><p className={styles.hint}>Prévia do leitor em formato de livro. Imagem e texto ocupam áreas independentes; o layout é automático.</p><div className={styles.stage} ref={stage}><div className={styles.frame} style={{ width: device.width * scale, height: device.height * scale }}><div className={readerStyles.reader} data-mode="immersive" style={{ width: device.width, height: device.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      <SceneRenderer page={page} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={!!page.narration?.src || !!page.music?.src} onReveal={() => {}} fontSize={previewFontSize} format={format} />
      <header data-reader-chrome="header" className={readerStyles.header} inert><span className={readerStyles.roundButton}><ArrowLeft size={22} /></span><div className={readerStyles.headerTitle}><span>{storyTitle}</span><small>Prévia da cena</small></div><span className={readerStyles.roundButton}><Settings2 size={21} /></span></header>
      <footer data-reader-chrome="footer" className={readerStyles.footer} data-has-audio={!!page.narration?.src || !!page.music?.src} inert><div className={readerStyles.audioSlot}><ReaderAudio pageId={`preview-${scene.id}`} narration={page.narration} music={page.music} paused finished={false} onNarrationPlayingChange={() => {}} /></div><div className={readerStyles.actions}>{[ChevronLeft, List, BookOpenText, ChevronRight].map((Icon, index) => <span key={index} className={readerStyles.control}><Icon size={23} /></span>)}</div><div className={readerStyles.progressRow}><div className={readerStyles.progressTrack}><span style={{ width: '25%' }} /></div><span>Prévia</span></div></footer>
    </div></div></div><p className={styles.hint}>A ilustração é mostrada inteira, sem recorte. Role a página para conferir o texto completo. O arquivo original permanece intacto.</p></div>
    <aside className={styles.settings}><section className={styles.fontPreview}><h3>Tamanho do texto na prévia</h3><label>Tamanho do texto · {previewFontSize}px<input aria-label="Tamanho do texto na prévia" type="range" min={READER_TEXT_SIZE.min} max={READER_TEXT_SIZE.max} step={READER_TEXT_SIZE.step} value={previewFontSize} onChange={event => setPreviewFontSize(Number(event.target.value))} /></label><div><button type="button" onClick={() => setPreviewFontSize(READER_TEXT_SIZE.min)}>Mínimo</button><button type="button" onClick={() => setPreviewFontSize(READER_TEXT_SIZE.default)}>Padrão</button><button type="button" onClick={() => setPreviewFontSize(READER_TEXT_SIZE.max)}>Máximo</button></div><p>Simula o ajuste do leitor. Não altera a história nem precisa ser salvo.</p></section><details><summary>Ajustes anteriores · compatibilidade</summary><p>Os posicionamentos e zoom antigos são preservados nos dados, mas não são aplicados ao leitor em formato de livro. Estes controles editam apenas a configuração legada.</p><button type="button" disabled={saving} onClick={() => update(defaultLayout(page.presentation?.textPosition))}>Restaurar configuração anterior deste formato</button>{sliders.map(slider => <label key={slider.key}>{slider.label}<span aria-hidden="true">{layout[slider.key].toFixed(slider.key === 'zoom' ? 2 : 0)}{slider.key === 'zoom' ? '×' : '%'}</span><input aria-label={slider.label} type="range" min={slider.min} max={slider.max} step={slider.step} value={layout[slider.key]} disabled={saving} onChange={e => update({ ...layout, [slider.key]: Number(e.target.value) })} /></label>)}<button type="button" disabled={saving} onClick={() => update({ ...layout, zoom: 1, image_x: 50, image_y: 50 })}>Restaurar enquadramento</button><label>Copiar composição para<select aria-label="Destino da cópia" value={copyTarget} onChange={e => setCopyTarget(e.target.value as SceneFormat)}>{sceneFormats.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" disabled={saving || copyTarget === format} onClick={() => { setComposition(current => ({ ...current, layouts: { ...current.layouts, [copyTarget]: { ...layout } } })); setMessage(''); }}>Copiar para o formato escolhido</button><p>Posições são relativas ao espaço livre da área segura. Os ajustes dos demais formatos são preservados.</p></details></aside></div>
  </dialog>;
}
