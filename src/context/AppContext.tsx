import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AppState,
  RawDonation,
  Donation,
  Withdrawal,
  Aggregates,
  Insight,
  CommentInsights,
  TemplateType,
  ManualRow,
  CardState,
  SharedStyle,
} from '../types';
import { parseCSV, normalizeDonations } from '../utils/csvParser';
import { manualRowsToRawDonations } from '../utils/csvExporter';
import { aggregateDonations } from '../utils/dataAggregator';
import { generateInsights } from '../utils/insightGenerator';
import { analyzeComments } from '../utils/commentAnalyzer';
import { saveSession, updateSessionGoal, clearSession, loadSession } from '../utils/session';
import { saveCampaign, getCampaignMeta, loadCampaignData, type CampaignMeta } from '../utils/campaignStore';
import { mergeRawDonations, type MergeResult } from '../utils/mergeDonations';
import { TEMPLATE_GROUPS } from '../utils/templateConfig';

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
  withdrawals: null,
  currentBalance: 0,
  aggregates: null,
  insights: null,
  commentInsights: null,
  selectedTemplates: null,
  gallerySelection: [],
  // First category open by default
  galleryOpenGroups: [TEMPLATE_GROUPS[0].id],
  stackCards: null,
  stackStyle: null,
  originalFileName: null,
  activeCampaignId: null,
};

