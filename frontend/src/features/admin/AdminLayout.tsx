import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AdminProvider } from './AdminProvider';
import { useAdmin } from './AdminContext';
import styles from './Admin.module.css';

export function AdminLayout() { return <AdminProvider><div className={styles.page}><Outlet /></div></AdminProvider>; }
export function RequireAdmin() {
  const { loading, identity, error, retry, signOut } = useAdmin();
  const location = useLocation();
  if (loading) return <main className={styles.center}><p role="status">Verificando seu acesso...</p></main>;
  if (!identity && error) return <main className={styles.center}><div className={styles.panel}><h1>Acesso administrativo</h1><p role="alert">{error}</p><button type="button" onClick={retry}>Tentar novamente</button><button type="button" onClick={() => void signOut()}>Voltar ao login</button></div></main>;
  if (!identity) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
