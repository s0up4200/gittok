// Feed builder. A pure function: it takes events, starred repos, seen ids, and a clock, and returns ordered Cards.
// Rules from .scratch/gittok/spec.md, "Feed building".

export type Actor = { login: string; avatar: string }

// Trimmed copy of one received_events item. The client trims at ingest so the cache stays small.
export type Event = {
  id: string
  type: string
  created_at: string
  actor: { login: string; avatar_url: string }
  repo: { name: string }
  payload: {
    action?: string
    ref?: string | null
    ref_type?: string
    head?: string
    before?: string
    description?: string | null
    pull_request?: { number: number; title: string; body: string | null; merged: boolean; html_url: string }
    issue?: { number: number; title: string; body: string | null; html_url: string }
    release?: { id: number; tag_name: string; name: string | null; body: string | null; html_url: string; prerelease: boolean }
    forkee?: { full_name: string; html_url: string }
  }
}

export type RepoStats = {
  description: string | null
  stars: number
  forks: number
  issues: number
  language: { name: string; color: string } | null
}

export type StarredRepo = RepoStats & {
  name: string
  url: string
  ownerAvatar: string
  latestRelease: {
    id: number
    tagName: string
    name: string | null
    publishedAt: string
    url: string
    description: string | null
    isPrerelease: boolean
  } | null
}

export type Card = {
  id: string
  shape: 'repo' | 'change' | 'release'
  label: string
  verb: string
  actors: Actor[]
  repo: string
  url: string
  at: string
  title: string
  body: string[]
  meta: string
  push?: { ref: string; before: string; head: string; count: number }
}

// Feed filters, one per GitHub feed category the Events API can serve.
export type Kind = 'releases' | 'stars' | 'repos' | 'activity' | 'pushes'
export const KINDS: { kind: Kind; label: string; detail: string }[] = [
  { kind: 'releases', label: 'Releases', detail: 'From watched and starred repos' },
  { kind: 'stars', label: 'Stars', detail: 'Repos starred by people you follow' },
  { kind: 'repos', label: 'Repositories', detail: 'Created, forked, or made public' },
  { kind: 'activity', label: 'Repository activity', detail: 'Issues and pull requests' },
  { kind: 'pushes', label: 'Pushes', detail: 'Commits pushed to a branch' },
]
export const DEFAULT_KINDS: Kind[] = ['releases', 'stars', 'repos', 'pushes']

const KIND_OF: Record<string, Kind> = {
  ReleaseEvent: 'releases',
  WatchEvent: 'stars',
  ForkEvent: 'repos',
  CreateEvent: 'repos',
  PublicEvent: 'repos',
  PullRequestEvent: 'activity',
  IssuesEvent: 'activity',
  PushEvent: 'pushes',
}

// Seen ids with the card time, so pruning can drop the oldest cards first.
export type Seen = [id: string, at: number][]

const WINDOW_MS = 30 * 86_400_000
const PUSH_WINDOW_MS = 6 * 3_600_000
const REPO_WINDOW_MS = 24 * 3_600_000
const SEEN_CAP = 1000
// Lines a card shows before the reader taps "more".
export const FOLD_LINES = 8

export function releaseCardId(releaseId: number) {
  return `release-${releaseId}`
}

export function compareKey(card: Card) {
  return `${card.repo}/${card.push!.before}...${card.push!.head}`
}

