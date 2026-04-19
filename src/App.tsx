import { useTranslation } from 'react-i18next'
import { useAppContext } from './context/AppContext'
import type { AppState } from './types'
import { UploadPage } from './pages/UploadPage'
import { InsightsPage } from './pages/InsightsPage'
import { GalleryPage } from './pages/GalleryPage'
import { ExportPage } from './pages/ExportPage'
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner'
import { InstallPromptBanner } from './components/InstallPromptBanner'

const STEP_INDEX: Record<AppState['step'], number> = {
  upload: 1,
  insights: 2,
  gallery: 3,
  export: 4,
}

const STEP_KEYS: AppState['step'][] = ['upload', 'insights', 'gallery', 'export']

function App() {
  const { t } = useTranslation('common')
  const { state, handleReset, goToStep } = useAppContext()
  const { app, error } = state
  const currentStepIdx = STEP_INDEX[app.step]

  const stepLabels = [
    t('steps.upload'),
    t('steps.insights'),
    t('steps.gallery'),
    t('steps.export'),
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <UpdateNotificationBanner />
      <InstallPromptBanner />
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <button
              onClick={handleReset}
              className="flex items-center space-x-3 group cursor-pointer"
              title={t('logoTitle')}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:opacity-80 transition-opacity">
                {t('currency')}
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{t('appName')}</h1>
                <p className="text-sm text-gray-500">{t('appSubtitle')}</p>
              </div>
            </button>

            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
              {stepLabels.map((label, idx) => {
                const stepNum = idx + 1
                const isActive = stepNum === currentStepIdx
                const isCompleted = stepNum < currentStepIdx
                const stepKey = STEP_KEYS[idx]

                return (
                  <div key={stepNum} className="flex items-center">
                    <button
                      onClick={isCompleted ? () => goToStep(stepKey) : undefined}
                      disabled={!isCompleted}
                      className={`flex items-center transition-colors ${
                        isActive
                          ? 'text-indigo-700 font-semibold cursor-default'
                          : isCompleted
                          ? 'text-gray-400 hover:text-indigo-600 cursor-pointer'
                          : 'text-gray-300 cursor-default'
                      }`}
                    >
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : isCompleted
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {stepNum}
                      </div>
                      <span className="ml-1.5 font-medium hidden sm:inline">{label}</span>
                    </button>
                    {idx < stepLabels.length - 1 && (
                      <div className="w-4 sm:w-10 h-0.5 bg-gray-200 mx-1 sm:mx-2" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="animate-fade-in">
          {app.step === 'upload' && <UploadPage />}
          {app.step === 'insights' && <InsightsPage />}
          {app.step === 'gallery' && <GalleryPage />}
          {app.step === 'export' && <ExportPage />}
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">{t('footer')}</p>
        </div>
      </footer>
    </div>
  )
}

export default App
