import { describe, expect, test } from 'bun:test'
import { ApiError, createClient, RATE_FLOOR, trimEvent, type Fetch } from './github.ts'

type Call = { url: string; init: RequestInit }
type Reply = { status?: number; body?: unknown; headers?: Record<string, string> }

// Fake fetch: replies in order, records calls. Never touches the network.
function fake(replies: Reply[] | ((call: Call, n: number) => Reply)) {
  const calls: Call[] = []
  const fetchImpl: Fetch = async (url, init = {}) => {
    const call = { url, init }
    const r = typeof replies === 'function' ? replies(call, calls.length) : replies[calls.length]
    calls.push(call)
    if (!r) throw new Error(`unexpected call ${calls.length}: ${url}`)
    const status = r.status ?? 200
    return new Response(status === 304 ? null : JSON.stringify(r.body ?? {}), {
      status,
      headers: { 'x-ratelimit-remaining': '4000', ...r.headers },
    })
  }
  return { fetchImpl, calls }
}

const rawEvent = (id: number) => ({
  id,
  type: 'WatchEvent',
  actor: { login: 'alice', display_login: 'alice', avatar_url: 'a' },
  repo: { name: 'octo/repo' },
  payload: { action: 'started' },
  created_at: '2026-09-01T00:00:00Z',
})
const user = { status: 200, body: { login: 'me', avatar_url: 'me.png' } }
const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name]

describe('events', () => {
  test('sends auth and version headers, pages until no next link, trims events', async () => {
    const { fetchImpl, calls } = fake([
      user,
      { body: [rawEvent(1)], headers: { etag: '"e1"', link: '<x>; rel="next"' } },
      { body: [rawEvent(2)], headers: { etag: '"e2"' } },
    ])
    const pages: number[] = []
    const caches: unknown[] = []
    const { events, cache } = await createClient('tok', fetchImpl).events({}, (all, c) => {
      pages.push(all.length)
      caches.push(c)
    })
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.github.com/user',
      'https://api.github.com/users/me/received_events?per_page=100&page=1',
      'https://api.github.com/users/me/received_events?per_page=100&page=2',
    ])
    expect(header(calls[1]!, 'Authorization')).toBe('Bearer tok')
    expect(header(calls[1]!, 'X-GitHub-Api-Version')).toBe('2022-11-28')
    expect(events.map((e) => e.id)).toEqual(['1', '2'])
    expect(events[0]).toEqual({ id: '1', type: 'WatchEvent', created_at: '2026-09-01T00:00:00Z', actor: { login: 'alice', avatar_url: 'a' }, repo: { name: 'octo/repo' }, payload: { action: 'started' } })
    expect(cache['1']!.etag).toBe('"e1"')
    expect(pages).toEqual([1, 2])
    // Each page hands out a new object, so React state keyed on identity updates.
    expect(new Set([...caches, cache]).size).toBe(3)
  })

  test('sends the stored ETag and reuses the cached page on 304', async () => {
    const { fetchImpl, calls } = fake([user, { status: 304 }])
    const cached = { '1': { etag: '"e1"', events: [{ ...rawEvent(9), id: '9' } as any], next: false } }
    const { events } = await createClient('tok', fetchImpl).events(cached)
    expect(header(calls[1]!, 'If-None-Match')).toBe('"e1"')
    expect(events.map((e) => e.id)).toEqual(['9'])
  })

  test('stops at three pages and drops stale cached pages past the end', async () => {
    const more = { body: [rawEvent(1)], headers: { link: '<x>; rel="next"' } }
    const { fetchImpl, calls } = fake([user, more, more, more, more])
    const { cache } = await createClient('tok', fetchImpl).events({ '3': { etag: 'old', events: [], next: true } })
    expect(calls).toHaveLength(4)
    expect(Object.keys(cache)).toEqual(['1', '2', '3'])

    const short = fake([user, { body: [rawEvent(1)] }])
    const res = await createClient('tok', short.fetchImpl).events({ '2': { etag: 'old', events: [], next: false } })
    expect(Object.keys(res.cache)).toEqual(['1'])
  })

  test('the rate-limit floor stops background pages but not page 1', async () => {
    const { fetchImpl, calls } = fake([user, { body: [rawEvent(1)], headers: { link: '<x>; rel="next"', 'x-ratelimit-remaining': String(RATE_FLOOR - 1) } }])
    const client = createClient('tok', fetchImpl)
    await client.events({})
    expect(calls).toHaveLength(2)
    expect(client.lowOnRateLimit()).toBe(true)
  })
})

