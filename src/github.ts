// GitHub client. Takes an injected fetch so tests pass a fake.
// Plan from .scratch/gittok/spec.md, "Fetch plan and storage".
import type { Event, RepoStats, StarredRepo } from './feed.ts'

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>
export type Cause = 'token-rejected' | 'needs-scope' | 'rate-limited' | 'offline' | 'http'

export class ApiError extends Error {
  cause: Cause
  status: number
  resetAt: number | undefined
  constructor(cause: Cause, status: number, resetAt?: number) {
    super(`${cause} (${status})`)
    this.cause = cause
    this.status = status
    this.resetAt = resetAt
  }
}

export type User = { login: string; avatar_url: string }
export type EventPage = { etag: string; events: Event[]; next: boolean }
export type EventCache = Record<string, EventPage>
export type StatsMap = Record<string, RepoStats & { viewerHasStarred: boolean }>

const API = 'https://api.github.com'
const EVENT_PAGES = 3
export const STARRED_CAP = 1000
export const RATE_FLOOR = 100
const BODY_CAP = 1000
const RELEASE_CAP = 4000

const STARRED_QUERY = `query($after: String) {
  viewer {
    starredRepositories(first: 100, after: $after, orderBy: {field: STARRED_AT, direction: DESC}) {
      isOverLimit
      pageInfo { hasNextPage endCursor }
      nodes {
        nameWithOwner url description stargazerCount forkCount viewerHasStarred
        issues(states: OPEN) { totalCount }
        primaryLanguage { name color }
        owner { avatarUrl }
        latestRelease { databaseId tagName name publishedAt url description isPrerelease }
      }
    }
  }
}`

const FOLLOWING_QUERY = `query($after: String) {
  viewer { following(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { login } } }
}`

const STATS_FIELDS = 'description stargazerCount forkCount viewerHasStarred issues(states: OPEN) { totalCount } primaryLanguage { name color }'

type GqlRepo = {
  nameWithOwner: string
  url: string
  description: string | null
  stargazerCount: number
  forkCount: number
  viewerHasStarred: boolean
  issues: { totalCount: number }
  primaryLanguage: { name: string; color: string } | null
  owner: { avatarUrl: string }
  latestRelease: {
    databaseId: number
    tagName: string
    name: string | null
    publishedAt: string
    url: string
    description: string | null
    isPrerelease: boolean
  } | null
}

type FollowingPage = { viewer: { following: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: { login: string }[] } } }

type StarredPage = {
  viewer: { starredRepositories: { isOverLimit: boolean; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: GqlRepo[] } }
}

const cap = (s: string | null | undefined, max = BODY_CAP) => (s ? s.slice(0, max) : null)

// Keep only what the feed builder reads. PR and issue payloads are large.
export function trimEvent(e: any): Event {
  const p = e.payload ?? {}
  const payload: Event['payload'] = {}
  if (p.action != null) payload.action = p.action
  if (p.ref !== undefined) payload.ref = p.ref
  if (p.ref_type != null) payload.ref_type = p.ref_type
  if (p.head != null) payload.head = p.head
  if (p.before != null) payload.before = p.before
  if (p.description !== undefined) payload.description = p.description
  if (p.pull_request) {
    const pr = p.pull_request
    payload.pull_request = { number: pr.number, title: pr.title, body: cap(pr.body), merged: Boolean(pr.merged), html_url: pr.html_url }
  }
  if (p.issue) payload.issue = { number: p.issue.number, title: p.issue.title, body: cap(p.issue.body), html_url: p.issue.html_url }
  if (p.release) {
    const r = p.release
    payload.release = { id: r.id, tag_name: r.tag_name, name: r.name, body: cap(r.body, RELEASE_CAP), html_url: r.html_url, prerelease: Boolean(r.prerelease) }
  }
  if (p.forkee) payload.forkee = { full_name: p.forkee.full_name, html_url: p.forkee.html_url }
  return {
    id: String(e.id),
    type: e.type,
    created_at: e.created_at,
    actor: { login: e.actor.display_login ?? e.actor.login, avatar_url: e.actor.avatar_url },
    repo: { name: e.repo.name },
    payload,
  }
}

function toStats(r: GqlRepo) {
  return {
    description: cap(r.description, 300),
    stars: r.stargazerCount,
    forks: r.forkCount,
    issues: r.issues.totalCount,
    language: r.primaryLanguage,
    viewerHasStarred: r.viewerHasStarred,
  }
}

function toStarred(r: GqlRepo): StarredRepo {
  const rel = r.latestRelease
  return {
    name: r.nameWithOwner,
    url: r.url,
    ownerAvatar: r.owner.avatarUrl,
    ...toStats(r),
    latestRelease: rel && {
      id: rel.databaseId,
      tagName: rel.tagName,
      name: rel.name,
      publishedAt: rel.publishedAt,
      url: rel.url,
      description: cap(rel.description, RELEASE_CAP),
      isPrerelease: rel.isPrerelease,
    },
  }
}

