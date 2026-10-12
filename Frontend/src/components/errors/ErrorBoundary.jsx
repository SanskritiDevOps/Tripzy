import { Component } from 'react'

/**
 * Catches errors thrown while rendering its children and shows `fallback`
 * instead of a blank page.
 *
 *   fallback({ error, errorId, reset }) → element
 *   resetKey: when it changes (e.g. the URL), the boundary clears its error,
 *             so navigating away recovers without a reload.
 */
export class ErrorBoundary extends Component {
  state = { error: null, errorId: null }

  static getDerivedStateFromError(error) {
    // Short code people can quote when reporting the problem.
    return { error, errorId: `TZ-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}` }
  }

  componentDidCatch(error, info) {
    console.error(`[Tripzy] ${this.props.name ?? 'UI'} crashed (${this.state.errorId ?? 'no id'})`, error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.reset()
  }

  reset = () => this.setState({ error: null, errorId: null })

  render() {
    if (this.state.error) return this.props.fallback({ error: this.state.error, errorId: this.state.errorId, reset: this.reset })
    return this.props.children
  }
}
