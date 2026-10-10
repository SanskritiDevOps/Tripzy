import { useEffect, useState } from 'react'
import { authApi } from '../../api/endpoints'

// Fetched once per page load; the sign-in options rarely change.
let cached = null
let inFlight = null

/** Sign-in methods the API offers: { password: true, google: { clientId } | null }. */
export function useAuthProviders() {
  const [providers, setProviders] = useState(cached ?? { password: true, google: null })

  useEffect(() => {
    if (cached) return
    let active = true
    inFlight ??= authApi
      .providers()
      .then((result) => (cached = result))
      .catch(() => ({ password: true, google: null })) // API down → just hide Google
      .finally(() => {
        inFlight = null
      })
    inFlight.then((result) => active && setProviders(result))
    return () => {
      active = false
    }
  }, [])

  return providers
}
