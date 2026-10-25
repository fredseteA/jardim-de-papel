import { Outlet, useLocation } from 'react-router-dom';
import { BottomCornerDecorations } from './BottomCornerDecorations';
import { BottomNavigation } from './BottomNavigation';
import { SearchPanel } from '../../features/search/SearchPanel';
import { SearchProvider } from '../../features/search/SearchProvider';

export function AppShell() {
  const { pathname } = useLocation();
  const hasMobileChrome = !pathname.endsWith('/ler') && !/^\/historias\/[^/]+\/?$/.test(pathname);
  return <SearchProvider><div className="relative min-h-dvh bg-cream"><main><Outlet /></main>{hasMobileChrome && <><BottomCornerDecorations /><BottomNavigation /></>}<SearchPanel /></div></SearchProvider>;
}
