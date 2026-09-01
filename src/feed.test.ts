import { describe, expect, test } from 'bun:test'
import { buildFeed, KINDS, markSeen, releaseCardId, type Event, type Kind, type StarredRepo } from './feed.ts'

const NOW = Date.parse('2026-09-01T12:00:00Z')
const H = 3_600_000
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString()

let seq = 1000
function ev(type: string, hoursAgo: number, payload: Event['payload'] = {}, opts: { repo?: string; actor?: string } = {}): Event {
  return {
    id: String(seq++),
    type,
    created_at: at(hoursAgo),
    actor: { login: opts.actor ?? 'alice', avatar_url: `https://avatars.githubusercontent.com/u/1?v=4` },
    repo: { name: opts.repo ?? 'octo/repo' },
    payload,
  }
}

const push = (hoursAgo: number, n: number, o: { repo?: string; actor?: string; ref?: string } = {}) =>
  ev('PushEvent', hoursAgo, { ref: o.ref ?? 'refs/heads/main', head: `head${n}`, before: `before${n}` }, o)

const release = (hoursAgo: number, id: number, body = '## Notes\n- one\n- two') =>
  ev('ReleaseEvent', hoursAgo, {
    action: 'published',
    release: { id, tag_name: 'v1.0.0', name: 'v1.0.0', body, html_url: 'https://github.com/octo/repo/releases/tag/v1.0.0', prerelease: false },
  })

function starred(hoursAgo: number, id: number, name = 'octo/repo'): StarredRepo {
  return {
    name,
    url: `https://github.com/${name}`,
    ownerAvatar: 'https://avatars.githubusercontent.com/u/2?v=4',
    description: 'desc',
    stars: 10,
    forks: 2,
    issues: 1,
    language: { name: 'Go', color: '#00ADD8' },
    latestRelease: { id, tagName: 'v1.0.0', name: null, publishedAt: at(hoursAgo), url: `https://github.com/${name}/releases/tag/v1.0.0`, description: null, isPrerelease: false },
  }
}

const ALL = new Set(KINDS.map((k) => k.kind))
const build = (events: Event[], stars: StarredRepo[] = [], seen = new Set<string>(), following = new Set(['alice', 'bob', 'carol', 'dave', 'erin'])) => buildFeed(events, stars, seen, NOW, ALL, following)

