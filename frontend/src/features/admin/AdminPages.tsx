import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Eye, EyeOff, BookOpen, Layers3, Images, LogOut } from 'lucide-react';
import { Link, Navigate, NavLink } from 'react-router-dom';
import { useAdmin } from './AdminContext';
import { establishRecoverySession, requestPasswordRecovery, updatePasswordFromRecovery } from './auth';
import styles from './Admin.module.css';

export function AdminLogin() {
  const { identity, loading, error, signIn, signOut } = useAdmin();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false); const [submitting, setSubmitting] = useState(false); const [message, setMessage] = useState('');
  if (identity) return <Navigate to="/admin" replace />;
  const submit = async (event: FormEvent) => { event.preventDefault(); setMessage(''); setSubmitting(true); try { await signIn(email.trim(), password); } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível entrar.'); } finally { setSubmitting(false); } };
  return <main className={styles.center}><div className={styles.loginCard}>
    <img src="/assets/branding/logo-primary.png" alt="Jardim de Papel" className={styles.logo} />
    <p className={styles.eyebrow}>ESPAÇO EDITORIAL</p><h1>Acesso administrativo</h1><p className={styles.description}>Entre para cuidar das histórias do Jardim de Papel.</p>
    <form onSubmit={event => void submit(event)}><label htmlFor="admin-email">E-mail</label><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="admin-password">Senha</label><div className={styles.password}><input id="admin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
      {(message || error) && <p className={styles.error} role="alert">{message || error}</p>}
      <button className={styles.primary} disabled={submitting || loading} type="submit">{submitting || loading ? 'Verificando acesso...' : 'Entrar'}</button>
    </form><Link className={styles.textButton} to="/admin/forgot-password">Esqueci minha senha</Link>{error && <button className={styles.textButton} onClick={() => void signOut()}>Usar outra conta</button>}
  </div></main>;
}

export function AdminForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setSubmitting(true);
    try { await requestPasswordRecovery(email.trim()); setSent(true); }
    catch { setError('Não foi possível preparar a recuperação agora. Tente novamente em alguns instantes.'); }
    finally { setSubmitting(false); }
  };
  return <main className={styles.center}><div className={styles.loginCard}>
    <img src="/assets/branding/logo-primary.png" alt="Jardim de Papel" className={styles.logo} />
    <p className={styles.eyebrow}>ESPAÇO EDITORIAL</p><h1>Recuperar senha</h1>
    {sent ? <><p className={styles.description} role="status">Se este e-mail estiver associado a uma conta, enviaremos um link seguro para redefinir a senha.</p><Link className={styles.primaryLink} to="/admin/login">Voltar ao login</Link></> : <>
      <p className={styles.description}>Informe seu e-mail para receber um link seguro de redefinição.</p>
      <form onSubmit={event => void submit(event)}><label htmlFor="recovery-email">E-mail</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.primary} disabled={submitting} type="submit">{submitting ? 'Enviando link...' : 'Enviar link de recuperação'}</button>
      </form><Link className={styles.textButton} to="/admin/login">Voltar ao login</Link>
    </>}
  </div></main>;
}

type PasswordRule = { label: string; valid: boolean };
function passwordRules(password: string): PasswordRule[] {
  return [
    { label: 'Pelo menos 10 caracteres', valid: password.length >= 10 },
    { label: 'Uma letra maiúscula e uma minúscula', valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'Um número', valid: /\d/.test(password) },
  ];
}

