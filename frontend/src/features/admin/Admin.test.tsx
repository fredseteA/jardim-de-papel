import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminContext, type AdminState } from './AdminContext';
import { RequireAdmin } from './AdminLayout';
import { AdminHome, AdminLogin } from './AdminPages';

function setup(overrides: Partial<AdminState>, path = '/admin/login') {
  const state: AdminState = { loading: false, identity: null, error: null, signIn: vi.fn().mockResolvedValue(undefined), signOut: vi.fn().mockResolvedValue(undefined), retry: vi.fn(), ...overrides };
  render(<AdminContext.Provider value={state}><MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/login" element={<AdminLogin />} /><Route element={<RequireAdmin />}><Route path="/admin" element={<AdminHome />} /></Route></Routes></MemoryRouter></AdminContext.Provider>);
  return state;
}

describe('acesso administrativo', () => {
  it('redireciona visitantes para login', () => { setup({}, '/admin'); expect(screen.getByRole('heading', { name: 'Acesso administrativo' })).toBeInTheDocument(); });
  it('apresenta verificação durante carregamento', () => { setup({ loading: true }, '/admin'); expect(screen.getByRole('status')).toHaveTextContent('Verificando'); });
  it('mostra apenas a área autorizada e permite sair', () => { const state = setup({ identity: { id: '1', email: 'admin@example.invalid', role: 'admin' } }, '/admin'); expect(screen.getByText('admin@example.invalid')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /sair/i })); expect(state.signOut).toHaveBeenCalled(); });
  it('envia credenciais e mostra falha sem revelar detalhes', async () => { const signIn = vi.fn().mockRejectedValue(new Error('E-mail ou senha inválidos.')); setup({ signIn }); fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'test@example.invalid' } }); fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong' } }); fireEvent.click(screen.getByRole('button', { name: 'Entrar' })); expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.'); expect(signIn).toHaveBeenCalledWith('test@example.invalid', 'wrong'); });
  it('envia credenciais válidas para o serviço', async () => { const signIn = vi.fn().mockResolvedValue(undefined); setup({ signIn }); fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'test@example.invalid' } }); fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } }); fireEvent.click(screen.getByRole('button', { name: 'Entrar' })); await waitFor(() => expect(signIn).toHaveBeenCalledOnce()); });
  it('não revela conteúdo quando a sessão expirou', () => { setup({ error: 'Sua sessão expirou. Entre novamente.' }, '/admin'); expect(screen.getByRole('alert')).toHaveTextContent('expirou'); expect(screen.queryByText('Um lugar para cultivar histórias.')).not.toBeInTheDocument(); });
});
