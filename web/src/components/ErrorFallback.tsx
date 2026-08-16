import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import Button from './ui/Button'
import Alert from './ui/Alert'

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
          <div className="w-full max-w-lg">
            <Alert
              tone="warning"
              title="Something went wrong"
              action={
                <>
                  <Button type="button" variant="outline" onClick={this.handleGoHome}>
                    Go home
                  </Button>
                  <Button type="button" onClick={this.handleReload}>
                    <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                    Reload page
                  </Button>
                </>
              }
            >
              The app hit an unexpected error rendering this page. Your work has not been lost — try
              reloading or returning home.
              {this.state.error?.message ? (
                <p
                  className="mt-2 break-words rounded-lg bg-white/70 px-3 py-2 font-mono text-xs text-gray-700"
                  title={this.state.error.message}
                >
                  {this.state.error.message}
                </p>
              ) : null}
            </Alert>
          </div>
        </div>
      )
    }

    return (
      <Alert
        tone="warning"
        title="Something went wrong"
        onRetry={this.handleReload}
        retryLabel="Reload page"
      >
        This section could not be loaded. Try refreshing the page or going back.
        {this.state.error?.message ? (
          <p className="mt-2 truncate font-mono text-xs opacity-80" title={this.state.error.message}>
            {this.state.error.message}
          </p>
        ) : null}
      </Alert>
    )
  }
}
