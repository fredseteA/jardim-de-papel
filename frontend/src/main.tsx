import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/api/queryClient';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import './styles/globals.css';
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></StrictMode>);
