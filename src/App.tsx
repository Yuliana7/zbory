import { useState } from 'react'
import type { AppState, RawDonation, Donation, Aggregates, Insight, Template } from './types'

function App() {
  const [appState, setAppState] = useState<AppState>({
    step: 'upload',
    rawData: null,
    donations: null,
    aggregates: null,
    insights: null,
    selectedTemplate: null,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                З
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Zbory</h1>
                <p className="text-sm text-gray-500">Аналітика збору коштів</p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="hidden sm:flex items-center space-x-2">
              <div className={`flex items-center ${appState.step === 'upload' ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${appState.step === 'upload' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium">Завантаження</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-200" />
              <div className={`flex items-center ${appState.step === 'insights' ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${appState.step === 'insights' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium">Аналітика</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-200" />
              <div className={`flex items-center ${appState.step === 'export' ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${appState.step === 'export' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium">Експорт</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {appState.step === 'upload' && (
            <div className="text-center py-20">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Завантажте CSV файл з виписки
              </h2>
              <p className="text-gray-600 mb-8">
                Підтримуються файли з Monobank Jar
              </p>
              <div className="max-w-2xl mx-auto">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 hover:border-indigo-400 transition-colors duration-200 cursor-pointer">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-4 text-sm text-gray-600">
                      Перетягніть файл сюди або <span className="text-indigo-600 font-medium">оберіть файл</span>
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      CSV до 50 MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {appState.step === 'insights' && (
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-gray-900">
                Генеруємо інсайти...
              </h2>
            </div>
          )}

          {appState.step === 'export' && (
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-gray-900">
                Експорт зображення
              </h2>
            </div>
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