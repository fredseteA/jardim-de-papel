import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { AdminMedia, AdminScene, SceneMedia } from './editorial';
import { addAdminSceneMedia, editorialRequest, getAdminMedia, getAdminMediaDetail, removeAdminSceneMedia, uploadAdminMedia } from './editorial';
import { queryClient, queryKeys } from '../../lib/api/queryClient';
import { primarySceneImage } from '../../lib/sceneComposition';
import { SaveFeedback } from './SaveFeedback';
import styles from './SceneMediaManager.module.css';

const mediaName = (asset: AdminMedia) => String(asset.asset_metadata.title || asset.asset_metadata.original_filename || asset.storage_path.split('/').at(-1) || 'Imagem');
const mediaSource = (asset: AdminMedia) => asset.resolved_url || (asset.storage_provider === 'frontend' ? `/${asset.storage_path.replace(/^\/+/, '')}` : '');
type Context = { stories: { id: string; title: string }[]; chapters: { id: string; story_id: string; title: string }[]; collections: { id: string; title: string }[] };

export function MediaThumbnail({ asset }: { asset: AdminMedia }) {
  const [url, setUrl] = useState(mediaSource(asset));
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  useEffect(() => { setUrl(mediaSource(asset)); setFailed(false); retried.current = false; }, [asset]);
  const renew = async () => {
    if (retried.current) { setFailed(true); return; }
    retried.current = true;
    try { const fresh = await getAdminMediaDetail(asset.id); const next = mediaSource(fresh); if (!next || next === url) setFailed(true); else setUrl(next); }
    catch { setFailed(true); }
  };
  return url && !failed ? <img src={url} alt={mediaName(asset)} loading="lazy" onError={() => void renew()} /> : <span className={styles.unavailable}>Prévia indisponível</span>;
}

