import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderAudio } from './ReaderAudio';

describe('áudio opcional do leitor', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('oferece somente mídias existentes e mantém a música entre cenas', async () => {
    const playing = new WeakSet<HTMLMediaElement>();
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) { return !playing.has(this); });
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) { playing.add(this); this.dispatchEvent(new Event('play')); return Promise.resolve(); });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) { playing.delete(this); this.dispatchEvent(new Event('pause')); });
    const onNarrationPlayingChange = vi.fn();
    const music = { src: '/tema.mp3', loop: true };
    const { rerender, container } = render(<ReaderAudio pageId="cena-1" narration={{ src: '/cena-1.mp3' }} music={music} paused={false} finished={false} onNarrationPlayingChange={onNarrationPlayingChange} />);

    expect(play).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ativar música' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Silenciar música' })).toBeInTheDocument());
    const musicElement = container.querySelector('audio[src="/tema.mp3"]') as HTMLAudioElement;
    expect(musicElement.loop).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ouvir narração desta cena' })); });
    await waitFor(() => expect(onNarrationPlayingChange).toHaveBeenCalledWith(true));
    const voiceElement = container.querySelector('audio[src="/cena-1.mp3"]') as HTMLAudioElement;

    rerender(<ReaderAudio pageId="cena-2" music={music} paused={false} finished={false} onNarrationPlayingChange={onNarrationPlayingChange} />);
    expect(pause.mock.contexts).toContain(voiceElement);
    expect(pause.mock.contexts).not.toContain(musicElement);
    expect(screen.queryByRole('button', { name: /narração desta cena/ })).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Silenciar música' })); });
    expect(musicElement.muted).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ativar som da música' })); });
    expect(musicElement.muted).toBe(false);
    rerender(<ReaderAudio pageId="cena-2" music={music} paused finished onNarrationPlayingChange={onNarrationPlayingChange} />);
    expect(pause.mock.contexts).toContain(musicElement);
  });

  it('informa quando o navegador não consegue iniciar a reprodução', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
    render(<ReaderAudio pageId="cena-1" narration={{ src: '/voz.mp3' }} paused={false} finished={false} onNarrationPlayingChange={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ouvir narração desta cena' })); });
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi possível reproduzir a narração.');
  });
});
