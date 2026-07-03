import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

export interface UpdateNotification {
  message: string
  action: 'reload' | 'dismiss'
}

export function useSWUpdate() {
  const { t } = useTranslation('common')

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const message = needRefresh ? t('appUpdate.updateAvailable') : ''

  const applyUpdate = () => {
    updateServiceWorker(true)
  }

  const dismiss = () => {
    setNeedRefresh(false)
  }

  return { updateAvailable: needRefresh, message, applyUpdate, dismiss }
}
