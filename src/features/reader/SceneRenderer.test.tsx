import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneRenderer } from './SceneRenderer';
import type { StoryPage } from '../../types/story';

const page: StoryPage = {
  id: 'cena-1', order: 1, text: 'Um novo caminho.',
  illustration: { src: '/cena.webp', alt: 'Uma floresta.' },
  animation: { src: '/cena.mp4', loop: true, muted: true, playbackBehavior: 'on-page-enter' },
};

describe('mídia da cena', () => {
  beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it('usa o vídeo escolhido e apresenta a imagem da cena se ele falhar', () => {
    const { container } = render(<SceneRenderer page={page} sceneIndex={0} revealed reducedMotion={false} narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', '/cena.mp4');
    expect(video).toHaveAttribute('autoplay');
    fireEvent.error(video!);
    expect(screen.getByRole('img', { name: 'Uma floresta.' })).toHaveAttribute('src', '/cena.webp');
  });

  it('em movimento reduzido usa o pôster de uma cena somente com vídeo', () => {
    const videoOnly: StoryPage = { ...page, illustration: undefined, animation: { ...page.animation!, poster: { src: '/poster.webp', alt: 'Uma floresta tranquila.' } } };
    const { container } = render(<SceneRenderer page={videoOnly} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByRole('img', { name: 'Uma floresta tranquila.' })).toHaveAttribute('src', '/poster.webp');
  });

  it('pausa o vídeo ao sair da cena', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const view = render(<SceneRenderer page={page} sceneIndex={0} revealed reducedMotion={false} narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    view.unmount();
    expect(pause).toHaveBeenCalled();
  });

  it('mantém um texto longo acessível em uma região rolável', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
    const longPage = { ...page, animation: undefined, text: 'Uma história longa. '.repeat(100) };
    render(<SceneRenderer page={longPage} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    expect(screen.getByRole('region', { name: 'Texto da cena, role para ler o restante' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Role para continuar ↓')).toBeInTheDocument();
    expect(screen.getByLabelText(longPage.text.trim())).toBeInTheDocument();
  });
});
