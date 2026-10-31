import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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

  it('mantém o texto completo no papel sem criar rolagem interna ou sobreposição', () => {
    const longPage = { ...page, animation: undefined, text: 'Uma história longa. '.repeat(100) };
    render(<SceneRenderer page={longPage} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    expect(screen.getByRole('region', { name: 'Página ilustrada da história' })).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('region', {name:'Texto da cena, role para ler o restante'})).not.toBeInTheDocument();
    expect(screen.getByLabelText(longPage.text.trim())).toBeInTheDocument();
  });
  it('separa imagem e texto no celular horizontal e limita o texto à altura útil', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(667);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width:667, height:320, top:0, bottom:320, left:0, right:667, x:0,y:0,toJSON:()=>({}) });
    const { container } = render(<SceneRenderer page={{ ...page, animation:undefined, text:'Uma aventura. '.repeat(40).slice(0,500) }} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={() => {}} />);
    const root = container.querySelector('[data-layout]');
    expect(root).toHaveAttribute('data-layout','spread');
    const narrative = container.querySelector<HTMLElement>('[data-narrative]')!;
    expect(narrative.style.height).toBe(''); expect(narrative.style.transform).toBe('');
    expect(narrative.style.maxHeight).toBe('');
    expect(container.querySelector('[data-scene-illustration]')?.contains(narrative)).toBe(false);
    expect(screen.getByRole('region',{name:'Texto da cena, role para ler o restante'})).toHaveAttribute('tabindex','0');
  });
  it('desativa movimento da arte por preferência do leitor ou configuração editorial',()=>{
    const view=render(<SceneRenderer page={{...page,animation:undefined}} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={()=>{}}/>);
    expect(view.container.querySelector('[data-art-motion]')).toHaveAttribute('data-art-motion','false');
    view.rerender(<SceneRenderer page={{...page,animation:undefined,presentation:{motion:'none'}}} sceneIndex={0} revealed reducedMotion={false} narrationPlaying={false} hasAudio={false} onReveal={()=>{}}/>);
    expect(view.container.querySelector('[data-art-motion]')).toHaveAttribute('data-art-motion','false');
    view.rerender(<SceneRenderer page={{...page,animation:undefined}} sceneIndex={0} revealed reducedMotion={false} narrationPlaying={false} hasAudio={false} onReveal={()=>{}}/>);
    expect(view.container.querySelector('[data-art-motion]')).toHaveAttribute('data-art-motion','true');
  });
  it('preserva parágrafos e ignora recortes legados para manter a ilustração inteira',()=>{
    const text='Primeiro parágrafo.\n\nSegundo parágrafo.';
    const {container}=render(<SceneRenderer page={{...page,animation:undefined,text,presentation:{composition:{version:1,revision:0,layouts:{portrait:{zoom:3,image_x:0,image_y:0,text_x:0,text_y:0}}}}}} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={()=>{}}/>);
    expect(screen.getByLabelText(text,{normalizer:value=>value}).textContent).toBe(text);
    expect(container.querySelector('[data-scene-illustration] img')?.getAttribute('style')).toBeNull();
    expect(container.querySelector('[data-narrative]')?.getAttribute('style')).toBeNull();
  });
  it('usa a proporção nativa de uma imagem 2048×1536 sem solicitar outra variante',()=>{
    const {container}=render(<SceneRenderer page={{...page,animation:undefined}} sceneIndex={0} revealed reducedMotion narrationPlaying={false} hasAudio={false} onReveal={()=>{}}/>);
    const image=screen.getByRole('img',{name:'Uma floresta.'});
    Object.defineProperty(image,'naturalWidth',{value:2048});Object.defineProperty(image,'naturalHeight',{value:1536});fireEvent.load(image);
    expect(container.querySelector<HTMLElement>('[data-scene-illustration]')!.style.aspectRatio).toBe('2048 / 1536');
    expect(image).toHaveAttribute('src','/cena.webp');
  });
});
