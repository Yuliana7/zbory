import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import type {
  AppState,
  RawDonation,
  Donation,
  Aggregates,
  Insight,
  CommentInsights,
  TemplateType,
} from '../types';
import { parseCSV, normalizeDonations } from '../utils/csvParser';
import { aggregateDonations } from '../utils/dataAggregator';
import { generateInsights } from '../utils/insightGenerator';
import { analyzeComments } from '../utils/commentAnalyzer';

// ─── State ────────────────────────────────────────────────────────────────────

export interface FullState {
  app: AppState;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_APP_STATE: AppState = {
  step: 'upload',
  rawData: null,
  donations: null,
  aggregates: null,
  insights: null,
  commentInsights: null,
  selectedTemplate: null,
};

const INITIAL_STATE: FullState = {
  app: INITIAL_APP_STATE,
  isLoading: false,
  error: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'FILE_PARSED'; payload: { rawData: RawDonation[]; donations: Donation[] } }
  | {
      type: 'PROCEED_TO_INSIGHTS';
      payload: {
        aggregates: Aggregates;
        insights: Insight[];
        commentInsights: CommentInsights | null;
        goal?: number;
      };
    }
  | { type: 'TEMPLATE_SELECTED'; payload: TemplateType }
  | { type: 'GO_TO_STEP'; payload: AppState['step'] }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function appReducer(state: FullState, action: AppAction): FullState {
  switch (action.type) {
    case 'SET_LOADING':
      // Clear error when loading starts so stale messages don't linger
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error,
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'FILE_PARSED':
      return {
        ...state,
        isLoading: false,
        error: null,
        app: { ...state.app, ...action.payload },
      };

    case 'PROCEED_TO_INSIGHTS':
      return {
        ...state,
        app: { ...state.app, ...action.payload, step: 'insights' },
      };

    case 'TEMPLATE_SELECTED': {
      const id = action.payload;
      const defaultStory = new Set(['daily-activity', 'top-donors', 'weekly-recap']);
      const needsGoal = new Set(['progress', 'milestone', 'urgency']);
      return {
        ...state,
        app: {
          ...state.app,
          selectedTemplate: {
            id,
            name: id,
            description: '',
            format: defaultStory.has(id) ? 'story' : 'post',
            requiresGoal: needsGoal.has(id),
          },
          step: 'export',
        },
      };
    }

    case 'GO_TO_STEP':
      return { ...state, app: { ...state.app, step: action.payload } };

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: FullState;
  dispatch: Dispatch<AppAction>;
  handleFileSelect: (file: File) => Promise<void>;
  handleProceedToInsights: (goal?: number) => void;
  handleTemplateSelect: (templateId: TemplateType) => void;
  handleReset: () => void;
  goToStep: (step: AppState['step']) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  const handleFileSelect = useCallback(async (file: File) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const rawData = await parseCSV(file);
      if (rawData.length === 0)
        throw new Error('CSV файл порожній або не містить даних');

      const donations = normalizeDonations(rawData);
      if (donations.length === 0)
        throw new Error(
          'Не вдалося обробити дані з CSV файлу. Переконайтеся, що формат файлу правильний',
        );

      dispatch({ type: 'FILE_PARSED', payload: { rawData, donations } });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Помилка при обробці файлу',
      });
    }
  }, []);

  const handleProceedToInsights = useCallback(
    (goal?: number) => {
      if (!state.app.donations) return;
      try {
        const aggregates = aggregateDonations(state.app.donations);
        const insights = generateInsights(aggregates);
        const commentInsights = analyzeComments(state.app.donations);
        dispatch({ type: 'PROCEED_TO_INSIGHTS', payload: { aggregates, insights, commentInsights, goal } });
      } catch (err) {
        console.error(err);
        dispatch({ type: 'SET_ERROR', payload: 'Помилка при генерації аналітики' });
      }
    },
    [state.app.donations],
  );

  const handleTemplateSelect = useCallback((templateId: TemplateType) => {
    dispatch({ type: 'TEMPLATE_SELECTED', payload: templateId });
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const goToStep = useCallback(
    (step: AppState['step']) => {
      const idx: Record<AppState['step'], number> = { upload: 1, insights: 2, gallery: 3, export: 4 };
      if (idx[step] < idx[state.app.step]) {
        dispatch({ type: 'GO_TO_STEP', payload: step });
      }
    },
    [state.app.step],
  );

  return (
    <AppContext.Provider
      value={{ state, dispatch, handleFileSelect, handleProceedToInsights, handleTemplateSelect, handleReset, goToStep }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