export function MediaPicker({ storyId, kind, onConfirm, onClose, initialAsset }: { initialAsset?: AdminMedia; storyId: string; kind: 'image' | 'audio'; onConfirm: (asset: AdminMedia) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [context, setContext] = useState<Context>({ stories: [], chapters: [], collections: [] });
  const [scope, setScope] = useState(storyId);
  const [collection, setCollection] = useState(''); const [chapter, setChapter] = useState('');
  const [query, setQuery] = useState(''); const [items, setItems] = useState<AdminMedia[]>([]);
  const [selected, setSelected] = useState<AdminMedia | null>(initialAsset ?? null); const [preview, setPreview] = useState(false);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  const [offset, setOffset] = useState(0); const [more, setMore] = useState(false); const [version, setVersion] = useState(0);
  useEffect(() => { dialog.current?.showModal(); void editorialRequest<Context>('/api/v1/admin/media/context').then(setContext).catch(() => setError('Não foi possível carregar os filtros.')); }, []);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ media_type: kind, limit: '24', offset: String(offset), q: query });
      if (scope === 'unlinked') params.set('unlinked', 'true'); else if (scope) params.set('story_id', scope);
      if (collection) params.set('collection_id', collection); if (chapter) params.set('chapter_id', chapter);
      void getAdminMedia(params).then(page => { if (active) { setItems(previous => offset ? [...previous, ...page.items] : page.items); setMore(page.items.length === 24); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar imagens.'); }).finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, scope, collection, chapter, query, offset, version]);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setSaving(true); setError('');
    try { const asset = await uploadAdminMedia(file, { storyId, title: file.name }); setSelected(asset); setScope(storyId); setCollection(''); setChapter(''); setQuery(''); setOffset(0); setVersion(v => v + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro no envio.'); }
    finally { setSaving(false); event.target.value = ''; }
  };
  const confirm = async () => { if (!selected) return; setSaving(true); setError(''); try { await onConfirm(selected); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao associar. Tente novamente.'); } finally { setSaving(false); } };
  return <dialog className={styles.dialog} ref={dialog} onCancel={event => { if (saving) event.preventDefault(); else onClose(); }} aria-labelledby="image-picker-title">
    <header><div><h2 id="image-picker-title">{kind === 'image' ? 'Escolher imagem' : 'Escolher áudio'}</h2><p>Selecione um arquivo e confirme para salvar o vínculo com a cena.</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="Fechar biblioteca">×</button></header>
    <div className={styles.filters}>
      <input aria-label="Buscar por nome" placeholder="Buscar por nome" value={query} onChange={e => { setQuery(e.target.value); setOffset(0); }} />
      <select aria-label="Filtrar por história" value={scope} onChange={e => { setScope(e.target.value); setChapter(''); setOffset(0); }}><option value="">{kind === 'image' ? 'Todas as imagens' : 'Todos os áudios'}</option><option value="unlinked">Não vinculados</option>{context.stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
      <select aria-label="Filtrar por coleção" value={collection} onChange={e => { setCollection(e.target.value); setOffset(0); }}><option value="">Todas as coleções</option>{context.collections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
      <select aria-label="Filtrar por capítulo" value={chapter} onChange={e => { setChapter(e.target.value); setOffset(0); }} disabled={!scope || scope === 'unlinked'}><option value="">Todos os capítulos</option>{context.chapters.filter(c => c.story_id === scope).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
      <label className={styles.upload}>{saving ? 'Enviando…' : 'Enviar novo arquivo'}<input type="file" disabled={saving} accept={kind === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp3,.wav,.ogg'} onChange={e => void upload(e)} /></label>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.grid} aria-busy={loading}>{items.map(asset => <button key={asset.id} type="button" aria-pressed={selected?.id === asset.id} onClick={() => { setSelected(asset); setPreview(false); }} disabled={saving}>{kind === 'image' ? <MediaThumbnail asset={asset} /> : <span className={styles.unavailable}>Áudio</span>}<strong>{mediaName(asset)}</strong>{(asset.story_count ?? 0) > 1 && <small>Compartilhada entre {asset.story_count} histórias</small>}</button>)}</div>
    {loading && <p role="status">Carregando biblioteca…</p>}{!loading && !items.length && <p>Nenhum arquivo neste filtro. Selecione “Todas as imagens” ou envie um arquivo.</p>}
    {more && <button type="button" disabled={loading} onClick={() => setOffset(v => v + 24)}>Carregar mais</button>}
    {selected && <div className={styles.selection}><strong>Selecionado: {mediaName(selected)}</strong><button type="button" onClick={() => setPreview(v => !v)}>Visualizar</button>{preview && (kind === 'image' ? <MediaThumbnail asset={selected} /> : <audio controls src={mediaSource(selected)} />)}</div>}
    <footer><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="button" className={styles.primary} aria-busy={saving} disabled={!selected || saving} onClick={() => void confirm()}>{saving ? 'Salvando…' : 'Confirmar seleção'}</button></footer>
  </dialog>;
}

const slots: { role: SceneMedia['role']; label: string; kind: 'image' | 'audio' }[] = [
  { role: 'illustration', label: 'Imagem da cena', kind: 'image' },
  { role: 'narration', label: 'Narração', kind: 'audio' }, { role: 'ambient_music', label: 'Música de fundo', kind: 'audio' },
  { role: 'sound_effect', label: 'Efeito sonoro', kind: 'audio' },
];

export function SceneMediaManager({ storyId, slug, chapterId, scene, onChanged }: { storyId: string; slug: string; chapterId: string; scene: AdminScene; onChanged: (scene: AdminScene) => void }) {
  const [slot, setSlot] = useState<typeof slots[number] | null>(null); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [view, setView] = useState<AdminMedia | null>(null);
  const preview = useRef<HTMLDialogElement>(null);
  const [uploaded, setUploaded] = useState<AdminMedia | undefined>();
  const sendNew = async (event: ChangeEvent<HTMLInputElement>, target: typeof slots[number]) => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setError(''); setMessage('Enviando arquivo…');
    try { const asset = await uploadAdminMedia(file, { storyId, title: file.name }); setUploaded(asset); setSlot(target); setMessage('Arquivo enviado corretamente. Confirme a seleção para associá-lo à cena.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha no envio.'); }
    finally { setBusy(false); event.target.value = ''; }
  };
  useEffect(() => { setMessage(''); setError(''); setSlot(null); }, [scene.id]);
  const associate = async (asset: AdminMedia) => {
    if (!slot) return;
    setBusy(true); setError(''); setMessage('');
    try {
    const currentImage = slot.kind === 'image' ? primarySceneImage(scene.media) : undefined;
    const role = currentImage?.role ?? slot.role;
    const order = currentImage?.display_order ?? 0;
    const link = await addAdminSceneMedia(storyId, chapterId, scene.id, { media_asset_id: asset.id, role, display_order: order });
    onChanged({ ...scene, media: [...scene.media.filter(m => !(m.role === role && m.display_order === order)), link] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reading(slug) });
    setMessage(slot.kind === 'image' ? 'Imagem associada e salva corretamente.' : 'Áudio associado e salvo corretamente.'); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao associar mídia.'); throw reason; }
    finally { setBusy(false); }
  };
  const remove = async (link: SceneMedia) => { setBusy(true); setError(''); setMessage(''); try { await removeAdminSceneMedia(storyId, chapterId, scene.id, link.id); onChanged({ ...scene, media: scene.media.filter(m => m.id !== link.id) }); void queryClient.invalidateQueries({ queryKey: queryKeys.reading(slug) }); setMessage('Vínculo removido. Arquivo preservado na biblioteca.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao remover.'); } finally { setBusy(false); } };
  return <div className={styles.manager}><h3>Imagens e áudio da cena</h3><p>Os vínculos são salvos ao confirmar a seleção. O texto é salvo separadamente em “Salvar cena”.</p><SaveFeedback busy={busy} success={message} error={error} />
    <div className={styles.slots}>{slots.map(s => { const link = s.kind === 'image' ? primarySceneImage(scene.media) : scene.media.find(m => m.role === s.role && m.display_order === 0); return <div className={styles.slot} key={s.role}><h4>{s.label}</h4>{link ? <>{s.kind === 'image' ? <MediaThumbnail asset={link.asset} /> : <audio controls src={mediaSource(link.asset)} />}<strong>{mediaName(link.asset)}</strong><div className={styles.actions}><button type="button" onClick={() => { setView(link.asset); preview.current?.showModal(); }}>Visualizar</button><button type="button" disabled={busy} onClick={() => { setUploaded(undefined); setSlot(s); }}>{s.kind === 'image' ? 'Trocar imagem' : 'Trocar áudio'}</button><button type="button" disabled={busy} onClick={() => void remove(link)}>Remover {s.kind === 'image' ? 'imagem' : 'áudio'}</button></div></> : <><div className={styles.unavailable}>{s.kind === 'image' ? 'Nenhuma imagem associada' : 'Áudio opcional'}</div><button type="button" onClick={() => { setUploaded(undefined); setSlot(s); }}>Escolher {s.kind === 'image' ? 'imagem' : 'áudio'}</button><label className={styles.upload}>Enviar {s.kind === 'image' ? 'nova imagem' : 'novo áudio'}<input type="file" disabled={busy} accept={s.kind === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp3,.wav,.ogg'} onChange={event => void sendNew(event, s)} /></label></>}</div>; })}</div>
    {scene.media.filter(link => link.role !== 'background' && link.role !== 'illustration' && (!slots.some(s => s.role === link.role) || link.display_order !== 0)).map(link => <div className={styles.slot} key={link.id}><strong>Arquivo legado ou adicional: {mediaName(link.asset)}</strong><p>Este vínculo foi preservado. Novas imagens devem ser estáticas.</p><button type="button" disabled={busy} onClick={() => void remove(link)}>Remover vínculo</button></div>)}
    {slot && <MediaPicker initialAsset={uploaded} storyId={storyId} kind={slot.kind} onClose={() => setSlot(null)} onConfirm={associate} />}
    <dialog ref={preview} className={styles.dialog} aria-label="Visualizar arquivo"><button type="button" onClick={() => preview.current?.close()}>Fechar</button>{view && (view.media_type === 'image' ? <MediaThumbnail asset={view} /> : <audio controls src={mediaSource(view)} />)}</dialog>
  </div>;
}