export function createClient(token: string, fetchImpl: Fetch = (u, i) => fetch(u, i)) {
  let remaining = Infinity
  let pollInterval = 60
  let login: string | null = null

  async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    let res: Response
    try {
      res = await fetchImpl(API + path, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...init.headers,
        },
      })
    } catch {
      throw new ApiError('offline', 0)
    }
    const rem = res.headers.get('x-ratelimit-remaining')
    if (rem !== null) remaining = Number(rem)
    const poll = res.headers.get('x-poll-interval')
    if (poll !== null) pollInterval = Math.max(60, Number(poll))
    if (res.ok || res.status === 304) return res
    if (res.status === 401) throw new ApiError('token-rejected', 401)
    const retryAfter = res.headers.get('retry-after')
    if (res.status === 403 && rem === '0') throw new ApiError('rate-limited', 403, Number(res.headers.get('x-ratelimit-reset')) * 1000)
    if ((res.status === 403 && retryAfter !== null) || res.status === 429) throw new ApiError('rate-limited', res.status, Date.now() + Number(retryAfter ?? 60) * 1000)
    if (res.status === 403 && res.headers.get('x-accepted-oauth-scopes') !== null) throw new ApiError('needs-scope', 403)
    throw new ApiError('http', res.status)
  }

  async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await call('/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) })
    const json = await res.json()
    const types = new Set((json.errors ?? []).map((e: { type?: string }) => e.type))
    if (types.has('RATE_LIMITED')) throw new ApiError('rate-limited', res.status, Number(res.headers.get('x-ratelimit-reset')) * 1000)
    if (types.has('INSUFFICIENT_SCOPES')) throw new ApiError('needs-scope', res.status)
    if (!json.data) throw new ApiError('http', res.status)
    return json.data as T
  }

  const low = () => remaining < RATE_FLOOR

  async function user(): Promise<User> {
    const u = await (await call('/user')).json()
    login = u.login
    return { login: u.login, avatar_url: u.avatar_url }
  }

  const client = {
    get pollMs() {
      return pollInterval * 1000
    },
    lowOnRateLimit: low,
    user,

    // Pages of received_events with a stored ETag per page. A 304 reuses the cached page.
    // Page 1 always runs; later pages stop under the rate-limit floor.
    async events(cache: EventCache, onPage?: (events: Event[], cache: EventCache) => void) {
      login ??= (await user()).login
      const next: EventCache = { ...cache }
      let all: Event[] = []
      for (let page = 1; page <= EVENT_PAGES; page++) {
        if (page > 1 && low()) break
        const key = String(page)
        const cached = next[key]
        const res = await call(`/users/${login}/received_events?per_page=100&page=${page}`, {
          headers: cached ? { 'If-None-Match': cached.etag } : {},
        })
        const data: EventPage =
          res.status === 304 && cached
            ? cached
            : {
                etag: res.headers.get('etag') ?? '',
                events: ((await res.json()) as unknown[]).map(trimEvent),
                next: /rel="next"/.test(res.headers.get('link') ?? ''),
              }
        next[key] = data
        all = all.concat(data.events)
        if (!data.next) {
          for (let p = page + 1; p <= EVENT_PAGES; p++) delete next[String(p)]
        }
        onPage?.(all, { ...next })
        if (!data.next) break
      }
      return { events: all, cache: { ...next } }
    },

    // Starred repos with their latest release, 100 per page, up to the cap.
    async starred(onPage?: (repos: StarredRepo[]) => void) {
      const repos: StarredRepo[] = []
      let after: string | null = null
      let capped = false
      for (;;) {
        if (repos.length > 0 && low()) {
          capped = true
          break
        }
        const data: StarredPage = await graphql(STARRED_QUERY, { after })
        const conn = data.viewer.starredRepositories
        repos.push(...conn.nodes.map(toStarred))
        capped ||= conn.isOverLimit
        onPage?.([...repos])
        if (!conn.pageInfo.hasNextPage) break
        if (repos.length >= STARRED_CAP) {
          capped = true
          break
        }
        after = conn.pageInfo.endCursor
      }
      return { repos, capped }
    },

    // Logins the user follows, 100 per page.
    async following(): Promise<string[]> {
      const out: string[] = []
      let after: string | null = null
      for (;;) {
        const data: FollowingPage = await graphql(FOLLOWING_QUERY, { after })
        const conn = data.viewer.following
        out.push(...conn.nodes.map((n) => n.login))
        if (!conn.pageInfo.hasNextPage) return out
        after = conn.pageInfo.endCursor
      }
    },

    // Stats for repos that received events mention, 50 per aliased query.
    async stats(repos: string[]): Promise<StatsMap> {
      const out: StatsMap = {}
      for (let i = 0; i < repos.length; i += 50) {
        const chunk = repos.slice(i, i + 50)
        const fields = chunk
          .map((full, n) => {
            const [owner, name] = full.split('/')
            return `r${n}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${STATS_FIELDS} }`
          })
          .join('\n')
        let data: Record<string, GqlRepo | null>
        try {
          data = await graphql(`query { ${fields} }`)
        } catch (e) {
          if (e instanceof ApiError && e.cause === 'http') continue
          throw e
        }
        chunk.forEach((full, n) => {
          const r = data[`r${n}`]
          if (r) out[full] = toStats(r)
        })
      }
      return out
    },

    // Commit messages for a push card. Returns [] when the range is gone (force push).
    async compare(repo: string, before: string, head: string): Promise<string[]> {
      try {
        const res = await call(`/repos/${repo}/compare/${before}...${head}?per_page=100`)
        const data = await res.json()
        return (data.commits as { commit: { message: string } }[]).map((c) => c.commit.message.split('\n')[0]!)
      } catch (e) {
        if (e instanceof ApiError && e.cause === 'http') return []
        throw e
      }
    },

    async setStar(repo: string, on: boolean) {
      await call(`/user/starred/${repo}`, { method: on ? 'PUT' : 'DELETE', body: '' })
    },
  }
  return client
}

export type Client = ReturnType<typeof createClient>
