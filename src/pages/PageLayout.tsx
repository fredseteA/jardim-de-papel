import type { PropsWithChildren } from 'react';
import { Container } from '../components/layout/Container';
export function PageLayout({ title, children }: PropsWithChildren<{ title: string }>) { return <Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-gold">Jardim de Papel</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-forest sm:text-4xl">{title}</h1><div className="mt-7">{children}</div></Container>; }
