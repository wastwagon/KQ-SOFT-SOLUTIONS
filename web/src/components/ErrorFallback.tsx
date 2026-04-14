import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error?: Error }

/** Catches render errors in children and shows a fallback instead of a blank screen */
export default class ErrorFallback extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorFallback caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h3 className="font-semibold mb-2">Something went wrong</h3>
          <p className="text-sm mb-3">
            This section could not be loaded. Try refreshing the page or going back.
          </p>
          <p className="text-xs text-amber-700 font-mono truncate" title={this.state.error?.message}>
            {this.state.error?.message}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
