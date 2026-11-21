import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppContext } from './context/AppContext'
import { UploadPage } from './pages/UploadPage'
import { InsightsPage } from './pages/InsightsPage'
import { GalleryPage } from './pages/GalleryPage'
import { ArchivePage } from './pages/ArchivePage'
import { ExportPage } from './pages/ExportPage'
import { SafeAreaTopBar } from './components/SafeAreaTopBar'
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner'
import { InstallPromptBanner } from './components/InstallPromptBanner'
import { ThemeToggle } from './components/ThemeToggle'
import { AppLogo } from './icons/AppLogo'

function App() {
  const { t } = useTranslation('common')
  const { state, dispatch, handleReset } = useAppContext()
  const { app, error } = state
  const section = app.section === 'archive' ? 'archive' : 'active'
  // an archived project's (or a year's) cards use the steps' pages, but stay in the archive
  const showArchive = section === 'archive' && !app.archivedCards && !app.yearRecap

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [app.step, app.insightsView, app.section, app.archiveView])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <SafeAreaTopBar />
      <UpdateNotificationBanner />
      <InstallPromptBanner />
      {/* Leaves room for the OS status bar / notch that SafeAreaTopBar paints */}
      <header className="bg-white border-b border-gray-200 shadow-sm" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* the logo and «Активні | Архів»; each page has its own way back, so there are no steps up here */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <button
              onClick={handleReset}
              className="flex items-center space-x-3 group cursor-pointer"
              title={t('logoTitle')}
            >
              <AppLogo className="w-10 h-10 shrink-0 group-hover:opacity-80 transition-opacity" />
              <div className="text-left">
                <h1 className="text-2xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{t('appName')}</h1>
                <p className="hidden sm:block text-sm text-gray-500">{t('appSubtitle')}</p>
              </div>
            </button>

            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <div role="tablist" aria-label={t('section.label')} className="flex p-1 gap-0.5 rounded-full bg-indigo-50">
                {(['active', 'archive'] as const).map((key) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={section === key}
                    onClick={() => (section === key && !app.archiveView && !app.archivedCards && !app.yearRecap ? undefined : dispatch({ type: 'SECTION_CHANGED', payload: key }))}
                    className={`px-3.5 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      section === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    {t(`section.${key}`)}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8 sm:pt-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="animate-fade-in">
          {showArchive ? (
            <ArchivePage />
          ) : (
            <>
              {app.step === 'upload' && <UploadPage />}
              {app.step === 'insights' && <InsightsPage />}
              {app.step === 'gallery' && <GalleryPage />}
              {app.step === 'export' && <ExportPage />}
            </>
          )}
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
