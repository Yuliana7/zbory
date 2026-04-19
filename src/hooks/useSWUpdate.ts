import { useEffect, useState } from 'react'

export interface UpdateNotification {
  message: string
  action: 'reload' | 'dismiss'
}

/**
 * Listens for service worker updates and triggers a notification.
 * When SW_UPDATE_EVENT fires, user can choose to reload or dismiss.
 */
export function useSWUpdate(onUpdate?: (notification: UpdateNotification) => void) {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Listen for messages from the service worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        setUpdateAvailable(true)
        onUpdate?.({
          message: 'Нова версія застосунку доступна',
          action: 'reload',
        })
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage)
    }
  }, [onUpdate])

  const reloadPage = () => {
    window.location.reload()
  }

  const dismiss = () => {
    setUpdateAvailable(false)
  }

  return { updateAvailable, reloadPage, dismiss }
}
