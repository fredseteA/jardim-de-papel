import { Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSearch } from './SearchContext';
import styles from './SearchPanel.module.css';
export function SearchButton() { const { isOpen, openSearch, closeSearch, registerTrigger } = useSearch(); const ref = useRef<HTMLButtonElement>(null); useEffect(() => { registerTrigger(ref.current); return () => registerTrigger(null); }, [registerTrigger]); return <button ref={ref} className={styles.trigger} type="button" aria-label={isOpen ? 'Fechar busca' : 'Buscar histórias'} aria-expanded={isOpen} onClick={isOpen ? closeSearch : openSearch}><Search size={20} aria-hidden="true" /></button>; }
