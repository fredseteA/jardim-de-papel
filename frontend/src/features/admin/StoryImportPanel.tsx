import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileJson, Upload } from 'lucide-react';
import { SaveFeedback } from './SaveFeedback';
import type { AdminStory } from './editorial';
import { confirmStoryImport, MAX_STORY_IMPORT_BYTES, validateStoryImport, type StoryImportPreview } from './storyImport';
import styles from './Admin.module.css';
import local from './StoryImportPanel.module.css';

export function StoryImportPanel({ onCancel, onOpenStory }: { onCancel: () => void; onOpenStory: (story: AdminStory) => void }) {
  const [preview, setPreview] = useState<StoryImportPreview | null>(null);
  const [created, setCreated] = useState<AdminStory | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState<'validating' | 'importing' | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const validatedSource = useRef('');
  const inFlight = useRef(false);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (busy === 'importing') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const selectFile = async (file: File | undefined) => {
    if (!file || inFlight.current) return;
    const current = ++sequence.current;
    validatedSource.current = '';
    setPreview(null); setCreated(null); setError(''); setFileName(file.name);
    if (!/\.json$/i.test(file.name)) { setError('Selecione um arquivo com extensão .json.'); return; }
    if (file.size > MAX_STORY_IMPORT_BYTES) { setError('O arquivo JSON deve ter no máximo 2 MiB.'); return; }
    setBusy('validating');
    try {
      const source = (await file.text()).replace(/^\uFEFF/, '');
      try { JSON.parse(source); } catch { throw new Error('JSON inválido: confira vírgulas, aspas e chaves do arquivo.'); }
      const result = await validateStoryImport(source);
      if (sequence.current === current) { validatedSource.current = source; setPreview(result); }
    } catch (reason) {
      if (sequence.current === current) setError(reason instanceof Error ? reason.message : 'Não foi possível validar o arquivo.');
    } finally { if (sequence.current === current) setBusy(null); }
  };
  const confirm = async () => {
    if (!preview || !validatedSource.current || inFlight.current || created) return;
    const current = sequence.current;
    inFlight.current = true; setBusy('importing'); setError('');
    try {
      // Reuse the exact validated source; normalized defaults could exceed the file size limit.
      const story = await confirmStoryImport(validatedSource.current);
      if (sequence.current === current) setCreated(story);
    } catch (reason) {
      if (sequence.current === current) setError(reason instanceof Error ? reason.message : 'Não foi possível importar. Nenhum conteúdo deve ser reenviado sem conferir o catálogo.');
    } finally { inFlight.current = false; if (sequence.current === current) setBusy(null); }
  };
  const story = preview?.document.story;
  return <section className={`${styles.storyEditor} ${local.panel}`} aria-labelledby="import-title">
    <header className={styles.editorHeading}><div><p className={styles.eyebrow}>NOVO RASCUNHO</p><h1 id="import-title">Importar história por JSON</h1><p className={styles.description}>Selecione → valide → confira → importe. A publicação continua sendo uma decisão editorial.</p></div>
      <button type="button" className={styles.secondary} disabled={busy === 'importing'} onClick={onCancel}><ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo</button></header>
    {!created && <label className={local.file}><FileJson size={24} aria-hidden="true" /><span>Selecionar arquivo JSON</span><input type="file" accept=".json,application/json" disabled={busy !== null} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void selectFile(file); }} /><small>Versão 1 · UTF-8 · até 2 MiB · nenhuma mídia é enviada</small></label>}
    {fileName && <p className={local.fileName}>{fileName}</p>}
    {busy === 'validating' && <p role="status">Validando estrutura, coleção e disponibilidade do slug…</p>}
    <SaveFeedback busy={busy === 'importing'} error={error} success={created ? 'História importada corretamente como rascunho. Textos, capítulos e páginas estão salvos.' : ''} />
    {preview && story && <div className={local.preview}>
      <h2>{story.title}</h2><dl className={local.summary}>
        <div><dt>Coleção</dt><dd>{preview.collection_title}</dd></div>
        <div><dt>Faixa etária</dt><dd>{story.minimum_age !== null && story.maximum_age !== null ? `${story.minimum_age}–${story.maximum_age} anos` : story.minimum_age !== null ? `A partir de ${story.minimum_age} anos` : story.maximum_age !== null ? `Até ${story.maximum_age} anos` : 'Não informada'}</dd></div>
        <div><dt>Estrutura</dt><dd>{preview.chapter_count} capítulos · {preview.page_count} páginas</dd></div>
        <div><dt>Narração estimada</dt><dd>{preview.estimated_narration_seconds !== null ? `${Math.floor(preview.estimated_narration_seconds / 60)} min ${preview.estimated_narration_seconds % 60} s` : 'Não informada'}</dd></div>
        <div><dt>Slug</dt><dd>{story.slug}</dd></div><div><dt>Idioma</dt><dd>{story.language}</dd></div>
      </dl>
      {preview.warnings.map(warning => <p className={local.warning} key={warning}>{warning}</p>)}
      {story.synopsis && <div><h3>Sinopse</h3><p className={local.narrative}>{story.synopsis}</p></div>}
      {story.description && <div><h3>Descrição</h3><p className={local.narrative}>{story.description}</p></div>}
      <details><summary>Dados literários e observações</summary><dl className={local.metadata}>{Object.entries(story.editorial).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{({ author: 'Autor', literary_origin: 'Origem literária', reference_work: 'Obra de referência', reference_version: 'Versão de referência', editorial_notes: 'Observações editoriais', copyright_notes: 'Direitos autorais' } as Record<string, string>)[key]}</dt><dd>{value}</dd></div>)}</dl></details>
      <h3>Conferir capítulos e páginas</h3>
      {preview.document.chapters.map(chapter => <details className={local.chapter} key={chapter.order}><summary>{chapter.order}. {chapter.title} — {chapter.pages.length} páginas</summary>
        {chapter.pages.map(page => <article className={local.page} key={page.order}><h4>Página {page.order}{page.title ? ` · ${page.title}` : ''}</h4><p className={local.narrative}>{page.text}</p>{page.illustration_description && <p><strong>Sugestão de ilustração: </strong>{page.illustration_description}</p>}{page.estimated_narration_seconds !== null && <small>Narração estimada: {page.estimated_narration_seconds} s</small>}</article>)}
      </details>)}
      <div className={local.actions}>{created ? <button className={styles.primary} onClick={() => onOpenStory(created)}>Abrir história no editor</button> : <><button className={styles.secondary} disabled={busy === 'importing'} onClick={onCancel}>Cancelar</button><button className={styles.primary} aria-busy={busy === 'importing'} disabled={busy !== null} onClick={() => void confirm()}><Upload size={17} aria-hidden="true" /> {busy === 'importing' ? 'Importando…' : 'Confirmar importação como rascunho'}</button></>}</div>
    </div>}
  </section>;
}