describe('starred', () => {
  const page = (n: number, hasNextPage: boolean, extra: Record<string, unknown> = {}) => ({
    body: {
      data: {
        viewer: {
          starredRepositories: {
            isOverLimit: false,
            pageInfo: { hasNextPage, endCursor: `c${n}` },
            nodes: Array.from({ length: 100 }, (_, i) => ({
              nameWithOwner: `o/r${n}-${i}`,
              url: 'u',
              description: null,
              stargazerCount: 1,
              forkCount: 0,
              viewerHasStarred: true,
              issues: { totalCount: 0 },
              primaryLanguage: null,
              owner: { avatarUrl: 'av' },
              latestRelease: i === 0 ? { databaseId: n, tagName: 'v1', name: null, publishedAt: '2026-09-01T00:00:00Z', url: 'u', description: 'notes', isPrerelease: false } : null,
            })),
            ...extra,
          },
        },
      },
    },
  })

  test('pages with the cursor until hasNextPage is false', async () => {
    const { fetchImpl, calls } = fake([page(1, true), page(2, false)])
    const lists: unknown[] = []
    const { repos, capped } = await createClient('tok', fetchImpl).starred((r) => lists.push(r))
    expect(repos).toHaveLength(200)
    expect(new Set(lists).size).toBe(2)
    expect(capped).toBe(false)
    expect(JSON.parse(calls[1]!.init.body as string).variables.after).toBe('c1')
    expect(repos[0]!.latestRelease).toEqual({ id: 1, tagName: 'v1', name: null, publishedAt: '2026-09-01T00:00:00Z', url: 'u', description: 'notes', isPrerelease: false })
  })

  test('stops at the cap and reports it, also when isOverLimit is set', async () => {
    const { fetchImpl, calls } = fake((_, n) => page(n, true))
    const { repos, capped } = await createClient('tok', fetchImpl).starred()
    expect(repos).toHaveLength(1000)
    expect(calls).toHaveLength(10)
    expect(capped).toBe(true)

    const over = fake([page(1, false, { isOverLimit: true })])
    expect((await createClient('tok', over.fetchImpl).starred()).capped).toBe(true)
  })

  test('the rate-limit floor stops paging after the first page and reports the cut', async () => {
    const low = { ...page(1, true), headers: { 'x-ratelimit-remaining': '50' } }
    const { fetchImpl, calls } = fake([low, low])
    const { repos, capped } = await createClient('tok', fetchImpl).starred()
    expect(repos).toHaveLength(100)
    expect(calls).toHaveLength(1)
    expect(capped).toBe(true)
  })

  test('GraphQL rate limit and scope errors arrive as HTTP 200 with an errors list', async () => {
    const rl = fake([{ body: { errors: [{ type: 'RATE_LIMITED' }] }, headers: { 'x-ratelimit-reset': '2000' } }])
    await expect(createClient('tok', rl.fetchImpl).starred()).rejects.toMatchObject({ cause: 'rate-limited', resetAt: 2_000_000 })
    const scope = fake([{ body: { errors: [{ type: 'INSUFFICIENT_SCOPES' }] } }])
    await expect(createClient('tok', scope.fetchImpl).starred()).rejects.toMatchObject({ cause: 'needs-scope' })
  })
})