const INITIAL_STATE: FullState = {
  app: INITIAL_APP_STATE,
  isLoading: false,
  error: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'FILE_PARSED'; payload: { rawData: RawDonation[]; donations: Donation[]; withdrawals: Withdrawal[]; currentBalance: number; originalFileName?: string; goal?: number; activeCampaignId?: string } }
  | { type: 'CAMPAIGN_SAVED'; payload: { id: string } }
  | {
      type: 'PROCEED_TO_INSIGHTS';
      payload: {
        aggregates: Aggregates;
        insights: Insight[];
        commentInsights: CommentInsights | null;
        goal?: number;
      };
    }
  | { type: 'TEMPLATES_SELECTED'; payload: TemplateType[] }
  | { type: 'GALLERY_UI'; payload: { selection?: TemplateType[]; openGroups?: string[] } }
  | { type: 'STACK_UPDATED'; payload: { cards: CardState[]; style: SharedStyle } }
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
        app: {
          ...state.app,
          ...action.payload,
          originalFileName: action.payload.originalFileName ?? null,
          // A fresh dataset detaches from any previously opened campaign and
          // drops a stale goal unless the source (campaign/session) carried one
          activeCampaignId: action.payload.activeCampaignId ?? null,
          goal: action.payload.goal,
        },
      };

    case 'CAMPAIGN_SAVED':
      return { ...state, app: { ...state.app, activeCampaignId: action.payload.id } };

    case 'PROCEED_TO_INSIGHTS':
      return {
        ...state,
        app: { ...state.app, ...action.payload, step: 'insights' },
      };

    case 'TEMPLATES_SELECTED':
      return {
        ...state,
        app: { ...state.app, selectedTemplates: action.payload, step: 'export' },
      };

    case 'STACK_UPDATED':
      return {
        ...state,
        app: { ...state.app, stackCards: action.payload.cards, stackStyle: action.payload.style },
      };

    case 'GALLERY_UI':
      return {
        ...state,
        app: {
          ...state.app,
          gallerySelection: action.payload.selection ?? state.app.gallerySelection,
          galleryOpenGroups: action.payload.openGroups ?? state.app.galleryOpenGroups,
        },
      };

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
  handleManualDataProceed: (rows: ManualRow[]) => void;
  handleProceedToInsights: (goal?: number) => void;
  handleTemplateSelect: (templateId: TemplateType) => void;
  handleTemplatesSelect: (templateIds: TemplateType[]) => void;
  handleReset: () => void;
  handleRestoreSession: () => boolean;
  handleLoadCampaign: (id: string) => Promise<boolean>;
  handleSaveCampaign: (name: string) => Promise<CampaignMeta | null>;
  handleMergeFile: (file: File) => Promise<MergeResult | null>;
  goToStep: (step: AppState['step']) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const { t } = useTranslation('common');
  const { t: tInsights } = useTranslation('insights');

  const handleFileSelect = useCallback(async (file: File) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const rawData = await parseCSV(file);
      if (rawData.length === 0)
        throw new Error(t('errors.csvEmpty'));

      const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
      if (donations.length === 0)
        throw new Error(t('errors.csvParseError'));

      dispatch({ type: 'FILE_PARSED', payload: { rawData, donations, withdrawals, currentBalance, originalFileName: file.name } });
      saveSession(rawData, file.name);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
    }
  }, [t]);

  const handleManualDataProceed = useCallback((rows: ManualRow[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const rawData = manualRowsToRawDonations(rows);
      const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
      if (donations.length === 0) {
        throw new Error(t('errors.manualProcessError'));
      }
      dispatch({ type: 'FILE_PARSED', payload: { rawData, donations, withdrawals, currentBalance } });
      saveSession(rawData, null);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.manualDataError'),
      });
    }
  }, [t]);

  // Merges another CSV export into the currently loaded dataset (long
  // campaigns come in chunks); campaign link and goal survive the merge.
  const handleMergeFile = useCallback(async (file: File): Promise<MergeResult | null> => {
    if (!state.app.rawData) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const incoming = await parseCSV(file);
      if (incoming.length === 0) throw new Error(t('errors.csvEmpty'));

      const result = mergeRawDonations(state.app.rawData, incoming);
      const { donations, withdrawals, currentBalance } = normalizeDonations(result.merged);
      if (donations.length === 0) throw new Error(t('errors.csvParseError'));

      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData: result.merged,
          donations,
          withdrawals,
          currentBalance,
          originalFileName: state.app.originalFileName ?? file.name,
          goal: state.app.goal,
          activeCampaignId: state.app.activeCampaignId ?? undefined,
        },
      });
      saveSession(result.merged, state.app.originalFileName ?? file.name);
      return result;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
      return null;
    }
  }, [state.app.rawData, state.app.originalFileName, state.app.goal, state.app.activeCampaignId, t]);

  const handleProceedToInsights = useCallback(
    (goal?: number) => {
      if (!state.app.donations) return;
      try {
        const aggregates = aggregateDonations(
          state.app.donations,
          state.app.withdrawals ?? [],
          state.app.currentBalance,
        );
        const insights = generateInsights(aggregates, tInsights);
        const commentInsights = analyzeComments(state.app.donations);
        dispatch({ type: 'PROCEED_TO_INSIGHTS', payload: { aggregates, insights, commentInsights, goal } });
        updateSessionGoal(goal);
      } catch (err) {
        console.error(err);
        dispatch({ type: 'SET_ERROR', payload: t('errors.insightsError') });
      }
    },
    [state.app.donations, state.app.withdrawals, state.app.currentBalance, t, tInsights],
  );

  const handleTemplateSelect = useCallback((templateId: TemplateType) => {
    dispatch({ type: 'TEMPLATES_SELECTED', payload: [templateId] });
  }, []);

  const handleTemplatesSelect = useCallback((templateIds: TemplateType[]) => {
    if (templateIds.length === 0) return;
    dispatch({ type: 'TEMPLATES_SELECTED', payload: templateIds });
  }, []);

  const handleReset = useCallback(() => {
    clearSession();
    dispatch({ type: 'RESET' });
  }, []);

  // Restores the autosaved dataset (after an accidental refresh/close)
  const handleRestoreSession = useCallback((): boolean => {
    const session = loadSession();
    if (!session) return false;
    try {
      const { donations, withdrawals, currentBalance } = normalizeDonations(session.rawData);
      if (donations.length === 0) return false;
      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData: session.rawData,
          donations,
          withdrawals,
          currentBalance,
          originalFileName: session.fileName ?? undefined,
          goal: session.goal,
        },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Opens a saved campaign from the library (IndexedDB)
  const handleLoadCampaign = useCallback(async (id: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [meta, rawData] = await Promise.all([getCampaignMeta(id), loadCampaignData(id)]);
      if (!meta || !rawData) throw new Error();
      const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
      if (donations.length === 0) throw new Error();
      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData,
          donations,
          withdrawals,
          currentBalance,
          originalFileName: meta.fileName ?? undefined,
          goal: meta.goal,
          activeCampaignId: id,
        },
      });
      saveSession(rawData, meta.fileName);
      updateSessionGoal(meta.goal);
      return true;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignLoadError') });
      return false;
    }
  }, [t]);

  // Saves (or updates, when a campaign is already open) the current dataset
  const handleSaveCampaign = useCallback(async (name: string): Promise<CampaignMeta | null> => {
    if (!state.app.rawData) return null;
    try {
      const meta = await saveCampaign({
        id: state.app.activeCampaignId ?? undefined,
        name,
        rawData: state.app.rawData,
        fileName: state.app.originalFileName,
        goal: state.app.goal,
      });
      dispatch({ type: 'CAMPAIGN_SAVED', payload: { id: meta.id } });
      return meta;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignSaveError') });
      return null;
    }
  }, [state.app.rawData, state.app.activeCampaignId, state.app.originalFileName, state.app.goal, t]);

  const goToStep = useCallback(
    (step: AppState['step']) => {
      const idx: Record<AppState['step'], number> = { upload: 1, insights: 2, gallery: 3, export: 4, compare: 1 };
      if (idx[step] < idx[state.app.step]) {
        dispatch({ type: 'GO_TO_STEP', payload: step });
      }
    },
    [state.app.step],
  );

  return (
    <AppContext.Provider
      value={{ state, dispatch, handleFileSelect, handleManualDataProceed, handleProceedToInsights, handleTemplateSelect, handleTemplatesSelect, handleReset, handleRestoreSession, handleLoadCampaign, handleSaveCampaign, handleMergeFile, goToStep }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components -- context hook lives with its provider
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
