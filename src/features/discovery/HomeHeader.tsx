import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SearchButton } from '../search/SearchButton';
import styles from './HomeHero.module.css';

export function HomeHeader({ logoBackdrop = false, showActions = true }: { logoBackdrop?: boolean; showActions?: boolean }) {
  return <header className={styles.header}>
    <Link to="/" aria-label="Jardim de Papel, início"><img className={`${styles.logo} ${logoBackdrop ? styles.logoBackdrop : ''}`} src="/assets/branding/logo-primary.png" alt="Jardim de Papel" /></Link>
    {showActions && <div className={styles.headerActions}>
      <SearchButton />
      <Link className={styles.headerButton} to="/perfil" aria-label="Meu perfil"><UserRound size={19} aria-hidden="true" /></Link>
    </div>}
  </header>;
}
