import { useState } from 'react'
import type { AppState, TemplateType } from './types'
import { FileUpload } from './components/upload/FileUpload'
import { PreviewTable } from './components/upload/PreviewTable'
import { InsightsPanel } from './components/insights/InsightsPanel'
import { TemplateSelector } from './components/templates/TemplateSelector'
import { ExportScreen } from './components/screens/ExportScreen'
import { parseCSV, normalizeDonations } from './utils/csvParser'
import { aggregateDonations } from './utils/dataAggregator'
import { generateInsights } from './utils/insightGenerator'

function App() {
  const [appState, setAppState] = useState<AppState>({
    step: 'upload',
    rawData: null,
    donations: null,
    aggregates: null,
    insights: null,
    selectedTemplate: null,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      // Parse CSV
      const rawData = await parseCSV(file)

      if (rawData.length === 0) {
        throw new Error('CSV файл порожній або не містить даних')
      }

      // Normalize donations
      const donations = normalizeDonations(rawData)

      if (donations.length === 0) {
        throw new Error('Не вдалося обробити дані з CSV файлу. Переконайтеся, що формат файлу правильний')
      }

      // Update state with parsed data
      setAppState(prev => ({
        ...prev,
        rawData,
        donations,
      }))

      setShowPreview(true)
    } catch (err) {
      console.error('Error processing file:', err)
      setError(err instanceof Error ? err.message : 'Помилка при обробці файлу')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProceedToInsights = () => {
    if (!appState.donations) return

    try {
      // Generate aggregates
      const aggregates = aggregateDonations(appState.donations)

      // Generate insights
      const insights = generateInsights(aggregates)

      // Update state and move to insights step
      setAppState(prev => ({
        ...prev,
        aggregates,
        insights,
        step: 'insights',
      }))

      setShowPreview(false)
    } catch (err) {
      console.error('Error generating insights:', err)
      setError('Помилка при генерації аналітики')
    }
  }

  const handleTemplateSelect = (templateId: TemplateType) => {
    setAppState(prev => ({
      ...prev,
      selectedTemplate: {
        id: templateId,
        name: templateId,
        description: '',
        format: templateId === 'daily-activity' ? 'story' : 'post',
        requiresGoal: templateId === 'progress',
      },
      step: 'export',
    }))
  }

  const handleReset = () => {
    setAppState({
      step: 'upload',
      rawData: null,
      donations: null,
      aggregates: null,
      insights: null,
      selectedTemplate: null,
    })
    setShowPreview(false)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <button
              onClick={handleReset}
              className="flex items-center space-x-3 group cursor-pointer"
              title="На початок"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:opacity-80 transition-opacity">
                ₴
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">Zbory</h1>
                <p className="text-sm text-gray-500">Аналітика збору коштів</p>
              </div>
            </button>

            {/* Progress indicator — completed steps are clickable breadcrumbs */}
            <div className="flex items-center space-x-2 text-xs sm:text-sm">
              {/* Step 1 */}
              <button
                onClick={appState.step !== 'upload' ? handleReset : undefined}
                disabled={appState.step === 'upload'}
                className={`flex items-center transition-colors ${appState.step === 'upload' ? 'text-indigo-700 font-semibold cursor-default' : 'text-gray-400 hover:text-indigo-600 cursor-pointer'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${appState.step === 'upload' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="ml-2 font-medium hidden sm:inline">Завантаження</span>
              </button>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-200" />
              {/* Step 2 */}
              <button
                onClick={appState.step === 'export' ? () => setAppState(prev => ({ ...prev, step: 'insights' })) : undefined}
                disabled={appState.step !== 'export'}
                className={`flex items-center transition-colors ${appState.step === 'insights' ? 'text-indigo-700 font-semibold cursor-default' : appState.step === 'export' ? 'text-gray-400 hover:text-indigo-600 cursor-pointer' : 'text-gray-400 cursor-default'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${appState.step === 'insights' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="ml-2 font-medium hidden sm:inline">Аналітика</span>
              </button>
              <div className="w-8 sm:w-16 h-0.5 bg-gray-200" />
              {/* Step 3 */}
              <div className={`flex items-center ${appState.step === 'export' ? 'text-indigo-700 font-semibold' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${appState.step === 'export' ? 'bg-indigo-700 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="ml-2 font-medium hidden sm:inline">Експорт</span>
              </div>
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
          {appState.step === 'upload' && !showPreview && (
            <div className="text-center py-12 sm:py-20">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Завантажте CSV файл з виписки
              </h2>
              <p className="text-gray-600 mb-8">
                Підтримуються файли з Monobank Jar
              </p>
              <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
            </div>
          )}

          {appState.step === 'upload' && showPreview && appState.donations && (
            <div className="py-8">
              <PreviewTable
                donations={appState.donations}
                totalCount={appState.donations.length}
                onProceed={handleProceedToInsights}
                onCancel={handleReset}
              />
            </div>
          )}

          {appState.step === 'insights' && appState.aggregates && appState.insights && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Аналітика збору</h2>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                             bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                             hover:border-gray-300 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Завантажити інший файл
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InsightsPanel
                  insights={appState.insights}
                  aggregates={appState.aggregates}
                />
                <TemplateSelector onSelect={handleTemplateSelect} />
              </div>
            </div>
          )}

          {appState.step === 'export' && appState.selectedTemplate && appState.aggregates && appState.insights && (
            <ExportScreen
              templateId={appState.selectedTemplate.id}
              aggregates={appState.aggregates}
              insights={appState.insights}
              onBack={() => setAppState(prev => ({ ...prev, step: 'insights' }))}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Збори • Створено для українських волонтерів 💙💛
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App