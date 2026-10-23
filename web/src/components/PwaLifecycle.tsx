import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import Alert from './ui/Alert'

/**
 * Registers the production service worker and surfaces offline / update states.
 */
export default function PwaLifecycle() {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateReady(true)
      },
    })
  }, [])

  if (!offline && !updateReady) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[100] space-y-0 shadow-sm safe-top">
      {offline && (
        <Alert tone="warning" title="You are offline" className="rounded-none border-x-0 border-t-0">
          The app shell is available, but live data and saves need a connection. Reconnect to sync with
          your workspace.
        </Alert>
      )}
      {updateReady && (
        <Alert
          tone="info"
          title="Update available"
          className="rounded-none border-x-0 border-t-0"
          action={
            <button
              type="button"
              className="text-sm font-semibold text-primary-700 hover:text-primary-800 underline"
              onClick={() => window.location.reload()}
            >
              Refresh now
            </button>
          }
        >
          A newer version of KQ-SOFT is ready. Refresh to load it.
        </Alert>
      )}
    </div>
  )
}
