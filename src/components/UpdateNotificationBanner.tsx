import { useTranslation } from 'react-i18next'
import { useSWUpdate } from '../hooks/useSWUpdate'

export function UpdateNotificationBanner() {
  const { t } = useTranslation('common')
  const { updateAvailable, applyUpdate, dismiss } = useSWUpdate()

  if (!updateAvailable) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-indigo-600 text-white px-4 pb-3 shadow-lg z-50"
      // 0.75rem = the old py-3 top padding, plus whatever a notch/status bar covers
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-sm sm:text-base">
        <p className="flex-1">{t('appUpdate.updateAvailable')}</p>
        <div className="flex gap-3">
          <button
            onClick={applyUpdate}
            className="px-3 py-1.5 bg-white text-indigo-600 font-medium rounded hover:bg-gray-100 transition-colors"
          >
            {t('appUpdate.update')}
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-indigo-200 hover:text-white transition-colors"
          >
            {t('appUpdate.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
