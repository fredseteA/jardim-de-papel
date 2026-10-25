import { useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Globe2,
  Heart,
  LogOut,
  Settings2,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StoryBookCard } from '../components/stories/StoryBookCard';
import { getStories } from '../lib/api/services';
import { adaptBook } from '../lib/api/adapters';
import { queryKeys } from '../lib/api/queryClient';
import { useApi } from '../lib/api/useApi';
import { HomeHeader } from '../features/discovery/HomeHeader';
import { useFavorites } from '../features/profile/useFavorites';
import styles from './ProfilePage.module.css';

type StoryTab = 'andamento' | 'lidas' | 'favoritas';
const NAME_KEY = 'jardim-de-papel:profile-name';
function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function ProfilePage() {
  const [name, setName] = useState(readName);
  const [draftName, setDraftName] = useState(name);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<StoryTab>('andamento');
  const { favoriteIds } = useFavorites();
  const params = new URLSearchParams({ limit: '100' });
  const catalog = useApi(signal => getStories(params, signal), queryKeys.stories(params));
  const favorites = (catalog.data?.items ?? []).filter((item) => {
    const metadata = item.cover_asset?.asset_metadata.jdp_import_v1;
    const legacyId = metadata && typeof metadata === 'object' && 'id' in metadata ? metadata.id : undefined;
    return favoriteIds.includes(item.id) || (typeof legacyId === 'string' && favoriteIds.includes(legacyId));
  }).map(adaptBook);
  const saveName = () => {
    const value = draftName.trim().slice(0, 40);
    setName(value);
    try {
      localStorage.setItem(NAME_KEY, value);
    } catch {
      /* The name is kept for this session. */
    }
    setEditing(false);
  };

  return (
    <div className={styles.page}>
      <img
        className={styles.decoration}
        src="/assets/decorations/perfil-decoration.png"
        alt=""
        aria-hidden="true"
      />
      <div className={styles.content}>
        <HomeHeader logoBackdrop showActions={false} />
        <section className={styles.intro}>
          <h1>Meu Perfil</h1>
          <p>
            Aqui ficam suas informações, conquistas e preferências no Jardim de
            Papel.
          </p>
        </section>
        <section className={styles.summary} aria-label="Resumo do perfil">
          <div className={styles.identity}>
            <span className={styles.avatar}>
              <UserRound size={28} aria-hidden="true" />
            </span>
            <div>
              <h2>{name || 'Seu perfil'}</h2>
              <p>Perfil local neste dispositivo</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftName(name);
                setEditing(!editing);
              }}
            >
              {editing ? 'Cancelar' : 'Editar nome'}
            </button>
          </div>
          {editing && (
            <form
              className={styles.nameForm}
              onSubmit={(event) => {
                event.preventDefault();
                saveName();
              }}
            >
              <label htmlFor="profile-name">Como podemos chamar você?</label>
              <div>
                <input
                  id="profile-name"
                  maxLength={40}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
                <button type="submit">Salvar</button>
              </div>
            </form>
          )}
          <div className={styles.stats}>
            <div>
              <BookOpen size={20} aria-hidden="true" />
              <strong>—</strong>
              <span>Histórias lidas</span>
            </div>
            <div>
              <Sparkles size={20} aria-hidden="true" />
              <strong>—</strong>
              <span>Conquistas</span>
            </div>
            <div>
              <Heart size={20} aria-hidden="true" />
              <strong>{catalog.data ? favorites.length : '—'}</strong>
              <span>Favoritos</span>
            </div>
          </div>
          <p className={styles.note}>
            Leituras e conquistas estarão disponíveis quando o acompanhamento de
            leitura estiver pronto.
          </p>
        </section>
        <section className={styles.section}>
          <h2>Minhas histórias</h2>
          <div className={styles.tabs} aria-label="Minhas histórias">
            {(
              [
                ['andamento', 'Em andamento'],
                ['lidas', 'Lidas'],
                ['favoritas', 'Favoritas'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? styles.tabActive : ''}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'favoritas' && catalog.error ? (
            <div className={styles.empty} role="alert"><p>{catalog.error}</p><button type="button" onClick={catalog.retry}>Tentar novamente</button></div>
          ) : tab === 'favoritas' && catalog.loading ? (
            <p role="status">Carregando histórias...</p>
          ) : tab === 'favoritas' && favorites.length ? (
            <div className={styles.grid}>
              {favorites.map((book, index) => (
                <StoryBookCard
                  key={book.id}
                  book={book}
                  index={index}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>
                {tab === 'favoritas'
                  ? 'Você ainda não salvou histórias favoritas.'
                  : 'O acompanhamento de leitura estará disponível em breve.'}
              </p>
              <Link to="/biblioteca">Explorar histórias</Link>
            </div>
          )}
        </section>
        <section className={styles.section}>
          <h2>Configurações</h2>
          <div className={styles.options}>
            <details>
              <summary>
                <Globe2 size={20} aria-hidden="true" />
                <span>
                  <strong>Idioma</strong>
                  <small>Português (Brasil)</small>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>
                O aplicativo está disponível em português. Outros idiomas serão
                adicionados futuramente.
              </p>
            </details>
            <details>
              <summary>
                <Bell size={20} aria-hidden="true" />
                <span>
                  <strong>Notificações</strong>
                  <small>Disponível em breve</small>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>
                As notificações ainda não estão disponíveis neste aplicativo.
              </p>
            </details>
            <details>
              <summary>
                <Settings2 size={20} aria-hidden="true" />
                <span>
                  <strong>Preferências</strong>
                  <small>Experiência de leitura</small>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>
                As animações respeitam a preferência de movimento reduzido do
                seu dispositivo. Mais opções de leitura chegarão depois.
              </p>
            </details>
          </div>
        </section>
        <section className={styles.section}>
          <h2>Ajuda e conta</h2>
          <div className={styles.options}>
            <details>
              <summary>
                <CircleHelp size={20} aria-hidden="true" />
                <span>
                  <strong>Ajuda</strong>
                  <small>Sobre esta versão</small>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>
                Explore o catálogo e salve histórias disponíveis como favoritas.
                Os favoritos e o nome são guardados apenas neste dispositivo.
              </p>
            </details>
            <div className={styles.disabledRow}>
              <LogOut size={20} aria-hidden="true" />
              <span>
                <strong>Sair da conta</strong>
                <small>Nenhuma conta conectada</small>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
