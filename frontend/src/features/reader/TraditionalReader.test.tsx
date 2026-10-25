import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StoryChapter, StoryPage, StoryPageLocation } from '../../types/story'
import { TraditionalReader, type TraditionalReaderProps } from './TraditionalReader'

const firstPage: StoryPage = {
  id: 'primeira',
  order: 1,
  text: 'Uma manhã começou na floresta.\n\nA menina saiu para uma aventura.',
  illustration: {
    src: '/cenas.png',
    alt: 'Uma menina na floresta',
    demonstrative: true,
    spritePosition: 'top-right',
  },
}
const secondPage: StoryPage = { id: 'segunda', order: 1, text: 'O caminho continuava.' }
const firstChapter: StoryChapter = {
  id: 'capitulo-1', slug: 'inicio', title: 'O começo', order: 1, pages: [firstPage],
}
const secondChapter: StoryChapter = {
  id: 'capitulo-2', slug: 'caminho', title: 'Pelo caminho', order: 2, pages: [secondPage],
}
const pages: StoryPageLocation[] = [
  { chapter: firstChapter, chapterIndex: 0, page: firstPage, pageIndex: 0, pageNumber: 1, totalPages: 2 },
  { chapter: secondChapter, chapterIndex: 1, page: secondPage, pageIndex: 0, pageNumber: 2, totalPages: 2 },
]

function props(overrides: Partial<TraditionalReaderProps> = {}): TraditionalReaderProps {
  return {
    pages,
    currentPageId: firstPage.id,
    navigationVersion: 0,
    fontSize: 20,
    lineHeight: 1.8,
    theme: 'sepia',
    textAlign: 'justify',
    onVisiblePageChange: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TraditionalReader', () => {
  it('renders chapters and narrative using the supplied reading preferences', () => {
    const { rerender } = render(<TraditionalReader {...props()} />)

    expect(screen.getByRole('heading', { name: 'O começo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pelo caminho' })).toBeInTheDocument()
    expect(screen.getByText('Uma manhã começou na floresta.')).toBeInTheDocument()
    expect(screen.getByText('A menina saiu para uma aventura.')).toBeInTheDocument()
    expect(screen.getByText('O caminho continuava.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Texto da história' })).toHaveAttribute('data-theme', 'sepia')
    expect(screen.getByText('Uma manhã começou na floresta.').parentElement).toHaveStyle({
      fontSize: '20px', lineHeight: '1.8', textAlign: 'justify',
    })

    const image = screen.getByRole('img', { name: 'Uma menina na floresta' })
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('data-sprite-position', 'top-right')
    expect(screen.getByText('Ilustração demonstrativa')).toBeInTheDocument()

    rerender(<TraditionalReader {...props({ theme: 'dark', fontSize: 24, lineHeight: 2, textAlign: 'left' })} />)
    expect(screen.getByRole('region', { name: 'Texto da história' })).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByText('Uma manhã começou na floresta.').parentElement).toHaveStyle({
      fontSize: '24px', lineHeight: '2', textAlign: 'left',
    })
  })

  it('omits absent images and provides a readable fallback if a file fails', () => {
    render(<TraditionalReader {...props()} />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByText('Ilustração indisponível nesta cena.')).not.toBeInTheDocument()

    fireEvent.error(screen.getByRole('img', { name: 'Uma menina na floresta' }))
    expect(screen.getByText('Ilustração indisponível nesta cena.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('O caminho continuava.')).toBeInTheDocument()
  })

  it('scrolls only for explicit navigation and reports scrolling without a navigation loop', () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const reader = document.querySelector<HTMLElement>('[aria-label="Texto da história"]')
      const scrollTop = reader?.scrollTop ?? 0
      const label = this.getAttribute('aria-label')
      const top = label === 'Cena 1 de 2' ? -scrollTop : label === 'Cena 2 de 2' ? 600 - scrollTop : 0
      const height = label?.startsWith('Cena ') ? 600 : 400
      return {
        x: 0, y: top, top, bottom: top + height, left: 0, right: 320,
        width: 320, height, toJSON: () => ({}),
      } as DOMRect
    })

    const onVisiblePageChange = vi.fn()
    const initialProps = props({ onVisiblePageChange })
    const { rerender } = render(<TraditionalReader {...initialProps} />)
    const reader = screen.getByRole('region', { name: 'Texto da história' })
    Object.defineProperty(reader, 'clientHeight', { value: 400, configurable: true })
    Object.defineProperty(reader, 'scrollHeight', { value: 1200, configurable: true })
    act(() => { vi.advanceTimersByTime(48) })
    expect(reader.scrollTop).toBe(0)

    // An update caused by observation must not itself reposition the reader.
    rerender(<TraditionalReader {...initialProps} currentPageId="segunda" />)
    expect(reader.scrollTop).toBe(0)

    // A navigation action does reposition it, without reporting a spurious scene.
    rerender(<TraditionalReader {...initialProps} currentPageId="segunda" navigationVersion={1} />)
    expect(reader.scrollTop).toBe(600)
    act(() => { vi.advanceTimersByTime(48) })
    expect(onVisiblePageChange).not.toHaveBeenCalled()

    reader.scrollTop = 0
    fireEvent.scroll(reader)
    act(() => { vi.advanceTimersByTime(48) })
    expect(onVisiblePageChange).toHaveBeenCalledOnce()
    expect(onVisiblePageChange).toHaveBeenCalledWith('primeira')
  })
})
