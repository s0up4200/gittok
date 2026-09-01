// localStorage. Token as a plain string, everything else as JSON.
import type { Seen, StarredRepo } from './feed.ts'
import type { EventCache, StatsMap, User } from './github.ts'

export type FeedData = {
  events: EventCache
  starred: StarredRepo[]
  stats: StatsMap
  compares: Record<string, string[]>
  checkedAt: number | null
  capped: boolean
}

export const EMPTY_FEED: FeedData = { events: {}, starred: [], stats: {}, compares: {}, checkedAt: null, capped: false }

const KEYS = {
  token: 'gittok.token',
  user: 'gittok.user',
  seen: 'gittok.seen',
  feed: 'gittok.feed',
  hint: 'gittok.hint',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('gittok: storage write failed', e)
  }
}

export const store = {
  token: () => localStorage.getItem(KEYS.token) ?? '',
  setToken: (t: string) => localStorage.setItem(KEYS.token, t),
  user: () => read<User | null>(KEYS.user, null),
  setUser: (u: User | null) => write(KEYS.user, u),
  seen: () => read<Seen>(KEYS.seen, []),
  setSeen: (s: Seen) => write(KEYS.seen, s),
  feed: () => read<FeedData>(KEYS.feed, EMPTY_FEED),
  setFeed: (f: FeedData) => write(KEYS.feed, f),
  hintDismissed: () => read(KEYS.hint, false),
  dismissHint: () => write(KEYS.hint, true),
  clear: () => Object.values(KEYS).forEach((k) => localStorage.removeItem(k)),
}
