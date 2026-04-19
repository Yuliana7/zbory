import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Banner that appears when a service worker update is available.
 * Uses vite-plugin-pwa's built-in update event.
 */
export function UpdateNotificationBanner() {
  const { t } = useTranslation('common')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    // vite-plugin-pwa emits a custom event when update is available
    const handleSWUpdated = (e: any) => {
      // Only show if it's an actual update (not just first registration)
      if (e.detail?.needRefresh) {
        setUpdateAvailable(true)
      }
    }

    // Also listen for the standard 'sw-updated' event
    document.addEventListener('sw-updated', handleSWUpdated)

    // For vite-plugin-pwa with prompt mode
    if ('serviceWorker' in navigator) {
      const channel = new BroadcastChannel('sw-messages')
      channel.onmessage = (event) => {
        if (event.data?.type === 'SKIP_WAITING') {
          setUpdateAvailable(true)
        }
      }
      return () => channel.close()
    }

    return () => {
      document.removeEventListener('sw-updated', handleSWUpdated)
    }
  }, [])

  if (!updateAvailable || isHidden) return null

  const handleReload = () => {
    // Tell the SW to take control and reload
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new BroadcastChannel('sw-messages')
      channel.postMessage({ type: 'SKIP_WAITING' })
      channel.close()
      window.location.reload()
    }
  }

  const handleDismiss = () => {
    setIsHidden(true)
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-indigo-600 text-white px-4 py-3 shadow-lg z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-sm sm:text-base">
        <p className="flex-1">
          {t('common.appUpdate.updateAvailable')}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReload}
            className="px-3 py-1.5 bg-white text-indigo-600 font-medium rounded hover:bg-gray-100 transition-colors"
          >
            {t('common.appUpdate.update')}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-indigo-200 hover:text-white transition-colors"
          >
            {t('common.appUpdate.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
