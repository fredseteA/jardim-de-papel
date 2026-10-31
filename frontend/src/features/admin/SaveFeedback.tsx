import styles from './SaveFeedback.module.css';

export function SaveFeedback({ busy = false, success = '', error = '', pending = '' }: { busy?: boolean; success?: string; error?: string; pending?: string }) {
  return <div className={styles.feedback}>
    <p role="status" aria-live="polite" className={!busy && !error && success ? styles.success : undefined}>{busy ? 'Salvando…' : <>{!error && success && <span>{success}</span>}{pending && <span>{pending}</span>}</>}</p>
    {error && <p role="alert" className={styles.error}>Não foi possível concluir o salvamento. {error}</p>}
  </div>;
}
