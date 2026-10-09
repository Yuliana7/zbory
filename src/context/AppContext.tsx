import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
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
  CampaignDataset,
  FriendJar,
  MonobankJarRef,
  LoadedCampaign,
} from '../types';
import { parseCSV, normalizeDonations } from '../utils/csvParser';
import { manualRowsToRawDonations } from '../utils/csvExporter';
import { aggregateDonations } from '../utils/dataAggregator';
import { generateInsights } from '../utils/insightGenerator';
import { analyzeComments } from '../utils/commentAnalyzer';
import { saveSession, updateSessionGoal, updateSessionFriends, updateSessionMonobankJar, clearSession, loadSession } from '../utils/session';
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
  activeCampaignName: null,
  campaignDatasets: null,
};

const INITIAL_STATE: FullState = {
  app: INITIAL_APP_STATE,
  isLoading: false,
  error: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'FILE_PARSED'; payload: { rawData: RawDonation[]; donations: Donation[]; withdrawals: Withdrawal[]; currentBalance: number; originalFileName?: string; goal?: number; activeCampaignId?: string; activeCampaignName?: string; campaignDatasets?: CampaignDataset[]; style?: SharedStyle; friends?: FriendJar[]; monobankJar?: MonobankJarRef; unsaved?: boolean } }
  | { type: 'FRIENDS_UPDATED'; payload: FriendJar[] }
  | { type: 'MOMENTS_DISMISSED' }
  // Before the fetched rows are reviewed: remember which jar they came from (and its goal)
  | { type: 'MONOBANK_SOURCE_SET'; payload: { jar?: MonobankJarRef; goal?: number } }
  | { type: 'CAMPAIGN_SAVED'; payload: { id: string; name: string } }
  | {
      type: 'PROCEED_TO_INSIGHTS';
      payload: {
        aggregates: Aggregates;
        insights: Insight[];
        commentInsights: CommentInsights | null;
        goal?: number;
        /** opened with «Аналітика» from the project list, never through the preview */
        fromLibrary?: boolean;
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
          activeCampaignName: action.payload.activeCampaignName ?? null,
          campaignDatasets: action.payload.campaignDatasets ?? null,
          goal: action.payload.goal,
          stackStyle: action.payload.style ?? null,
          friends: action.payload.friends,
          monobankJar: action.payload.monobankJar,
          unsavedChanges: action.payload.unsaved ?? false,
          momentsDismissed: false, // a different dataset gets its moments back
        },
      };

    case 'MOMENTS_DISMISSED':
      return { ...state, app: { ...state.app, momentsDismissed: true } };

    case 'MONOBANK_SOURCE_SET':
      return { ...state, app: { ...state.app, monobankJar: action.payload.jar, goal: action.payload.goal } };

    case 'FRIENDS_UPDATED':
      return { ...state, app: { ...state.app, friends: action.payload, unsavedChanges: state.app.activeCampaignId ? true : state.app.unsavedChanges } };

    case 'CAMPAIGN_SAVED':
      return {
        ...state,
        app: { ...state.app, activeCampaignId: action.payload.id, activeCampaignName: action.payload.name, unsavedChanges: false },
      };

    case 'PROCEED_TO_INSIGHTS':
      return {
        ...state,
        app: { ...state.app, ...action.payload, fromLibrary: action.payload.fromLibrary ?? false, step: 'insights' },
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
  handleLoadCampaign: (id: string, opts?: { proceed?: boolean }) => Promise<LoadedCampaign | null>;
  handleLoadCampaigns: (ids: string[], opts?: { proceed?: boolean }) => Promise<boolean>;
  handleSaveCampaign: (name: string, goalOverride?: number) => Promise<CampaignMeta | null>;
  handleMergeFile: (file: File) => Promise<MergeResult | null>;
  handleMergeRows: (incoming: RawDonation[], opts?: { fileName?: string; monobankJar?: MonobankJarRef }) => MergeResult | null;
  handleMonobankSource: (jar?: MonobankJarRef, goal?: number) => void;
  handleFriendsChange: (friends: FriendJar[]) => Promise<void>;
  goToStep: (step: AppState['step']) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  // latest state for callbacks that must stay stable (and not close over stale data)
  const stateRef = useRef(state);
  stateRef.current = state;
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
      updateSessionMonobankJar(undefined);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
    }
  }, [t]);

  // Handles both fresh manual entry (state.app is empty, so the campaign link
  // below is already null) and editing rows of an already-loaded dataset —
  // in the latter case, preserving activeCampaignId/originalFileName/goal is
  // what keeps "Зберегти" showing as "Оновити" for the same campaign instead
  // of silently treating the edit as a brand-new, unlinked dataset.
  const handleManualDataProceed = useCallback((rows: ManualRow[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const rawData = manualRowsToRawDonations(rows);
      const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
      if (donations.length === 0) {
        throw new Error(t('errors.manualProcessError'));
      }
      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData,
          donations,
          withdrawals,
          currentBalance,
          originalFileName: state.app.originalFileName ?? undefined,
          goal: state.app.goal,
          activeCampaignId: state.app.activeCampaignId ?? undefined,
          activeCampaignName: state.app.activeCampaignName ?? undefined,
          style: state.app.stackStyle ?? undefined,
          friends: state.app.friends,
          monobankJar: state.app.monobankJar,
          unsaved: !!state.app.activeCampaignId,
        },
      });
      saveSession(rawData, state.app.originalFileName ?? null);
      updateSessionMonobankJar(state.app.monobankJar);
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.manualDataError'),
      });
    }
  }, [state.app.originalFileName, state.app.goal, state.app.activeCampaignId, state.app.activeCampaignName, state.app.stackStyle, state.app.friends, state.app.monobankJar, t]);

  // `monobankJar` links the project to a jar at the same time (the state's own value would still be the old one here)
  const handleMergeRows = useCallback((incoming: RawDonation[], opts?: { fileName?: string; monobankJar?: MonobankJarRef }): MergeResult | null => {
    if (!state.app.rawData) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      if (incoming.length === 0) throw new Error(t('errors.csvEmpty'));

      const result = mergeRawDonations(state.app.rawData, incoming);
      const { donations, withdrawals, currentBalance } = normalizeDonations(result.merged);
      if (donations.length === 0) throw new Error(t('errors.csvParseError'));

      const fileName = state.app.originalFileName ?? opts?.fileName;
      const monobankJar = opts?.monobankJar ?? state.app.monobankJar;
      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData: result.merged,
          donations,
          withdrawals,
          currentBalance,
          originalFileName: fileName,
          goal: state.app.goal,
          activeCampaignId: state.app.activeCampaignId ?? undefined,
          activeCampaignName: state.app.activeCampaignName ?? undefined,
          style: state.app.stackStyle ?? undefined,
          friends: state.app.friends,
          monobankJar,
          unsaved: !!state.app.activeCampaignId,
        },
      });
      saveSession(result.merged, fileName ?? null);
      updateSessionMonobankJar(monobankJar);
      return result;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
      return null;
    }
  }, [state.app.rawData, state.app.originalFileName, state.app.goal, state.app.activeCampaignId, state.app.activeCampaignName, state.app.stackStyle, state.app.friends, state.app.monobankJar, t]);

  // Merges another CSV export into the currently loaded dataset (long
  // campaigns come in chunks); campaign link and goal survive the merge.
  const handleMergeFile = useCallback(async (file: File): Promise<MergeResult | null> => {
    if (!state.app.rawData) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      return handleMergeRows(await parseCSV(file), { fileName: file.name });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
      return null;
    }
  }, [state.app.rawData, handleMergeRows, t]);

  // Remembers which Monobank jar the rows being reviewed came from (and its goal);
  // the review table's "proceed" then carries both into the normal flow. Called
  // with no jar to forget it again (cancel).
  const handleMonobankSource = useCallback((jar?: MonobankJarRef, goal?: number) => {
    dispatch({ type: 'MONOBANK_SOURCE_SET', payload: { jar, goal } });
  }, []);

  // Everything step 2 needs, derived from the loaded rows
  const buildAnalytics = useCallback(
    (donations: Donation[], withdrawals: Withdrawal[], currentBalance: number) => {
      const aggregates = aggregateDonations(donations, withdrawals, currentBalance);
      return {
        aggregates,
        insights: generateInsights(aggregates, tInsights),
        commentInsights: analyzeComments(donations),
      };
    },
    [tInsights],
  );

  const handleProceedToInsights = useCallback(
    (goal?: number) => {
      if (!state.app.donations) return;
      try {
        const analytics = buildAnalytics(state.app.donations, state.app.withdrawals ?? [], state.app.currentBalance);
        dispatch({ type: 'PROCEED_TO_INSIGHTS', payload: { ...analytics, goal } });
        updateSessionGoal(goal);
      } catch (err) {
        console.error(err);
        dispatch({ type: 'SET_ERROR', payload: t('errors.insightsError') });
      }
    },
    [state.app.donations, state.app.withdrawals, state.app.currentBalance, buildAnalytics, t],
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
          friends: session.friends,
          monobankJar: session.monobankJar,
        },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Opens a saved campaign from the library (IndexedDB)
  // `proceed` skips the data check and goes straight to analytics (step 2).
  const handleLoadCampaign = useCallback(async (id: string, opts?: { proceed?: boolean }): Promise<LoadedCampaign | null> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [meta, data] = await Promise.all([getCampaignMeta(id), loadCampaignData(id)]);
      if (!meta || !data) throw new Error();
      const { rawData, style, friends, monobankJar } = data;
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
          activeCampaignName: meta.name,
          style: style ?? undefined,
          friends,
          monobankJar: monobankJar ?? undefined,
        },
      });
      saveSession(rawData, meta.fileName);
      updateSessionMonobankJar(monobankJar ?? undefined);
      updateSessionGoal(meta.goal);
      if (opts?.proceed) {
        dispatch({ type: 'PROCEED_TO_INSIGHTS', payload: { ...buildAnalytics(donations, withdrawals, currentBalance), goal: meta.goal, fromLibrary: true } });
      }
      return { rawData, monobankJar: monobankJar ?? undefined };
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignLoadError') });
      return null;
    }
  }, [buildAnalytics, t]);

  // Opens several campaigns at once: merged rows drive the normal pipeline,
  // campaignDatasets keeps each jar separate for per-jar/cross analytics.
  const handleLoadCampaigns = useCallback(async (ids: string[], opts?: { proceed?: boolean }): Promise<boolean> => {
    if (ids.length === 0) return false;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const datasets: CampaignDataset[] = [];
      // Prefill the merged goal from each jar's own saved target, if any —
      // otherwise the user has to re-type a combined goal from scratch.
      let goalSum = 0;
      let hasAnyGoal = false;
      for (const id of ids) {
        const [meta, data] = await Promise.all([getCampaignMeta(id), loadCampaignData(id)]);
        if (!meta || !data) throw new Error();
        datasets.push({ id, name: meta.name, rawData: data.rawData });
        if (meta.goal) {
          goalSum += meta.goal;
          hasAnyGoal = true;
        }
      }
      let merged: RawDonation[] = [];
      for (const d of datasets) merged = mergeRawDonations(merged, d.rawData).merged;
      const { donations, withdrawals } = normalizeDonations(merged);
      // Each campaign is an independent jar with its own Залишок history — the
      // newest row across the merged set only reflects one jar's balance, not
      // a combined one. Summing each jar's own currentBalance is what "Разом"
      // totals actually mean; anything else manufactures a fake impliedRefund
      // equal to the other jars' balances.
      const currentBalance = datasets.reduce(
        (sum, d) => sum + normalizeDonations(d.rawData).currentBalance,
        0,
      );
      if (donations.length === 0) throw new Error();
      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData: merged,
          donations,
          withdrawals,
          currentBalance,
          goal: hasAnyGoal ? goalSum : undefined,
          activeCampaignId: ids.length === 1 ? ids[0] : undefined,
          activeCampaignName: ids.length === 1 ? datasets[0].name : undefined,
          campaignDatasets: datasets.length > 1 ? datasets : undefined,
        },
      });
      if (opts?.proceed) {
        dispatch({
          type: 'PROCEED_TO_INSIGHTS',
          payload: { ...buildAnalytics(donations, withdrawals, currentBalance), goal: hasAnyGoal ? goalSum : undefined, fromLibrary: true },
        });
      }
      return true;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignLoadError') });
      return false;
    }
  }, [buildAnalytics, t]);

  // Saves (or updates, when a campaign is already open) the current dataset.
  // goalOverride lets a caller that owns a not-yet-committed goal value (the
  // upload preview's goal input, before the user hits "Proceed") save that
  // value directly — state.app.goal only updates on PROCEED_TO_INSIGHTS, so
  // saving from the preview screen would otherwise persist a stale/empty goal.
  const handleSaveCampaign = useCallback(async (name: string, goalOverride?: number): Promise<CampaignMeta | null> => {
    if (!state.app.rawData) return null;
    try {
      const meta = await saveCampaign({
        id: state.app.activeCampaignId ?? undefined,
        name,
        rawData: state.app.rawData,
        fileName: state.app.originalFileName,
        goal: goalOverride !== undefined ? goalOverride : state.app.goal,
        style: state.app.stackStyle ?? undefined,
        friends: state.app.friends,
        monobankJar: state.app.monobankJar,
      });
      dispatch({ type: 'CAMPAIGN_SAVED', payload: { id: meta.id, name: meta.name } });
      return meta;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignSaveError') });
      return null;
    }
  }, [state.app.rawData, state.app.activeCampaignId, state.app.originalFileName, state.app.goal, state.app.stackStyle, state.app.friends, state.app.monobankJar, t]);

  // Helpers are stored with the open project right away when it is already in the library, so
  // «Зберегти друзів» is a real save; a project that was never saved keeps them for this session
  // only (it has no name yet — the top «Зберегти» puts it in the library).
  const handleFriendsChange = useCallback(async (friends: FriendJar[]) => {
    dispatch({ type: 'FRIENDS_UPDATED', payload: friends });
    updateSessionFriends(friends);
    const { app } = stateRef.current;
    if (!app.activeCampaignId || !app.activeCampaignName || !app.rawData) return;
    try {
      const meta = await saveCampaign({
        id: app.activeCampaignId,
        name: app.activeCampaignName,
        rawData: app.rawData,
        fileName: app.originalFileName,
        goal: app.goal,
        style: app.stackStyle ?? undefined,
        friends,
        monobankJar: app.monobankJar,
      });
      dispatch({ type: 'CAMPAIGN_SAVED', payload: { id: meta.id, name: meta.name } });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignSaveError') });
    }
  }, [t]);

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
      value={{ state, dispatch, handleFileSelect, handleManualDataProceed, handleProceedToInsights, handleTemplateSelect, handleTemplatesSelect, handleReset, handleRestoreSession, handleLoadCampaign, handleLoadCampaigns, handleSaveCampaign, handleMergeFile, handleMergeRows, handleMonobankSource, handleFriendsChange, goToStep }}
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
