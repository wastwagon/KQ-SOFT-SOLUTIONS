import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type Props = {
  children: ReactNode
  /** Custom fallback to render instead of the default in-section message. */
  fallback?: ReactNode
  /**
   * Render the full-page branded fallback (used by the app-wide boundary in
   * App.tsx).  In-section uses keep the smaller default.
   */
  variant?: 'inline' | 'page'
  /** Optional callback for telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void
}

type State = { hasError: boolean; error?: Error }

/**
 * Catches render errors in children and shows a friendly fallback instead of
 * a blank screen.  Use the `page` variant at the app root and the default
 * `inline` variant for individual sections (so other parts of the page keep
 * working when one panel crashes).
 */
export default class ErrorFallback extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorFallback caught:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  private handleReload = () => {
    // Hard reload — clears any wedged in-memory react-query state too.
    window.location.reload()
  }

  private handleGoHome = () => {
    // Use a navigation that bypasses React Router so the boundary fully resets.
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    if (this.props.variant === 'page') {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight text-gray-900">
                  Something went wrong
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  The app hit an unexpected error rendering this page. Your work has not
                  been lost — try reloading or returning home.
                </p>
                {this.state.error?.message && (
                  <p
                    className="mt-3 break-words rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
                    title={this.state.error.message}
                  >
                    {this.state.error.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Go home
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h3 className="font-semibold mb-2">Something went wrong</h3>
        <p className="text-sm mb-3">
          This section could not be loaded. Try refreshing the page or going back.
        </p>
        <p
          className="text-xs text-amber-700 font-mono truncate"
          title={this.state.error?.message}
        >
          {this.state.error?.message}
        </p>
      </div>
    )
  }
}
