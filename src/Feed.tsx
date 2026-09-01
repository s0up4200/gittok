import { useEffect, useRef, useState } from 'react'
import { compareKey, type Card, type RepoStats } from './feed.ts'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { CardView, EndCard, SkeletonCard } from './Card.tsx'
import { Debug } from './Debug.tsx'

export type EndState =
  | { kind: 'loading' }
  | { kind: 'caught-up'; checkedAt: number | null }
  | { kind: 'no-token' }
  | { kind: 'token-rejected' }
  | { kind: 'needs-scope' }
  | { kind: 'rate-limited'; resetAt?: number }
  | { kind: 'offline' }
  | { kind: 'error'; status: number }

type Props = {
  cards: Card[]
  end: EndState
  statsFor: (repo: string) => RepoStats | undefined
  compares: Record<string, string[]>
  isStarred: (repo: string) => boolean
  onStar: (repo: string) => void
  onSeen: (card: Card) => void
  onNearPush: (card: Card) => void
  onRefresh: () => void
  offline: boolean
  toast: string
  hint: boolean
  debug: boolean
  debugInfo: Record<string, string | number | boolean>
  onDismissHint: () => void
}

const SEEN_MS = 1000

export function Feed(p: Props) {
  // `shown` is the list on screen. A new build replaces it only at the top of the feed.
  // Elsewhere it waits behind the "N new" pill, so cards never move under the thumb.
  const [shown, setShown] = useState(p.cards)
  const [pending, setPending] = useState<{ cards: Card[]; count: number } | null>(null)
  const feedRef = useRef<HTMLElement>(null)
  const seenRef = useRef(p.onSeen)
  seenRef.current = p.onSeen
  const nearRef = useRef(p.onNearPush)
  nearRef.current = p.onNearPush

  useEffect(() => {
    const el = feedRef.current
    const known = new Set(shown.map((c) => c.id))
    const fresh = p.cards.filter((c) => !known.has(c.id))
    if (fresh.length === 0) return
    const idx = el ? Math.round(el.scrollTop / el.clientHeight) : 0
    const cur = shown[idx]
    const newer = cur ? fresh.filter((c) => Date.parse(c.at) > Date.parse(cur.at)) : fresh
    if (newer.length === 0) {
      // Older cards only, such as page 2 landing. They sit below the thumb, so insert them in place.
      setShown([...shown, ...fresh].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)))
      return
    }
    if (idx === 0) {
      setShown(p.cards)
      setPending(null)
      el?.scrollTo({ top: 0 })
      return
    }
    setPending({ cards: p.cards, count: newer.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.cards])

  useEffect(() => {
    if (p.end.kind === 'token-rejected') setShown([])
  }, [p.end.kind])

  useEffect(() => {
    const root = feedRef.current
    if (!root) return
    const byId = new Map(shown.map((c) => [c.id, c]))
    const timers = new Map<string, number>()
    const seen = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const card = byId.get((en.target as HTMLElement).dataset.id!)
          if (!card) continue
          if (en.intersectionRatio >= 0.95) {
            if (!timers.has(card.id)) {
              timers.set(
                card.id,
                window.setTimeout(() => {
                  timers.delete(card.id)
                  seenRef.current(card)
                }, SEEN_MS),
              )
            }
          } else {
            clearTimeout(timers.get(card.id))
            timers.delete(card.id)
            if (!en.isIntersecting && en.boundingClientRect.bottom <= (en.rootBounds?.top ?? 0)) seenRef.current(card)
          }
        }
      },
      { root, threshold: [0, 0.95] },
    )
    const near = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const card = byId.get((en.target as HTMLElement).dataset.id!)
          if (en.isIntersecting && card?.push) nearRef.current(card)
        }
      },
      { root, rootMargin: '200% 0px' },
    )
    for (const el of root.querySelectorAll<HTMLElement>('[data-id]')) {
      seen.observe(el)
      if (byId.get(el.dataset.id!)?.push) near.observe(el)
    }
    return () => {
      seen.disconnect()
      near.disconnect()
      timers.forEach((t) => clearTimeout(t))
    }
  }, [shown])

  const jumpToNew = () => {
    if (pending) setShown(pending.cards)
    setPending(null)
    feedRef.current?.scrollTo({ top: 0 })
  }
  const now = Date.now()

  return (
    <div className="shell">
      <main className="feed" ref={feedRef}>
        {p.end.kind === 'loading' && shown.length === 0 ? (
          <SkeletonCard />
        ) : (
          <>
            {shown.map((c) => (
              <CardView
                key={c.id}
                card={c}
                stats={p.statsFor(c.repo)}
                commits={c.push ? p.compares[compareKey(c)] : undefined}
                starred={p.isStarred(c.repo)}
                onStar={p.onStar}
                now={now}
              />
            ))}
            <EndCard end={p.end} onRefresh={p.onRefresh} />
          </>
        )}
      </main>
      {pending && (
        <button className="pill new-pill" onClick={jumpToNew}>
          {pending.count} new
        </button>
      )}
      {p.offline && <div className="pill offline-chip">offline</div>}
      {p.debug && <Debug extra={p.debugInfo} />}
      {p.toast && <div className="toast">{p.toast}</div>}
      {p.hint && (
        <div className="hint">
          <span>Tap Share, then "Add to Home Screen" for the full-screen app.</span>
          <button onClick={p.onDismissHint} aria-label="Dismiss">
            <XMarkIcon className="icon" />
          </button>
        </div>
      )}
    </div>
  )
}
