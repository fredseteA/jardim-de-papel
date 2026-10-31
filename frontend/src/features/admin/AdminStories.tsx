import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AdminSidebar } from './AdminPages';
import { ChapterSceneEditor } from './ChapterSceneEditor';
import { createAdminStory, getAdminStory, getAdminStories, type AdminStory, type EditorialStatus, type StoryDraft, updateAdminStory } from './editorial';
import { SaveFeedback } from './SaveFeedback';
import { StoryImportPanel } from './StoryImportPanel';
import { DeleteStoryDialog } from './DeleteStoryDialog';
import { StoryImageField } from './StoryImageField';
import { queryClient, queryKeys } from '../../lib/api/queryClient';
import styles from './Admin.module.css';

const statuses: Array<{ value: '' | EditorialStatus; label: string }> = [
  { value: '', label: 'Todos os status' }, { value: 'draft', label: 'Rascunhos' }, { value: 'published', label: 'Publicadas' }, { value: 'archived', label: 'Arquivadas' },
];
const statusLabel: Record<EditorialStatus, string> = { draft: 'Rascunho', published: 'Publicada', archived: 'Arquivada' };
const emptyDraft = (): StoryDraft => ({ title: '', slug: '', subtitle: null, synopsis: '', description: '', cover_asset_id: null, hero_asset_id: null, minimum_age: null, maximum_age: null, estimated_reading_minutes: null, language: 'pt-BR', status: 'draft' });
const asOptionalNumber = (value: string) => value.trim() ? Number(value) : null;
const asOptionalText = (value: string) => value.trim() || null;
const coverSource = (story: AdminStory) => {
  const asset = story.cover_asset;
  if (!asset) return '';
  if (asset.resolved_url) return asset.resolved_url;
  if (/^https?:\/\//i.test(asset.storage_path)) return asset.storage_path;
  return asset.storage_provider === 'frontend' ? `/${asset.storage_path.replace(/^\/+/, '')}` : '';
};

function StoryForm({ story, onSaved, onCancel, onOpenContent }: { story: AdminStory | null; onSaved: () => void; onCancel: () => void; onOpenContent: (story: AdminStory) => void }) {
  const [draft, setDraft] = useState<StoryDraft>(() => story ? { ...story } : emptyDraft());
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const busy = saving || coverUploading || heroUploading;
  const change = <K extends keyof StoryDraft>(key: K, value: StoryDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setError(''); setSaving(true);
    try { if (story) await updateAdminStory(story.id, draft); else await createAdminStory(draft); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a história.'); }
    finally { setSaving(false); }
  };
  return <section className={styles.storyEditor} aria-labelledby="story-editor-title"><div className={styles.editorHeading}><div><p className={styles.eyebrow}>EDITORIAL</p><h2 id="story-editor-title">{story ? 'Editar história' : 'Nova história'}</h2></div><div className={styles.editorActions}>{story && <button type="button" className={styles.secondary} disabled={busy} onClick={() => onOpenContent(story)}>Capítulos e cenas</button>}<button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Cancelar</button></div></div>
    <form className={styles.storyForm} onSubmit={event => void submit(event)}>
      <label>Título<input required value={draft.title} onChange={event => change('title', event.target.value)} /></label>
      <label>Slug<input required value={draft.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={event => change('slug', event.target.value)} aria-describedby="slug-help" /></label>
      <p id="slug-help" className={styles.fieldHint}>Use letras minúsculas, números e hífens.</p>
      <label>Subtítulo<input value={draft.subtitle ?? ''} onChange={event => change('subtitle', asOptionalText(event.target.value))} /></label>
      <label>Status<select value={draft.status} onChange={event => change('status', event.target.value as EditorialStatus)}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="archived">Arquivada</option></select></label>
      <label className={styles.formWide}>Sinopse<textarea rows={3} value={draft.synopsis} onChange={event => change('synopsis', event.target.value)} /></label>
      <label className={styles.formWide}>Descrição editorial<textarea rows={4} value={draft.description} onChange={event => change('description', event.target.value)} /></label>
      <StoryImageField label="Capa da história" value={draft.cover_asset_id} storyId={story?.id} disabled={saving} onChange={id => change('cover_asset_id', id)} onUploadingChange={setCoverUploading} />
      <StoryImageField label="Hero da história" value={draft.hero_asset_id} storyId={story?.id} disabled={saving} onChange={id => change('hero_asset_id', id)} onUploadingChange={setHeroUploading} />
      <label>Idade mínima<input type="number" min="0" value={draft.minimum_age ?? ''} onChange={event => change('minimum_age', asOptionalNumber(event.target.value))} /></label>
      <label>Idade máxima<input type="number" min="0" value={draft.maximum_age ?? ''} onChange={event => change('maximum_age', asOptionalNumber(event.target.value))} /></label>
      <label>Minutos estimados<input type="number" min="1" value={draft.estimated_reading_minutes ?? ''} onChange={event => change('estimated_reading_minutes', asOptionalNumber(event.target.value))} /></label>
      <label>Idioma<input value={draft.language} onChange={event => change('language', event.target.value)} /></label>
      {error && <p className={styles.error + ' ' + styles.formWide} role="alert">{error}</p>}
      <div className={styles.formActions + ' ' + styles.formWide}><button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Cancelar</button><button className={styles.primary} type="submit" aria-busy={busy} disabled={busy}>{saving ? 'Salvando...' : coverUploading || heroUploading ? 'Aguarde o envio das imagens…' : 'Salvar história'}</button></div>
    </form>
  </section>;
}

export function AdminStories() {
  const [searchParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminStory | null>(null);
  const targetStory = searchParams.get('story');
  const [items, setItems] = useState<AdminStory[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [query, setQuery] = useState(''); const [status, setStatus] = useState<'' | EditorialStatus>(''); const [offset, setOffset] = useState(0); const [editor, setEditor] = useState<AdminStory | null | 'new'>(null); const [contentStory, setContentStory] = useState<AdminStory | null>(null); const [notice, setNotice] = useState('');
  useEffect(() => { if (targetStory) void getAdminStory(targetStory).then(setContentStory).catch(reason => setError(reason instanceof Error ? reason.message : 'História indisponível.')); }, [targetStory]);
  const params = useMemo(() => { const values = new URLSearchParams({ limit: '12', offset: String(offset) }); if (query.trim()) values.set('q', query.trim()); if (status) values.set('status', status); return values; }, [offset, query, status]);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const page = await getAdminStories(params); setItems(page.items); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as histórias.'); } finally { setLoading(false); } }, [params]);
  useEffect(() => { void load(); }, [load]);
  const applyFilters = (event: FormEvent) => { event.preventDefault(); setOffset(0); };
  const saved = () => { setEditor(null); setNotice('História salva corretamente.'); void load(); void Promise.all([['stories'], ['reading'], ['collections'], ['collection']].map(queryKey => queryClient.invalidateQueries({ queryKey }))); };
  const deleted = (story: AdminStory) => {
    setDeleteTarget(null); setItems(current => current.filter(item => item.id !== story.id));
    setNotice(`História “${story.title}” excluída corretamente. Arquivos de mídia preservados.`);
    if (items.length === 1 && offset > 0) setOffset(current => Math.max(0, current - 12)); else void load();
    void Promise.all([queryClient.cancelQueries({ queryKey: queryKeys.reading(story.slug) }), queryClient.cancelQueries({ queryKey: ['stories'] })]).then(() => {
      queryClient.removeQueries({ queryKey: queryKeys.reading(story.slug), exact: true });
      void queryClient.invalidateQueries({ queryKey: ['stories'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections });
    });
  };
  return <div className={styles.dashboard}><AdminSidebar active="stories" /><main className={styles.main}><header className={styles.header}><span>Catálogo editorial</span></header><SaveFeedback success={notice} />
    {importOpen ? <StoryImportPanel onCancel={() => { setImportOpen(false); void load(); }} onOpenStory={story => { setImportOpen(false); setEditor(story); setContentStory(story); setNotice('História importada corretamente como rascunho.'); }} /> : contentStory ? <ChapterSceneEditor initialChapterId={searchParams.get('chapter') ?? ''} initialSceneId={searchParams.get('scene') ?? ''} story={contentStory} onClose={() => setContentStory(null)} /> : editor !== null ? <StoryForm story={editor === 'new' ? null : editor} onSaved={saved} onCancel={() => setEditor(null)} onOpenContent={setContentStory} /> : <section className={styles.storyList} aria-labelledby="stories-title">
      <div className={styles.listHeading}><div><p className={styles.eyebrow}>BIBLIOTECA EDITORIAL</p><h1 id="stories-title" tabIndex={-1}>Histórias</h1><p className={styles.description}>Cuide dos metadados que dão vida ao catálogo.</p></div><div className={styles.editorActions}><button className={styles.secondary} type="button" onClick={() => setImportOpen(true)}>Importar história por JSON</button><button className={styles.primary} type="button" onClick={() => setEditor('new')}><Plus size={18} /> Nova história</button></div></div>
      <form className={styles.storyFilters} onSubmit={applyFilters}><label className={styles.searchField}><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar por título</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título" /></label><label><span className="sr-only">Status editorial</span><select value={status} onChange={event => { setStatus(event.target.value as '' | EditorialStatus); setOffset(0); }}>{statuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="submit" className={styles.secondary}>Buscar</button></form>
      {loading ? <p className={styles.loading} role="status">Carregando histórias...</p> : error ? <div className={styles.empty}><p role="alert">{error}</p><button className={styles.secondary} onClick={() => void load()}>Tentar novamente</button></div> : items.length === 0 ? <div className={styles.empty}><h2>Nenhuma história encontrada</h2><p>Altere os filtros ou crie a primeira história deste recorte.</p><button className={styles.primary} onClick={() => setEditor('new')}>Criar história</button></div> : <><div className={styles.storyTable} role="table" aria-label="Histórias cadastradas"><div className={styles.tableHeader} role="row"><span>História</span><span>Coleções</span><span>Capítulos</span><span>Status</span><span>Ações</span></div>{items.map(story => <article className={styles.storyRow} role="row" key={story.id}><div className={styles.storyTitle}>{coverSource(story) ? <img className={styles.storyCover} src={coverSource(story)} alt="" /> : <div className={styles.coverFallback} aria-hidden="true">{story.title.slice(0, 1)}</div>}<div><strong>{story.title}</strong><span>/{story.slug}</span></div></div><span>{story.collections.length ? story.collections.join(', ') : 'Sem coleção'}</span><span>{story.chapter_count} {story.chapter_count === 1 ? 'capítulo' : 'capítulos'}</span><span><i className={`${styles.status} ${styles[`status${story.status}`]}`}>{statusLabel[story.status]}</i></span><div className={styles.storyActions}><button className={styles.iconButton} type="button" onClick={() => setEditor(story)} aria-label={`Editar ${story.title}`}><Edit3 size={17} /></button><button className={styles.danger} type="button" onClick={() => setDeleteTarget(story)} aria-label={`Excluir ${story.title}`}><Trash2 size={17} aria-hidden="true" /></button></div></article>)}</div><nav className={styles.pagination} aria-label="Paginação de histórias"><button className={styles.secondary} disabled={offset === 0} onClick={() => setOffset(current => Math.max(0, current - 12))}><ChevronLeft size={17} /> Anterior</button><span>{offset + 1}–{offset + items.length}</span><button className={styles.secondary} disabled={items.length < 12} onClick={() => setOffset(current => current + 12)}>Próxima <ChevronRight size={17} /></button></nav></>}
    </section>}
  </main>{deleteTarget && <DeleteStoryDialog key={deleteTarget.id} story={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={deleted} />}</div>;
}
