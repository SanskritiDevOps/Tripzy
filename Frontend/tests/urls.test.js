import { describe, expect, it } from 'vitest'
import { loginPath, safeRedirect } from '../src/utils/urls'

describe('redirect after login', () => {
  it('allows paths inside the app', () => {
    expect(safeRedirect('/trips/123/places?view=map')).toBe('/trips/123/places?view=map')
  })

  it('refuses anything that could leave the site (open redirects)', () => {
    for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null]) {
      expect(safeRedirect(target)).toBe('/trips')
    }
  })

  it('never redirects back to the login or sign-up page', () => {
    expect(safeRedirect('/login?redirect=/trips')).toBe('/trips')
    expect(safeRedirect('/signup')).toBe('/trips')
  })

  it('builds login links that come back to the current page', () => {
    expect(loginPath('/join-trip?token=abc')).toBe('/login?redirect=%2Fjoin-trip%3Ftoken%3Dabc')
    expect(loginPath('//evil.example')).toBe('/login')
  })
})
