import { createContext } from 'react';
import type { createReaderDisplaySession } from './readerDisplaySession';

export const ReaderDisplayContext=createContext<(()=>ReturnType<typeof createReaderDisplaySession>)|null>(null);
