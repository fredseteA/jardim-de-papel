import { BookOpen, House, Layers3, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import styles from './BottomNavigation.module.css';

const items = [
  { label: 'Início', to: '/', icon: House, active: (path: string, hash: string) => path === '/' && hash !== '#colecoes' && hash !== '#perfil' },
  { label: 'Biblioteca', to: '/biblioteca', icon: BookOpen, active: (path: string) => path === '/biblioteca' },
  { label: 'Coleções', to: '/colecoes', icon: Layers3, active: (path: string) => path === '/colecoes' || path.startsWith('/colecoes/') },
  { label: 'Perfil', to: '/perfil', icon: UserRound, active: (path: string) => path === '/perfil' },
];

export function BottomNavigation() {
  const { pathname, hash } = useLocation();
  return <nav className={styles.navigation} aria-label="Navegação principal">{items.map(({ label, to, icon: Icon, active }) => { const isActive = active(pathname, hash); return <Link key={label} className={`${styles.item} ${isActive ? styles.active : ''}`} to={to} aria-current={isActive ? 'page' : undefined}><span className={styles.icon}><Icon size={17} aria-hidden="true" /></span><span>{label}</span>{isActive && <span className={styles.indicator} aria-hidden="true" />}</Link>; })}</nav>;
}
