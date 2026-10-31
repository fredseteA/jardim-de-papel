import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAdminStory, type AdminStory } from './editorial';
import styles from './Admin.module.css';
import local from './DeleteStoryDialog.module.css';

export function DeleteStoryDialog({ story, onClose, onDeleted }: { story: AdminStory; onClose: () => void; onDeleted: (story: AdminStory) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const titleId = useId(); const descriptionId = useId();
  const [slug, setSlug] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node?.showModal(); cancel.current?.focus();
    return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); else document.getElementById('stories-title')?.focus(); };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (slug !== story.slug || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await deleteAdminStory(story.id, slug); onDeleted(story); }
    catch (reason) { setError(`${reason instanceof Error ? reason.message : 'Não foi possível confirmar a exclusão.'} Se houve falha de conexão, confira o catálogo antes de tentar novamente.`); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} className={local.dialog} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose(); }}>
    <p className={styles.eyebrow}>EXCLUSÃO PERMANENTE</p><h2 id={titleId}>Excluir “{story.title}”?</h2>
    <div id={descriptionId}><p>{story.status === 'published' ? 'Esta história está publicada e deixará de estar disponível para os leitores.' : 'Esta história será removida do catálogo editorial.'}</p><p>Serão excluídos os capítulos, cenas, vínculos de mídia, favoritos e progresso associados a esta história. A ação não pode ser desfeita.</p><p>As coleções e os arquivos da biblioteca de mídias serão preservados.</p></div>
    <form onSubmit={event => void submit(event)}><label>Para confirmar, digite o slug <strong>{story.slug}</strong><input aria-label="Slug para confirmar exclusão" autoComplete="off" spellCheck={false} value={slug} disabled={busy} onChange={event => setSlug(event.target.value)} /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {busy && <p role="status">Excluindo história…</p>}
      <div className={local.actions}><button ref={cancel} className={styles.secondary} type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className={styles.danger} type="submit" disabled={busy || slug !== story.slug} aria-busy={busy}><Trash2 size={17} aria-hidden="true" /> {busy ? 'Excluindo…' : 'Excluir definitivamente'}</button></div>
    </form>
  </dialog>;
}