describe('type filtering', () => {
  test('keeps the eight types with their shapes and drops the rest', () => {
    const cards = build([
      release(1, 7),
      push(2, 1),
      ev('PullRequestEvent', 3, { action: 'opened', pull_request: { number: 1, title: 'PR', body: null, merged: false, html_url: 'u' } }),
      ev('IssuesEvent', 4, { action: 'opened', issue: { number: 2, title: 'Issue', body: null, html_url: 'u' } }),
      ev('WatchEvent', 5, { action: 'started' }),
      ev('ForkEvent', 6, { forkee: { full_name: 'alice/repo', html_url: 'u' } }),
      ev('CreateEvent', 7, { ref_type: 'repository', description: 'new' }),
      ev('PublicEvent', 8),
      ev('IssueCommentEvent', 9),
      ev('DeleteEvent', 10),
      ev('SomethingNewEvent', 11),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Release', 'Push', 'PR opened', 'Issue opened', 'Star', 'Fork', 'New repo', 'Went public'])
    expect(cards.map((c) => c.shape)).toEqual(['release', 'change', 'change', 'change', 'repo', 'repo', 'repo', 'repo'])
  })

  test('PR keeps opened and merged only, issue keeps opened only, create keeps repository only', () => {
    const pr = (action: string, merged: boolean) =>
      ev('PullRequestEvent', 1, { action, pull_request: { number: 1, title: 'PR', body: null, merged, html_url: 'u' } })
    const cards = build([
      pr('opened', false),
      pr('closed', true),
      pr('closed', false),
      pr('labeled', false),
      ev('IssuesEvent', 1, { action: 'closed', issue: { number: 2, title: 'Issue', body: null, html_url: 'u' } }),
      ev('CreateEvent', 1, { ref_type: 'branch', ref: 'feature' }),
    ])
    expect(cards.map((c) => c.label)).toEqual(['PR opened', 'PR merged'])
  })
})

describe('kinds', () => {
  test('filters both sources by the enabled kinds', () => {
    const events = [
      release(1, 7),
      push(2, 1),
      ev('PullRequestEvent', 3, { action: 'opened', pull_request: { number: 1, title: 'PR', body: null, merged: false, html_url: 'u' } }),
      ev('IssuesEvent', 4, { action: 'opened', issue: { number: 2, title: 'Issue', body: null, html_url: 'u' } }),
      ev('WatchEvent', 5, { action: 'started' }),
      ev('ForkEvent', 6, { forkee: { full_name: 'alice/repo', html_url: 'u' } }),
      ev('CreateEvent', 7, { ref_type: 'repository', description: 'new' }),
      ev('PublicEvent', 8),
    ]
    const stars = [starred(9, 8, 'other/repo')]
    const labels = (kinds: Kind[]) => buildFeed(events, stars, new Set(), NOW, new Set(kinds), new Set(['alice', 'bob', 'carol', 'dave', 'erin'])).map((c) => c.label)
    expect(labels(['releases'])).toEqual(['Release', 'Release'])
    expect(labels(['stars', 'repos'])).toEqual(['Star', 'Fork', 'New repo', 'Went public'])
    expect(labels(['activity', 'pushes'])).toEqual(['Push', 'PR opened', 'Issue opened'])
    expect(labels([])).toEqual([])
  })
})

describe('push collapse', () => {
  test('same repo, actor, ref within 6h fold into one card at the newest push, spanning oldest before to newest head', () => {
    const cards = build([push(1, 1), ev('WatchEvent', 2, {}, { actor: 'bob' }), push(3, 2), push(5, 3)])
    expect(cards.map((c) => c.label)).toEqual(['Push', 'Star'])
    const p = cards[0]!
    expect(p.title).toBe('3 pushes to main')
    expect(p.push).toEqual({ ref: 'main', before: 'before3', head: 'head1', count: 3 })
    expect(p.at).toBe(at(1))
  })

  test('a push outside 6h, on another ref, or by another actor starts a new card', () => {
    const cards = build([push(1, 1), push(8, 2), push(2, 3, { ref: 'refs/heads/dev' }), push(2, 4, { actor: 'bob' })])
    expect(cards).toHaveLength(4)
  })

  test('card id is the newest event id in the group', () => {
    const newest = push(1, 1)
    const cards = build([push(3, 2), newest])
    expect(cards[0]!.id).toBe(newest.id)
  })
})

describe('star and fork collapse', () => {
  test('stars on the same repo within 24h list the actors, forks stay separate from stars', () => {
    const cards = build([
      ev('WatchEvent', 1, {}, { actor: 'alice' }),
      ev('WatchEvent', 10, {}, { actor: 'bob' }),
      ev('ForkEvent', 12, {}, { actor: 'carol' }),
      ev('WatchEvent', 20, {}, { actor: 'dave' }),
      ev('WatchEvent', 30, {}, { actor: 'erin' }),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Star', 'Fork', 'Star'])
    expect(cards[0]!.actors.map((a) => a.login)).toEqual(['alice', 'bob', 'dave'])
    expect(cards[2]!.actors.map((a) => a.login)).toEqual(['erin'])
  })
})

describe('sources and order', () => {
  test('merges both sources newest first', () => {
    const cards = build([push(5, 1), release(1, 7)], [starred(3, 8, 'other/repo')])
    expect(cards.map((c) => c.at)).toEqual([at(1), at(3), at(5)])
  })

  test('dedupes a release seen from both sources, or from two events, by release id', () => {
    const cards = build([release(1, 7), release(2, 7)], [starred(1, 7)])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.id).toBe(releaseCardId(7))
  })

  test('drops cards older than the 30-day window and duplicate event ids', () => {
    const p = push(1, 1)
    const cards = build([p, p, push(31 * 24, 2)], [starred(40 * 24, 9)])
    expect(cards).toHaveLength(1)
  })
})

describe('seen', () => {
  test('hides seen cards; all seen gives an empty feed', () => {
    const a = push(1, 1)
    const b = ev('WatchEvent', 2)
    expect(build([a, b], [], new Set([a.id])).map((c) => c.id)).toEqual([b.id])
    expect(build([a, b], [], new Set([a.id, b.id]))).toEqual([])
  })

  test('markSeen prunes outside the window and caps at 1000 oldest first', () => {
    let seen = markSeen([], 'old', NOW - 31 * 24 * H, NOW)
    seen = markSeen(seen, 'new', NOW, NOW)
    expect(seen.map(([id]) => id)).toEqual(['new'])
    for (let i = 0; i < 1005; i++) seen = markSeen(seen, `c${i}`, NOW - 2000 * 60_000 + i * 60_000, NOW)
    expect(seen).toHaveLength(1000)
    expect(seen.some(([id]) => id === 'c0')).toBe(false)
    expect(seen.some(([id]) => id === 'c1004')).toBe(true)
  })
})

describe('release body', () => {
  test('keeps every line so the card can unfold a long changelog', () => {
    const notes = Array.from({ length: 30 }, (_, i) => `- change ${i}`).join('\n')
    const [card] = buildFeed([release(1, 7, notes)], [], new Set(), NOW, new Set(KINDS.map((k) => k.kind)), new Set())
    expect(card!.body).toHaveLength(30)
  })
})

describe('stars', () => {
  // received_events carries stars by anyone on a watched repo. Only stars by followed users are feed material.
  test('keeps stars by followed users only', () => {
    const events = [ev('WatchEvent', 1, { action: 'started' }, { actor: 'alice' }), ev('WatchEvent', 2, { action: 'started' }, { actor: 'stranger', repo: 'octo/other' })]
    expect(build(events).map((c) => c.actors[0]!.login)).toEqual(['alice'])
  })
})
