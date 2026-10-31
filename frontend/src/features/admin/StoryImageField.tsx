import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { getAdminMediaDetail, uploadAdminMedia, type AdminMedia } from './editorial';
import { MediaThumbnail } from './SceneMediaManager';
import styles from './StoryImageField.module.css';

type Props = {
  label: string;
  value: string | null;
  storyId?: string;
  disabled?: boolean;
  onChange: (id: string | null) => void;
  onUploadingChange: (uploading: boolean) => void;
};

/** Uploads through the same authenticated Storage flow as scene images.
 * Only the metadata form's explicit save associates the returned asset. */
export function StoryImageField({ label, value, storyId, disabled = false, onChange, onUploadingChange }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const uploaded = useRef<AdminMedia | null>(null);
  const [asset, setAsset] = useState<AdminMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setAsset(null); setLoading(false);
    if (!value) return;
    if (uploaded.current?.id === value) { setAsset(uploaded.current); return; }
    // Avoid a request for every character when entering a legacy media reference.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return;
    setLoading(true);
    void getAdminMediaDetail(value).then(result => { if (active) setAsset(result); })
      .catch(() => { if (active) setError('Não foi possível carregar a prévia. Você pode enviar outra imagem ou conferir a referência.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [value]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    const file = field.files?.[0];
    if (!file || disabled || inFlight.current) return;
    setError(''); setNotice('');
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) || (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Escolha uma imagem JPEG, PNG ou WebP.'); field.value = ''; return;
    }
    if (!file.size || file.size > 12 * 1024 * 1024) {
      setError('A imagem deve ter conteúdo e no máximo 12 MB.'); field.value = ''; return;
    }
    inFlight.current = true; setUploading(true); onUploadingChange(true);
    try {
      const result = await uploadAdminMedia(file, { title: file.name, ...(storyId ? { storyId } : {}) });
      if (!mounted.current) return;
      if (result.media_type !== 'image') throw new Error('O arquivo enviado não é uma imagem válida.');
      uploaded.current = result; setAsset(result); onChange(result.id);
      setNotice('Imagem enviada corretamente. Clique em “Salvar história” para aplicar.');
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      inFlight.current = false; field.value = '';
      if (mounted.current) { setUploading(false); onUploadingChange(false); }
    }
  }

  return <fieldset className={styles.field} disabled={disabled || uploading}>
    <legend>{label}</legend>
    {asset?.media_type === 'image' && <div className={styles.preview}><MediaThumbnail key={asset.id} asset={asset} /></div>}
    {loading && <p role="status">Carregando prévia…</p>}
    <input ref={input} hidden type="file" accept=".jpg,.jpeg,.png,.webp" aria-label={`Arquivo de imagem: ${label}`} onChange={event => void upload(event)} />
    <button type="button" className={styles.upload} aria-busy={uploading} onClick={() => input.current?.click()}><Upload size={17} aria-hidden="true" />{uploading ? 'Enviando imagem…' : `Enviar imagem: ${label}`}</button>
    <p className={styles.hint} id={`${id}-help`}>JPEG, PNG ou WebP · até 12 MB. O envio não substitui a imagem até salvar a história. Se cancelar, o arquivo permanece na biblioteca de mídias.</p>
    <details><summary>Referência de mídia existente</summary><label htmlFor={id}>Referência: {label}</label><input id={id} value={value ?? ''} placeholder="UUID da mídia (opcional)" aria-describedby={`${id}-help`} onChange={event => { setError(''); setNotice(''); onChange(event.target.value.trim() || null); }} /></details>
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </fieldset>;
}
