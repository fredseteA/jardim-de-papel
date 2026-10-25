import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StoryIllustration, StoryPageLocation } from '../../types/story'
import styles from './TraditionalReader.module.css'

export type TraditionalReaderProps = {
  pages: StoryPageLocation[]
  currentPageId: string
  navigationVersion: number
  fontSize: number
  lineHeight: number
  theme: 'light' | 'sepia' | 'dark'
  textAlign: 'left' | 'justify'
  onVisiblePageChange: (pageId: string) => void
}

/** A sprite is a 2 × 2 sheet; each quadrant has the aspect ratio of the sheet. */
function SceneIllustration({ illustration }: { illustration: StoryIllustration }) {
  const [failed, setFailed] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<string>()

  if (failed) {
    return <p className={styles.imageFallback}>Ilustração indisponível nesta cena.</p>
  }

  const image = (
    <img
      className={illustration.spritePosition ? styles.spriteImage : styles.image}
      data-sprite-position={illustration.spritePosition}
      src={illustration.src}
      alt={illustration.alt}
      loading="lazy"
      decoding="async"
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget
        if (naturalWidth && naturalHeight) setAspectRatio(`${naturalWidth} / ${naturalHeight}`)
      }}
      onError={() => setFailed(true)}
    />
  )

  return (
    <figure className={styles.figure}>
      {illustration.spritePosition ? (
        <div className={styles.spriteFrame} style={aspectRatio ? { aspectRatio } : undefined}>
          {image}
        </div>
      ) : image}
      {illustration.demonstrative && <figcaption className={styles.caption}>Ilustração demonstrativa</figcaption>}
    </figure>
  )
}

/**
 * Only explicit navigationVersion changes scroll the reader. Scrolling the reader
 * itself reports the visible scene without instructing the component to scroll
 * again, preserving a single position shared with the immersive mode.
 */
export function TraditionalReader({
  pages,
  currentPageId,
  navigationVersion,
  fontSize,
  lineHeight,
  theme,
  textAlign,
  onVisiblePageChange,
}: TraditionalReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<string, HTMLElement>())
  const currentPageRef = useRef(currentPageId)
  const lastReportedRef = useRef(currentPageId)
  const callbackRef = useRef(onVisiblePageChange)
  const programmaticScrollRef = useRef(false)
  const syncRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    currentPageRef.current = currentPageId
  }, [currentPageId])

  useLayoutEffect(() => {
    const container = containerRef.current
    const targetId = currentPageRef.current
    const target = pageRefs.current.get(targetId)
    if (!container || !target) return

    // Scroll only this reader, not the page or controls surrounding it.
    programmaticScrollRef.current = true
    lastReportedRef.current = targetId
    container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top
    const frame = window.requestAnimationFrame(() => {
      programmaticScrollRef.current = false
      syncRef.current()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      programmaticScrollRef.current = false
    }
  }, [navigationVersion])

  useEffect(() => {
    callbackRef.current = onVisiblePageChange
  }, [onVisiblePageChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container || pages.length === 0) return

    let frame = 0
    const updateVisiblePage = () => {
      frame = 0
      if (programmaticScrollRef.current) return
      const bounds = container.getBoundingClientRect()
      const readingLine = bounds.top + Math.min(bounds.height * 0.25, 180)
      let selected: string | undefined
      let closest = Number.POSITIVE_INFINITY

      for (const { page } of pages) {
        const element = pageRefs.current.get(page.id)
        if (!element) continue
        const rect = element.getBoundingClientRect()
        // Choose the section containing the reading line; between sections use
        // whichever edge is closest, avoiding artificial progress jumps.
        const distance = rect.top > readingLine
          ? rect.top - readingLine
          : rect.bottom < readingLine ? readingLine - rect.bottom : 0
        if (distance < closest) {
          closest = distance
          selected = page.id
        }
      }

      // A short final scene cannot always be aligned with the reading line:
      // when the reader has actually reached its end, keep that scene active.
      if (container.scrollHeight > container.clientHeight &&
          container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
        selected = pages[pages.length - 1].page.id
      }

      if (selected && selected !== lastReportedRef.current) {
        lastReportedRef.current = selected
        callbackRef.current(selected)
      }
    }

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateVisiblePage)
    }
    syncRef.current = scheduleUpdate
    container.addEventListener('scroll', scheduleUpdate, { passive: true })

    // Observe scene boundaries as well as scroll events so delayed image loads
    // and viewport changes keep the reported position accurate.
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      scheduleUpdate,
      { root: container, rootMargin: '-15% 0px -60% 0px', threshold: 0 },
    )
    pageRefs.current.forEach((element) => observer?.observe(element))

    return () => {
      container.removeEventListener('scroll', scheduleUpdate)
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      syncRef.current = () => {}
    }
  }, [pages])

  return (
    <div
      ref={containerRef}
      className={styles.reader}
      data-theme={theme}
      role="region"
      aria-label="Texto da história"
      tabIndex={0}
    >
      <div className={styles.content}>
        {pages.map(({ chapter, chapterIndex, page, pageNumber, totalPages }, index) => {
          const isChapterStart = index === 0 || pages[index - 1].chapter.id !== chapter.id
          return (
            <article
              ref={(element) => {
                if (element) pageRefs.current.set(page.id, element)
                else pageRefs.current.delete(page.id)
              }}
              key={`${chapter.id}-${page.id}`}
              className={styles.scene}
              aria-label={`Cena ${pageNumber} de ${totalPages}`}
            >
              {isChapterStart && (
                <header className={styles.chapterHeader}>
                  <p className={styles.chapterNumber}>Capítulo {chapterIndex + 1}</p>
                  <h2 className={styles.chapterTitle}>{chapter.title}</h2>
                </header>
              )}
              {(page.illustration ?? page.animation?.poster)?.src && (
                <SceneIllustration key={`${page.id}-${(page.illustration ?? page.animation?.poster)?.src}`} illustration={(page.illustration ?? page.animation?.poster)!} />
              )}
              <div className={styles.text} style={{ fontSize, lineHeight, textAlign }}>
                {page.text.split(/\n\s*\n/u).filter(Boolean).map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
