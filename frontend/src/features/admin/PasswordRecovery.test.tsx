import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminForgotPassword, AdminResetPassword } from './AdminPages';

const mocks = vi.hoisted(() => ({
  establish: vi.fn(),
  request: vi.fn(),
  update: vi.fn(),
}));

vi.mock('./auth', () => ({
  establishRecoverySession: mocks.establish,
  requestPasswordRecovery: mocks.request,
  updatePasswordFromRecovery: mocks.update,
}));

function renderRoute(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
    <Route path="/admin/reset-password" element={<AdminResetPassword />} />
    <Route path="/admin/login" element={<p>Login</p>} />
  </Routes></MemoryRouter>);
}

describe('recuperação de senha administrativa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(undefined);
  });

  it('solicita a recuperação sem revelar se o e-mail existe', async () => {
    renderRoute('/admin/forgot-password');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('admin@example.invalid'));
    expect(screen.getByRole('status')).toHaveTextContent('Se este e-mail estiver associado');
  });

  it('bloqueia acesso direto ou link expirado', async () => {
    mocks.establish.mockResolvedValue({ valid: false, message: 'Este link de recuperação é inválido ou expirou.' });
    renderRoute('/admin/reset-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirou');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('não atualiza quando as senhas são diferentes', async () => {
    mocks.establish.mockResolvedValue({ valid: true });
    renderRoute('/admin/reset-password');
    await screen.findByLabelText('Nova senha');
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'SenhaNova123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'OutraSenha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não são iguais');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('atualiza somente após uma recuperação válida e retorna ao login', async () => {
    mocks.establish.mockResolvedValue({ valid: true });
    renderRoute('/admin/reset-password');
    await screen.findByLabelText('Nova senha');
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'SenhaNova123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'SenhaNova123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('SenhaNova123'));
    expect(await screen.findByRole('status')).toHaveTextContent('senha foi redefinida');
  });
});
