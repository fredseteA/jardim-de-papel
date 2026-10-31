import { createContext, useContext } from 'react';
import type { AdminIdentity } from './auth';

export type AdminState = { loading: boolean; identity: AdminIdentity | null; error: string | null; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; retry: () => void };
export const AdminContext = createContext<AdminState | null>(null);
export function useAdmin() { const value = useContext(AdminContext); if (!value) throw new Error('AdminProvider ausente'); return value; }