function shortRef(ref: string | null | undefined) {
  return (ref ?? '').replace(/^refs\/(heads|tags)\//, '')
}

// Turns Markdown text into plain lines.
export function bodyLines(text: string | null | undefined, max?: number): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/<!--.*?-->/g, '').replace(/^[\s#>*-]+/, '').replace(/\*\*|`/g, '').trim())
    .filter(Boolean)
    .slice(0, max)
}

function actor(e: Event): Actor {
  return { login: e.actor.login, avatar: e.actor.avatar_url }
}

function repoUrl(name: string) {
  return `https://github.com/${name}`
}

// One event to one Card, or null when the type or action is dropped.
function toCard(e: Event): Card | null {
  const p = e.payload
  const base = { id: e.id, actors: [actor(e)], repo: e.repo.name, url: repoUrl(e.repo.name), at: e.created_at, body: [] as string[], meta: '' }
  switch (e.type) {
    case 'ReleaseEvent': {
      const r = p.release
      if (!r) return null
      return releaseCard(base, { id: r.id, tag: r.tag_name, name: r.name, notes: r.body, url: r.html_url, prerelease: r.prerelease })
    }
    case 'PushEvent': {
      const ref = shortRef(p.ref)
      return {
        ...base,
        shape: 'change',
        label: 'Push',
        verb: 'pushed',
        url: `${base.url}/compare/${p.before}...${p.head}`,
        title: `Pushed to ${ref}`,
        meta: (p.head ?? '').slice(0, 7),
        push: { ref, before: p.before ?? '', head: p.head ?? '', count: 1 },
      }
    }
    case 'PullRequestEvent': {
      const pr = p.pull_request
      if (!pr) return null
      const merged = p.action === 'closed' && pr.merged
      if (p.action !== 'opened' && !merged) return null
      return {
        ...base,
        shape: 'change',
        label: merged ? 'PR merged' : 'PR opened',
        verb: merged ? 'merged' : 'opened',
        url: pr.html_url,
        title: pr.title,
        body: bodyLines(pr.body, 3),
        meta: `#${pr.number}`,
      }
    }
    case 'IssuesEvent': {
      const issue = p.issue
      if (!issue || p.action !== 'opened') return null
      return {
        ...base,
        shape: 'change',
        label: 'Issue opened',
        verb: 'opened',
        url: issue.html_url,
        title: issue.title,
        body: bodyLines(issue.body, 3),
        meta: `#${issue.number}`,
      }
    }
    case 'WatchEvent':
      return { ...base, shape: 'repo', label: 'Star', verb: 'starred', title: '' }
    case 'ForkEvent':
      return { ...base, shape: 'repo', label: 'Fork', verb: 'forked', title: '', meta: p.forkee ? `→ ${p.forkee.full_name}` : '' }
    case 'CreateEvent':
      if (p.ref_type !== 'repository') return null
      return { ...base, shape: 'repo', label: 'New repo', verb: 'created', title: p.description ?? '' }
    case 'PublicEvent':
      return { ...base, shape: 'repo', label: 'Went public', verb: 'made public', title: '' }
    default:
      console.debug(`gittok: dropped ${e.type}`)
      return null
  }
}

type Release = { id: number; tag: string; name: string | null; notes: string | null; url: string; prerelease: boolean }

function releaseCard(base: Omit<Card, 'shape' | 'label' | 'verb' | 'title'>, r: Release): Card {
  return {
    ...base,
    id: releaseCardId(r.id),
    shape: 'release',
    label: 'Release',
    verb: 'released',
    url: r.url,
    title: r.name || r.tag,
    body: bodyLines(r.notes),
    meta: r.prerelease ? `${r.tag} · pre-release` : r.tag,
  }
}

function starredReleaseCard(r: StarredRepo): Card | null {
  const rel = r.latestRelease
  if (!rel) return null
  const owner = r.name.split('/')[0]!
  const base = { id: '', actors: [{ login: owner, avatar: r.ownerAvatar }], repo: r.name, url: r.url, at: rel.publishedAt, body: [], meta: '' }
  return releaseCard(base, { id: rel.id, tag: rel.tagName, name: rel.name, notes: rel.description, url: rel.url, prerelease: rel.isPrerelease })
}

function groupKey(c: Card): string | null {
  if (c.push) return `push|${c.repo}|${c.actors[0]!.login}|${c.push.ref}`
  if (c.label === 'Star' || c.label === 'Fork') return `${c.label}|${c.repo}`
  return null
}

// received_events also carries stars and forks by anyone on a watched repo. Only ones by followed users make cards.
const BY_FOLLOWED = new Set(['WatchEvent', 'ForkEvent'])

export function buildFeed(events: Event[], starred: StarredRepo[], seen: Set<string>, now: number, kinds: Set<Kind>, following: Set<string>): Card[] {
  const oldest = now - WINDOW_MS
  // Dedupe by card id: repeated event pages, and the same release from two events or two Sources.
  const ids = new Set<string>()
  const cards: Card[] = []
  const add = (c: Card | null) => {
    if (!c || ids.has(c.id)) return
    ids.add(c.id)
    cards.push(c)
  }
  for (const e of events) {
    const kind = KIND_OF[e.type]
    if (kind && !kinds.has(kind)) continue
    if (BY_FOLLOWED.has(e.type) && !following.has(e.actor.login)) continue
    add(toCard(e))
  }
  if (kinds.has('releases')) for (const r of starred) add(starredReleaseCard(r))
  cards.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  // Collapse. Newest first, so the first card of a group keeps its slot and older ones fold in.
  const groups = new Map<string, Card>()
  const out: Card[] = []
  for (const c of cards) {
    const at = Date.parse(c.at)
    if (at < oldest) continue
    const key = groupKey(c)
    const head = key ? groups.get(key) : undefined
    const span = c.push ? PUSH_WINDOW_MS : REPO_WINDOW_MS
    if (key && head && Date.parse(head.at) - at <= span) {
      if (head.push && c.push) {
        head.push.count += 1
        head.push.before = c.push.before
        head.title = `${head.push.count} pushes to ${head.push.ref}`
        head.url = `${repoUrl(head.repo)}/compare/${head.push.before}...${head.push.head}`
      } else if (!head.actors.some((a) => a.login === c.actors[0]!.login)) {
        head.actors.push(c.actors[0]!)
      }
      continue
    }
    if (key) groups.set(key, c)
    out.push(c)
  }
  return out.filter((c) => !seen.has(c.id))
}

export function markSeen(seen: Seen, id: string, at: number, now: number): Seen {
  const oldest = now - WINDOW_MS
  const next = seen.filter(([sid, sat]) => sid !== id && sat >= oldest)
  next.push([id, at])
  next.sort((a, b) => a[1] - b[1])
  return next.slice(-SEEN_CAP)
}

export function seenIds(seen: Seen) {
  return new Set(seen.map(([id]) => id))
}

// "alice, bob +1 starred"
export function actorLine(c: Card) {
  const [a, b, ...rest] = c.actors
  let who = a!.login
  if (b) who += `, ${b.login}`
  if (rest.length) who += ` +${rest.length}`
  return `${who} ${c.verb}`
}

export function ago(iso: string, now: number) {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86_400)}d`
}
