// Viewport readout for device debugging. Shows when the URL has ?debug.
import { useEffect, useState } from 'react'

// Height of a hidden div sized with the given CSS length, so units and env() resolve like they do in layout.
function probe(height: string) {
  const el = document.createElement('div')
  Object.assign(el.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '0', width: '1px', height })
  document.body.appendChild(el)
  const v = el.offsetHeight
  el.remove()
  return Math.round(v)
}

function measure() {
  return {
    standalone: `${String((navigator as { standalone?: boolean }).standalone)} / mq ${matchMedia('(display-mode: standalone)').matches}`,
    screen: `${screen.width}x${screen.height}`,
    innerHeight,
    visualViewport: Math.round(visualViewport?.height ?? 0),
    htmlClient: document.documentElement.clientHeight,
    bodyClient: document.body.clientHeight,
    shell: document.querySelector('.shell')?.clientHeight ?? 0,
    card: document.querySelector('.card')?.clientHeight ?? 0,
    vh: probe('100vh'),
    dvh: probe('100dvh'),
    svh: probe('100svh'),
    insetTop: probe('env(safe-area-inset-top, 0px)'),
    insetBottom: probe('env(safe-area-inset-bottom, 0px)'),
    ua: navigator.userAgent.replace(/.*OS (\d+_\d+).*/, 'iOS $1'),
  }
}

export function Debug() {
  const [m, setM] = useState<Record<string, string | number>>({})
  useEffect(() => {
    const run = () => setM(measure())
    run()
    addEventListener('resize', run)
    return () => removeEventListener('resize', run)
  }, [])
  return (
    <pre className="debug">
      {Object.entries(m)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}
    </pre>
  )
}