describe('stats', () => {
  test('batches 50 repos per aliased query', async () => {
    const repos = Array.from({ length: 120 }, (_, i) => `o/r${i}`)
    const { fetchImpl, calls } = fake((call) => {
      const q = JSON.parse(call.init.body as string).query as string
      const n = q.match(/repository\(/g)!.length
      const data: Record<string, unknown> = {}
      for (let i = 0; i < n; i++) data[`r${i}`] = { description: 'd', stargazerCount: i, forkCount: 0, viewerHasStarred: i === 0, issues: { totalCount: 2 }, primaryLanguage: { name: 'Go', color: '#0' } }
      return { body: { data } }
    })
    const stats = await createClient('tok', fetchImpl).stats(repos)
    expect(calls).toHaveLength(3)
    expect(JSON.parse(calls[0]!.init.body as string).query).toContain('r49: repository(owner: "o", name: "r49")')
    expect(Object.keys(stats)).toHaveLength(120)
    expect(stats['o/r51']).toEqual({ description: 'd', stars: 1, forks: 0, issues: 2, language: { name: 'Go', color: '#0' }, viewerHasStarred: false })
  })
})

describe('errors', () => {
  const cause = async (reply: Reply) => {
    try {
      await createClient('tok', fake([reply]).fetchImpl).user()
    } catch (e) {
      return e as ApiError
    }
    throw new Error('did not throw')
  }

  test('401 is token-rejected, 403 with accepted scopes is needs-scope, 403 with no remaining is rate-limited', async () => {
    expect((await cause({ status: 401 })).cause).toBe('token-rejected')
    expect((await cause({ status: 403, headers: { 'x-accepted-oauth-scopes': 'public_repo' } })).cause).toBe('needs-scope')
    const rl = await cause({ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1000', 'x-accepted-oauth-scopes': '' } })
    expect(rl.cause).toBe('rate-limited')
    expect(rl.resetAt).toBe(1_000_000)
    const secondary = await cause({ status: 403, headers: { 'retry-after': '60', 'x-accepted-oauth-scopes': '' } })
    expect(secondary.cause).toBe('rate-limited')
    expect(secondary.resetAt).toBeGreaterThan(Date.now() + 59_000)
    expect((await cause({ status: 429 })).cause).toBe('rate-limited')
  })

  test('a thrown fetch is offline', async () => {
    const client = createClient('tok', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(client.user()).rejects.toMatchObject({ cause: 'offline' })
  })
})

describe('compare and star', () => {
  test('compare returns first lines of commit messages and [] on 404', async () => {
    const { fetchImpl } = fake([{ body: { commits: [{ commit: { message: 'feat: a\n\nbody' } }, { commit: { message: 'fix: b' } }] } }, { status: 404 }])
    const client = createClient('tok', fetchImpl)
    expect(await client.compare('o/r', 'abc', 'def')).toEqual(['feat: a', 'fix: b'])
    expect(await client.compare('o/r', 'abc', 'def')).toEqual([])
  })

  test('setStar sends PUT or DELETE to /user/starred', async () => {
    const { fetchImpl, calls } = fake([{ status: 204 }, { status: 204 }])
    const client = createClient('tok', fetchImpl)
    await client.setStar('o/r', true)
    await client.setStar('o/r', false)
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['PUT', 'https://api.github.com/user/starred/o/r'],
      ['DELETE', 'https://api.github.com/user/starred/o/r'],
    ])
  })
})

describe('following', () => {
  const page = (n: number, hasNextPage: boolean) => ({
    body: { data: { viewer: { following: { pageInfo: { hasNextPage, endCursor: `c${n}` }, nodes: [{ login: `u${n}` }] } } } },
  })

  test('pages with the cursor and returns logins', async () => {
    const { fetchImpl, calls } = fake([page(1, true), page(2, false)])
    expect(await createClient('tok', fetchImpl).following()).toEqual(['u1', 'u2'])
    expect(calls.map((c) => JSON.parse(c.init.body as string).variables.after)).toEqual([null, 'c1'])
  })
})

describe('trimEvent', () => {
  test('slim PR payload: head branch stands in for the title', () => {
    const e = trimEvent({ ...rawEvent(1), type: 'PullRequestEvent', payload: { action: 'merged', number: 7, pull_request: { id: 1, number: 7, url: 'u', base: { ref: 'main' }, head: { ref: 'feat/x' } } } })
    expect(e.payload.pull_request).toEqual({ number: 7, title: 'feat/x', body: null, merged: false })
  })
})
