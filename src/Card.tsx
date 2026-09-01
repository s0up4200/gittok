import { ArrowTopRightOnSquareIcon, Cog6ToothIcon, StarIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { actorLine, ago, type Card, type RepoStats } from './feed.ts'
import type { EndState } from './Feed.tsx'

export const Gear = () => (
  <a className="gear" href="#settings" aria-label="Settings">
    <Cog6ToothIcon className="icon" />
  </a>
)

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function bigAvatar(url: string) {
  return url + (url.includes('?') ? '&' : '?') + 's=400'
}

type Props = {
  card: Card
  stats: RepoStats | undefined
  commits: string[] | undefined
  starred: boolean
  onStar: (repo: string) => void
  now: number
}

export function CardView({ card, stats, commits, starred, onStar, now }: Props) {
  const [owner, name] = card.repo.split('/')
  const avatar = card.actors[0]!.avatar
  const title = card.title || (card.shape === 'repo' ? (stats?.description ?? '') : '')
  const body = card.push ? (commits ?? []) : card.body
  const meta = card.push && commits ? `${commits.length} commit${commits.length === 1 ? '' : 's'}` : card.meta === title ? '' : card.meta
  return (
    <section className="card" data-id={card.id}>
      <img className="wash" src={bigAvatar(avatar)} alt="" aria-hidden />
      <div className="card-top">
        <div className="type">{card.label}</div>
        {stats && (
          <div className="stats">
            <div>
              <b>{compact.format(stats.stars)}</b>
              <span>stars</span>
            </div>
            <div>
              <b>{compact.format(stats.forks)}</b>
              <span>forks</span>
            </div>
            <div>
              <b>{compact.format(stats.issues)}</b>
              <span>issues</span>
            </div>
            {stats.language && (
              <div>
                <b style={{ color: stats.language.color }}>●</b>
                <span>{stats.language.name}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <Gear />
      <div className="card-body">
        <div className="actor">
          <img src={avatar} alt="" />
          <span>{actorLine(card)}</span>
          <span className="dim"> · {ago(card.at, now)}</span>
        </div>
        <div className="repo">
          {owner}/<br />
          {name}
        </div>
        {title && <div className="title">{title}</div>}
        {body.length > 0 && (
          <ul className="list">
            {body.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
        {meta && <div className="dim meta">{meta}</div>}
      </div>
      <div className="rail">
        <button className="rail-btn" aria-pressed={starred} aria-label={starred ? 'Unstar' : 'Star'} onClick={() => onStar(card.repo)}>
          {starred ? <StarSolidIcon className="icon" /> : <StarIcon className="icon" />}
          <small>Star</small>
        </button>
        <a className="rail-btn" href={card.url} target="_blank" rel="noreferrer">
          <ArrowTopRightOnSquareIcon className="icon" />
          <small>Open</small>
        </a>
      </div>
    </section>
  )
}

export function SkeletonCard() {
  return (
    <section className="card skeleton" aria-busy="true" aria-label="Loading">
      <div className="card-top">
        <div className="bar" style={{ width: '40%' }} />
        <div className="bar thin" style={{ width: '60%' }} />
      </div>
      <div className="card-body">
        <div className="bar thin" style={{ width: '50%' }} />
        <div className="bar" style={{ width: '70%' }} />
        <div className="bar thin" style={{ width: '90%' }} />
        <div className="bar thin" style={{ width: '80%' }} />
      </div>
    </section>
  )
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function EndCard({ end, onRefresh }: { end: EndState; onRefresh: () => void }) {
  let title = ''
  let detail = ''
  let action: 'refresh' | 'retry' | 'settings' = 'refresh'
  switch (end.kind) {
    case 'loading':
    case 'caught-up':
      title = "You're caught up"
      detail = end.kind === 'caught-up' && end.checkedAt ? `Last checked ${time(end.checkedAt)}` : 'Checking…'
      break
    case 'no-token':
      title = 'Add a token to start'
      action = 'settings'
      break
    case 'token-rejected':
      title = 'Token rejected'
      detail = 'GitHub answered 401. Paste a new token.'
      action = 'settings'
      break
    case 'needs-scope':
      title = 'Token needs public_repo'
      detail = 'Create a classic token with the public_repo scope.'
      action = 'settings'
      break
    case 'rate-limited':
      title = 'Rate limited by GitHub'
      detail = end.resetAt ? `Resets at ${time(end.resetAt)}` : ''
      action = 'retry'
      break
    case 'offline':
      title = "You're offline"
      detail = 'Nothing cached yet.'
      action = 'retry'
      break
    case 'error':
      title = 'GitHub is unhappy'
      detail = `Status ${end.status}`
      action = 'retry'
      break
  }
  return (
    <section className="card end">
      <Gear />
      <div className="end-body">
        <div className="type">{title}</div>
        {detail && <div className="dim">{detail}</div>}
        {action === 'settings' ? (
          <a className="big-btn" href="#settings">
            Open settings
          </a>
        ) : (
          <button className="big-btn" onClick={onRefresh}>
            {action === 'retry' ? 'Retry' : 'Refresh'}
          </button>
        )}
      </div>
    </section>
  )
}
