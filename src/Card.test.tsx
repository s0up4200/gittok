import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CardView } from './Card.tsx'
import type { Card } from './feed.ts'

const card: Card = {
  id: 'release-1', shape: 'release', label: 'Release', verb: 'released',
  actors: [{ login: 'octo', avatar: 'https://example.invalid/avatar.png' }],
  repo: 'octo/repo', url: 'https://example.invalid/release/1',
  at: '2026-09-01T12:00:00Z', title: 'v1', body: '', meta: '',
}

function render(body: string, commits?: string[]) {
  return renderToStaticMarkup(<CardView
    card={{ ...card, body, ...(commits ? { push: { ref: 'main', before: 'a', head: 'b', count: 1 } } : {}) }}
    commits={commits} stats={undefined} starred={false} onStar={() => {}} now={Date.parse(card.at)}
  />)
}

test('renders Markdown structure and keeps commit messages as plain list items', () => {
  const html = render(`## What's Changed

A **small** release with \`code\`.

- Fix spaces
  - Keep nested changes

1. Upgrade
2. Restart

> Save your settings.

\`\`\`sh
echo ready
\`\`\`

**Full Changelog**: [v1...v2](https://example.invalid/compare/v1...v2)

https://example.invalid/pull/2
`)
  expect(html).toContain('<h2>What&#x27;s Changed</h2>')
  expect(html).toContain('<p>A <strong>small</strong> release with <code>code</code>.</p>')
  expect(html).toContain('<li>Fix spaces\n<ul>\n<li>Keep nested changes</li>')
  expect(html).toContain('<ol>\n<li>Upgrade</li>\n<li>Restart</li>')
  expect(html).toContain('<blockquote>')
  expect(html).toContain('<pre><code class="language-sh">echo ready\n</code></pre>')
  expect(html).toContain('<p><strong>Full Changelog</strong>: <a href="https://example.invalid/compare/v1...v2" target="_blank" rel="noopener noreferrer">v1...v2</a></p>')
  expect(html).toContain('<a href="https://example.invalid/pull/2"')
  expect(render('', ['fix: keep *literal* text'])).toContain('<li>fix: keep *literal* text</li>')
})

test('does not render raw HTML, images, comments, or unsafe links from a body', () => {
  const html = render('<!-- private template -->\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert)\n\n![diagram](https://example.invalid/diagram.png)')
  expect(html).not.toContain('private template')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('javascript:')
  expect(html).not.toContain('https://example.invalid/diagram.png')
  expect(html).toContain('diagram')
})
