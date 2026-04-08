import { useState } from 'react'
import type { AppState, TemplateType } from './types'
import { FileUpload } from './components/upload/FileUpload'
import { PreviewTable } from './components/upload/PreviewTable'
import { InsightsPanel } from './components/insights/InsightsPanel'
import { TemplateGallery } from './components/screens/TemplateGallery'
import { ExportScreen } from './components/screens/ExportScreen'
import { parseCSV, normalizeDonations } from './utils/csvParser'
import { aggregateDonations } from './utils/dataAggregator'
import { generateInsights } from './utils/insightGenerator'
import { analyzeComments } from './utils/commentAnalyzer'

// Maps each step name to its 1-based index for the header breadcrumb
const STEP_INDEX: Record<AppState['step'], number> = {
  upload: 1,
  insights: 2,
  gallery: 3,
  export: 4,
}

const STEP_LABELS = ['Завантаження', 'Аналітика', 'Шаблони', 'Експорт']

function App() {
  const [appState, setAppState] = useState<AppState>({
    step: 'upload',
    rawData: null,
    donations: null,
    aggregates: null,
    insights: null,
    commentInsights: null,
    selectedTemplate: null,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStepIdx = STEP_INDEX[appState.step]

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      const rawData = await parseCSV(file)
      if (rawData.length === 0) throw new Error('CSV файл порожній або не містить даних')

      const donations = normalizeDonations(rawData)
      if (donations.length === 0) {
        throw new Error('Не вдалося обробити дані з CSV файлу. Переконайтеся, що формат файлу правильний')
      }

      setAppState(prev => ({ ...prev, rawData, donations }))
      setShowPreview(true)
    } catch (err) {
      console.error('Error processing file:', err)
      setError(err instanceof Error ? err.message : 'Помилка при обробці файлу')
    } finally {
      setIsLoading(false)
    }
  }

  const handleProceedToInsights = (goal?: number) => {
    if (!appState.donations) return
    try {
      const aggregates = aggregateDonations(appState.donations)
      const insights = generateInsights(aggregates)
      const commentInsights = analyzeComments(appState.donations)

      setAppState(prev => ({ ...prev, aggregates, insights, commentInsights, goal, step: 'insights' }))
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
      commentInsights: null,
      selectedTemplate: null,
    })
    setShowPreview(false)
    setError(null)
  }

  // Navigate backwards to a specific step (only allowed for completed steps)
  const goToStep = (step: AppState['step']) => {
    if (STEP_INDEX[step] < currentStepIdx) {
      setAppState(prev => ({ ...prev, step }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Logo */}
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

            {/* 4-step breadcrumb */}
            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm">
              {STEP_LABELS.map((label, idx) => {
                const stepNum = idx + 1
                const isActive = stepNum === currentStepIdx
                const isCompleted = stepNum < currentStepIdx
                const stepKeys: AppState['step'][] = ['upload', 'insights', 'gallery', 'export']
                const stepKey = stepKeys[idx]

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
                    {idx < STEP_LABELS.length - 1 && (
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
          {/* Step 1 — Upload */}
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

          {/* Step 2 — Analytics */}
          {appState.step === 'insights' && appState.aggregates && appState.insights && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Аналітика збору</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                               bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm
                               hover:border-gray-300 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Інший файл
                  </button>
                  <button
                    onClick={() => setAppState(prev => ({ ...prev, step: 'gallery' }))}
                    className="flex items-center gap-2 text-sm font-semibold text-white
                               bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 shadow-sm transition-all"
                  >
                    Обрати шаблон
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <InsightsPanel
                insights={appState.insights}
                aggregates={appState.aggregates}
                goal={appState.goal}
                commentInsights={appState.commentInsights}
              />
            </div>
          )}

          {/* Step 3 — Template gallery */}
          {appState.step === 'gallery' && appState.aggregates && (
            <TemplateGallery
              aggregates={appState.aggregates}
              goal={appState.goal}
              onSelect={handleTemplateSelect}
              onBack={() => setAppState(prev => ({ ...prev, step: 'insights' }))}
            />
          )}

          {/* Step 4 — Export */}
          {appState.step === 'export' && appState.selectedTemplate && appState.aggregates && (
            <ExportScreen
              templateId={appState.selectedTemplate.id}
              aggregates={appState.aggregates}
              initialGoal={appState.goal}
              onBack={() => setAppState(prev => ({ ...prev, step: 'gallery' }))}
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
