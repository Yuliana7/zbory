import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Component that shows a custom "Add to Home Screen" prompt
 * when the browser's native prompt is available.
 */
export function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser prompt
      e.preventDefault()
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show our custom banner
      setShowBanner(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    await deferredPrompt.prompt()

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }

    // Clear the deferred prompt for cleanup
    setDeferredPrompt(null)
    setShowBanner(false)
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  // Don't show if already installed or no prompt available
  if (isInstalled || !showBanner || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 md:right-auto md:bottom-6 md:left-6 md:max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-slide-up">
      <div className="p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-lg font-bold">
              ₴
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Збори на екрані</h3>
            <p className="text-sm text-gray-600 mt-1">
              Встановіть застосунок на домашній екран для швидкого доступу
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleInstall}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            Встановити
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Пізніше
          </button>
        </div>
      </div>
    </div>
  )
}