export function AdminResetPassword() {
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'complete'>('checking');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false); const [submitting, setSubmitting] = useState(false);
  const rules = useMemo(() => passwordRules(password), [password]);
  const validPassword = rules.every(rule => rule.valid);
  useEffect(() => {
    let current = true;
    void establishRecoverySession().then(result => {
      if (!current) return;
      if (result.valid) setState('ready'); else { setMessage(result.message); setState('invalid'); }
    });
    return () => { current = false; };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validPassword) { setMessage('Escolha uma senha que cumpra todos os requisitos.'); return; }
    if (password !== confirmation) { setMessage('As senhas não são iguais.'); return; }
    setMessage(''); setSubmitting(true);
    try { await updatePasswordFromRecovery(password); setState('complete'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.'); }
    finally { setSubmitting(false); }
  };
  if (state === 'checking') return <main className={styles.center}><div className={styles.loginCard}><p role="status">Validando seu link de recuperação...</p></div></main>;
  if (state === 'invalid') return <main className={styles.center}><div className={styles.loginCard}><h1>Link indisponível</h1><p className={styles.error} role="alert">{message}</p><Link className={styles.primaryLink} to="/admin/forgot-password">Solicitar novo link</Link><Link className={styles.textButton} to="/admin/login">Voltar ao login</Link></div></main>;
  if (state === 'complete') return <main className={styles.center}><div className={styles.loginCard}><h1>Senha atualizada</h1><p className={styles.description} role="status">Sua senha foi redefinida. Entre novamente para acessar o espaço editorial.</p><Link className={styles.primaryLink} to="/admin/login">Ir para o login</Link></div></main>;
  return <main className={styles.center}><div className={styles.loginCard}>
    <img src="/assets/branding/logo-primary.png" alt="Jardim de Papel" className={styles.logo} /><p className={styles.eyebrow}>ESPAÇO EDITORIAL</p><h1>Criar nova senha</h1><p className={styles.description}>Escolha uma senha nova para proteger sua conta.</p>
    <form onSubmit={event => void submit(event)}>
      <label htmlFor="new-admin-password">Nova senha</label><div className={styles.password}><input id="new-admin-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
      <ul className={styles.passwordRules} aria-label="Requisitos de senha">{rules.map(rule => <li className={rule.valid ? styles.validRule : undefined} key={rule.label}>{rule.label}</li>)}</ul>
      <label htmlFor="confirm-admin-password">Confirmar nova senha</label><input id="confirm-admin-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      {message && <p className={styles.error} role="alert">{message}</p>}
      <button className={styles.primary} disabled={submitting} type="submit">{submitting ? 'Atualizando senha...' : 'Redefinir senha'}</button>
    </form>
  </div></main>;
}

export function AdminSidebar({ active }: { active: 'home' | 'stories' | 'media' }) {
  return <aside className={styles.sidebar}><img src="/assets/branding/logo-primary.png" alt="Jardim de Papel" className={styles.logo} /><p className={styles.eyebrow}>ESPAÇO EDITORIAL</p><nav aria-label="Navegação administrativa">
    <NavLink to="/admin" end className={active === 'home' ? styles.activeNav : undefined}>Visão geral</NavLink>
    <NavLink to="/admin/stories" className={active === 'stories' ? styles.activeNav : undefined}>Histórias</NavLink>
    <span>Coleções · Em breve</span><NavLink to="/admin/media" className={active === 'media' ? styles.activeNav : undefined}>Mídias</NavLink>
  </nav></aside>;
}

export function AdminHome() {
  const { identity, signOut } = useAdmin();
  return <div className={styles.dashboard}><AdminSidebar active="home" />
    <main className={styles.main}><header className={styles.header}><span>{identity?.email ?? 'Administrador'}</span><button type="button" onClick={() => void signOut()}><LogOut size={17} /> Sair</button></header><section><p className={styles.eyebrow}>BEM-VINDO AO JARDIM</p><h1>Um lugar para cultivar histórias.</h1><p className={styles.description}>Este é o início do espaço editorial do Jardim de Papel.</p><div className={styles.cards}>{[[BookOpen, 'Histórias'], [Layers3, 'Coleções'], [Images, 'Biblioteca de mídias']].map(([Icon, title]) => { const CardIcon = Icon as typeof BookOpen; return <article key={title as string}><CardIcon size={24} aria-hidden="true" /><h2>{title as string}</h2><p>Disponível em breve</p></article>; })}</div></section></main>
  </div>;
}
