import { ArrowTopRightOnSquareIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { version } from '../package.json'
import { KINDS, type Kind } from './feed.ts'
import type { Cause, User } from './github.ts'
import { STARRED_CAP } from './github.ts'

const NEW_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=public_repo&description=GitTok'
const REPO_URL = 'https://github.com/s0up4200/gittok'

const MESSAGES: Record<Cause, string> = {
  'token-rejected': 'Token rejected. GitHub answered 401.',
  'needs-scope': 'Token needs the public_repo scope.',
  'rate-limited': 'Rate limited by GitHub. Try again later.',
  offline: 'You are offline.',
  http: 'GitHub returned an error.',
}

type Props = {
  token: string
  user: User | null
  capped: boolean
  kinds: Kind[]
  onToggleKind: (kind: Kind) => void
  error: Cause | null
  onSave: (token: string) => Promise<Cause | null>
  onMarkUnseen: () => void
  onSignOut: () => void
}

export function Settings(p: Props) {
  const [value, setValue] = useState(p.token)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Cause | null | 'saved'>(p.error)
  const [note, setNote] = useState('')

  const save = async () => {
    const t = value.trim()
    if (!t) return
    setBusy(true)
    const cause = await p.onSave(t)
    setResult(cause ?? 'saved')
    setBusy(false)
  }

  return (
    <main className="settings">
      <header>
        {p.token && (
          <a href="#" className="back" aria-label="Back to feed">
            <ChevronLeftIcon className="icon" /> Feed
          </a>
        )}
        <h1>Settings</h1>
      </header>

      <section>
        <label htmlFor="token">GitHub token</label>
        {!p.token && <p>Paste a token to see your feed. The Home Screen app starts with empty storage, so a fresh install asks again.</p>}
        <p className="dim">
          A classic personal access token with the <code>public_repo</code> scope. A fine-grained token with "Starring: read and write" and public
          repository access also reads the feed, but starring from a card is unverified.
        </p>
        <input id="token" type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} placeholder="ghp_…" />
        <div className="row">
          <button className="big-btn" onClick={save} disabled={busy || !value.trim()}>
            {busy ? 'Checking…' : 'Save'}
          </button>
          <a className="big-btn secondary" href={NEW_TOKEN_URL} target="_blank" rel="noreferrer">
            Create token <ArrowTopRightOnSquareIcon className="icon small" />
          </a>
        </div>
        {result && result !== 'saved' && <p className="error">{MESSAGES[result]}</p>}
        {p.user && result !== 'token-rejected' && (
          <p className="user">
            <img src={p.user.avatar_url} alt="" />
            Signed in as <b>{p.user.login}</b>
          </p>
        )}
        {p.capped && <p className="dim">The starred list was cut short. Starred releases cover at most the {STARRED_CAP} most recently starred repos.</p>}
      </section>

      <section>
        <label>Show in feed</label>
        {KINDS.map((k) => (
          <label key={k.kind} className="toggle">
            <input type="checkbox" checked={p.kinds.includes(k.kind)} onChange={() => p.onToggleKind(k.kind)} />
            <span>
              <b>{k.label}</b>
              <br />
              <span className="dim">{k.detail}</span>
            </span>
          </label>
        ))}
      </section>

      {p.token && (
      <section>
        <button
          className="big-btn secondary"
          onClick={() => {
            p.onMarkUnseen()
            setNote('Feed replays from the top.')
          }}
        >
          Mark all unseen
        </button>
        <button
          className="big-btn secondary"
          onClick={() => {
            p.onSignOut()
            setValue('')
            setResult(null)
            setNote('Token, seen state, and cached feed cleared.')
          }}
        >
          Sign out
        </button>
        {note && <p className="dim">{note}</p>}
      </section>
      )}

      <footer className="dim">
        GitTok v{version} ·{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          source
        </a>
      </footer>
    </main>
  )
}
