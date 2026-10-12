// Development only: add ?crash=app | page | tab to a URL to see each error screen
// (?crash=tab-chunk etc. simulates a stale-deploy "chunk" error). It keeps
// crashing while the parameter is in the URL. Renders nothing in production builds.

export function DevCrash({ where }) {
  if (!import.meta.env.DEV) return null
  const wanted = new URLSearchParams(window.location.search).get('crash')
  if (wanted === `${where}-chunk`) throw new Error('Failed to fetch dynamically imported module: /assets/ItineraryTab-old.js')
  if (wanted === where) throw new Error(`Test crash (${where})`)
  return null
}
