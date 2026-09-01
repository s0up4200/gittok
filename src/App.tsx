import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildFeed, compareKey, KINDS, markSeen, seenIds, type Card, type Kind, type RepoStats, type Seen } from './feed.ts'
import { ApiError, createClient, type Cause, type Client } from './github.ts'
import { EMPTY_FEED, store, type FeedData } from './store.ts'
import { Feed, type EndState } from './Feed.tsx'
import { Settings } from './Settings.tsx'

type Status = { kind: 'loading' | 'ok' } | { kind: 'error'; cause: Cause; status: number; resetAt?: number }

const isIosSafariTab = 'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === false

function allEvents(data: FeedData) {
  return Object.keys(data.events)
    .sort()
    .flatMap((k) => data.events[k]!.events)
}

export default function App() {
  const [hash, setHash] = useState(location.hash)
  const [token, setToken] = useState(store.token)
  const [user, setUser] = useState(store.user)
  const [data, setData] = useState<FeedData>(store.feed)
  const [seen, setSeen] = useState<Seen>(store.seen)
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [offline, setOffline] = useState(!navigator.onLine)
  const [starOverrides, setStarOverrides] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState('')
  const [hint, setHint] = useState(isIosSafariTab && !store.hintDismissed())
  const [kinds, setKinds] = useState<Kind[]>(store.kinds)
  const [debug, setDebug] = useState(store.debug)
  const [lastError, setLastError] = useState('')

  const dataRef = useRef(data)
  const clientRef = useRef<Client | null>(null)
  const lastFetch = useRef(0)
  const inflight = useRef(false)
  const comparesInFlight = useRef(new Set<string>())

  useEffect(() => {
    dataRef.current = data
    store.setFeed(data)
  }, [data])
  useEffect(() => {
    store.setSeen(seen)
  }, [seen])
  useEffect(() => {
    store.setKinds(kinds)
  }, [kinds])
  useEffect(() => {
    const h = () => setHash(location.hash)
    addEventListener('hashchange', h)
    return () => removeEventListener('hashchange', h)
  }, [])
  useEffect(() => {
    if (!token && hash !== '#settings') location.replace('#settings')
  }, [token, hash])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const client = () => (clientRef.current ??= createClient(store.token()))

  const refresh = useCallback(async (force = false) => {
    if (!store.token() || inflight.current) return
    const c = client()
    if (!force && Date.now() - lastFetch.current < c.pollMs) return
    inflight.current = true
    lastFetch.current = Date.now()
    setStatus({ kind: 'loading' })
    try {
      const ev = await c.events(dataRef.current.events, (_, cache) => setData((d) => ({ ...d, events: cache })))
      const now = Date.now()
      const following = await c.following()
      // Every card the cache can show, seen or not, all kinds. The Feed keeps seen cards on screen and kinds can
      // switch on later, so stats and compares live as long as the events behind them.
      const cards = buildFeed(ev.events, [], new Set(), now, new Set(KINDS.map((k) => k.kind)), new Set(following))
      const inFeed = new Set(cards.map((x) => x.repo))
      // Repos in the cached starred list carry their own stats and star state.
      const cachedStarred = new Set(dataRef.current.starred.map((r) => r.name))
      const repos = [...inFeed].filter((r) => !cachedStarred.has(r))
      // Stats land first. Starred pages can take seconds on a big list, so each page merges into the old list
      // instead of replacing it; a replace would drop stats and star state for repos on later pages.
      const [, st] = await Promise.all([
        repos.length && !c.lowOnRateLimit() ? c.stats(repos).then((s) => setData((d) => ({ ...d, stats: { ...d.stats, ...s } }))) : undefined,
        c.starred((list) =>
          setData((d) => {
            const got = new Set(list.map((r) => r.name))
            return { ...d, starred: [...list, ...d.starred.filter((r) => !got.has(r.name))] }
          }),
        ),
      ])
      const compareKeys = new Set(cards.filter((x) => x.push).map(compareKey))
      setData((d) => ({
        events: ev.cache,
        starred: st.repos,
        following,
        stats: Object.fromEntries(Object.entries(d.stats).filter(([r]) => inFeed.has(r))),
        compares: Object.fromEntries(Object.entries(d.compares).filter(([k]) => compareKeys.has(k))),
        checkedAt: now,
        capped: st.capped,
      }))
      setStarOverrides({})
      setOffline(false)
      setStatus({ kind: 'ok' })
      setLastError('')
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError('http', 0)
      setLastError(`${new Date().toLocaleTimeString()} ${e instanceof Error ? e.message : String(e)}`)
      if (err.cause === 'offline') setOffline(true)
      if (err.cause === 'token-rejected') setData(EMPTY_FEED)
      setStatus({ kind: 'error', cause: err.cause, status: err.status, resetAt: err.resetAt })
    } finally {
      inflight.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    const onOnline = () => {
      setOffline(false)
      refresh()
    }
    const onOffline = () => setOffline(true)
    // An app that stays in the foreground never fires visibilitychange. refresh() holds its own poll cooldown.
    const tick = setInterval(onVisible, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    addEventListener('online', onOnline)
    addEventListener('offline', onOffline)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      removeEventListener('online', onOnline)
      removeEventListener('offline', onOffline)
    }
  }, [refresh])

  // Rebuilds on every seen mark too. Feed only ever adds cards from a rebuild, so nothing moves under the thumb.
  // The clock is the last fetch time, so the memo stays pure. Before the first fetch there is nothing to window.
  const cards = useMemo(
    () => (token ? buildFeed(allEvents(data), data.starred, seenIds(seen), data.checkedAt ?? 0, new Set(kinds), new Set(data.following)) : []),
    [token, data, seen, kinds],
  )

  const starredMap = useMemo(() => new Map(data.starred.map((r) => [r.name, r])), [data.starred])
  const statsFor = (repo: string): RepoStats | undefined => data.stats[repo] ?? starredMap.get(repo)
  const isStarred = (repo: string) => starOverrides[repo] ?? (starredMap.has(repo) || data.stats[repo]?.viewerHasStarred === true)

  const toggleStar = (repo: string) => {
    const on = !isStarred(repo)
    setStarOverrides((o) => ({ ...o, [repo]: on }))
    client()
      .setStar(repo, on)
      .catch(() => {
        setStarOverrides((o) => ({ ...o, [repo]: !on }))
        setToast(on ? 'Star failed' : 'Unstar failed')
      })
  }

  const onSeen = useCallback((card: Card) => {
    setSeen((s) => markSeen(s, card.id, Date.parse(card.at), Date.now()))
  }, [])

  const onNearPush = useCallback((card: Card) => {
    const key = compareKey(card)
    if (dataRef.current.compares[key] || comparesInFlight.current.has(key)) return
    const c = clientRef.current
    if (!c || c.lowOnRateLimit()) return
    comparesInFlight.current.add(key)
    c.compare(card.repo, card.push!.before, card.push!.head)
      .then((lines) => setData((d) => ({ ...d, compares: { ...d.compares, [key]: lines } })))
      .catch(() => {})
      .finally(() => comparesInFlight.current.delete(key))
  }, [])

  const hasCache = cards.length > 0 || data.checkedAt !== null
  const end: EndState = !token
    ? { kind: 'no-token' }
    : status.kind === 'error' && !(status.cause === 'offline' && hasCache)
      ? status.cause === 'http'
        ? { kind: 'error', status: status.status }
        : { kind: status.cause, resetAt: status.resetAt }
      : status.kind === 'loading' && !hasCache
        ? { kind: 'loading' }
        : { kind: 'caught-up', checkedAt: data.checkedAt }

  if (hash === '#settings') {
    return (
      <Settings
        token={token}
        user={user}
        capped={data.capped}
        kinds={kinds}
        onToggleKind={(k) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))}
        debug={debug}
        onToggleDebug={() => {
          store.setDebug(!debug)
          setDebug(!debug)
        }}
        error={status.kind === 'error' && (status.cause === 'token-rejected' || status.cause === 'needs-scope') ? status.cause : null}
        onSave={async (t) => {
          store.setToken(t)
          clientRef.current = createClient(t)
          try {
            const u = await clientRef.current.user()
            store.setUser(u)
            setUser(u)
            if (t !== token) setData(EMPTY_FEED)
            setToken(t)
            setStatus({ kind: 'loading' })
            lastFetch.current = 0
            refresh(true)
            return null
          } catch (e) {
            const cause = e instanceof ApiError ? e.cause : 'http'
            setStatus({ kind: 'error', cause, status: e instanceof ApiError ? e.status : 0 })
            return cause
          }
        }}
        onMarkUnseen={() => setSeen([])}
        onSignOut={() => {
          store.clear()
          clientRef.current = null
          setToken('')
          setUser(null)
          setData(EMPTY_FEED)
          setSeen([])
          setStarOverrides({})
        }}
      />
    )
  }

  return (
    <Feed
      cards={cards}
      end={end}
      statsFor={statsFor}
      compares={data.compares}
      isStarred={isStarred}
      onStar={toggleStar}
      onSeen={onSeen}
      onNearPush={onNearPush}
      onRefresh={() => refresh(status.kind === 'error')}
      offline={offline}
      toast={toast}
      hint={hint}
      debug={debug}
      debugInfo={{
        build: __COMMIT__,
        status: JSON.stringify(status),
        offline,
        // Debug readout only. Refs are read during render so the values can lag one render.
        // oxlint-disable-next-line react/refs
        inflight: inflight.current,
        // oxlint-disable-next-line react/refs
        lastFetch: lastFetch.current ? new Date(lastFetch.current).toLocaleTimeString() : 'never',
        lastError,
      }}
      onDismissHint={() => {
        store.dismissHint()
        setHint(false)
      }}
    />
  )
}
