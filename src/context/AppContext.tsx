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
  LastMerge,
  InsightsView,
} from '../types';
import { parseCSV, normalizeDonations } from '../utils/csvParser';
import { manualRowsToRawDonations } from '../utils/csvExporter';
import { aggregateDonations } from '../utils/dataAggregator';
import { generateInsights } from '../utils/insightGenerator';
import { analyzeComments } from '../utils/commentAnalyzer';
import { saveSession, updateSessionFriends, clearSession, loadSession } from '../utils/session';
import { saveCampaign, getCampaignMeta, loadCampaignData, type CampaignMeta } from '../utils/campaignStore';
import { mergeRawDonations, type MergeResult } from '../utils/mergeDonations';

import { makeCard } from '../utils/exportStack';

/** Where a project's rows come from and what goes with them; no id = a new project. */
interface ProjectSource {
  id?: string | null;
  name?: string | null;
  fileName?: string | null;
  goal?: number;
  style?: SharedStyle;
  friends?: FriendJar[];
  monobankJar?: MonobankJarRef;
  monobankSyncedAt?: number;
}

interface MergeOptions {
  fileName?: string;
  monobankJar?: MonobankJarRef;
  syncedAt?: number;
  /** helpers read at the same time, so everything lands in one save */
  friends?: FriendJar[];
  /** an automatic renew: say nothing unless something new came in */
  quiet?: boolean;
}

/** A new project's name: the jar's title, then the file's name, then its dates. */
function projectName(
  fileName: string | null,
  jar: MonobankJarRef | undefined,
  donations: Donation[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (jar) return jar.title;
  if (fileName) return fileName.replace(/\.csv$/i, '');
  const times = donations.map((d) => d.timestamp.getTime());
  const day = (ms: number) => new Date(ms).toLocaleDateString('uk-UA');
  return t('defaultName', { from: day(Math.min(...times)), to: day(Math.max(...times)) });
}

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
  galleryOpenGroups: [],
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
  | { type: 'FILE_PARSED'; payload: { rawData: RawDonation[]; donations: Donation[]; withdrawals: Withdrawal[]; currentBalance: number; originalFileName?: string; goal?: number; activeCampaignId?: string; activeCampaignName?: string; campaignDatasets?: CampaignDataset[]; style?: SharedStyle; friends?: FriendJar[]; monobankJar?: MonobankJarRef; monobankSyncedAt?: number } }
  | { type: 'FRIENDS_UPDATED'; payload: FriendJar[] }
  | { type: 'FRIENDS_EDIT_OPENED' }
  | { type: 'FRIENDS_EDIT_DONE' }
  | { type: 'MERGE_REPORTED'; payload: LastMerge | undefined }
  | { type: 'RENEW_REQUESTED'; payload: boolean }
  | { type: 'INSIGHTS_VIEW'; payload: InsightsView }
  | { type: 'CAMPAIGN_SAVED'; payload: { id: string; name: string } }
  | {
      type: 'PROCEED_TO_INSIGHTS';
      payload: {
        aggregates: Aggregates;
        insights: Insight[];
        commentInsights: CommentInsights | null;
        goal?: number;
      };
    }
  | { type: 'TEMPLATES_SELECTED'; payload: TemplateType[]; range?: { from: string; to: string } }
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
          monobankSyncedAt: action.payload.monobankSyncedAt,
        },
      };

    case 'FRIENDS_EDIT_OPENED':
      return { ...state, app: { ...state.app, friendsEdit: { returnTo: 'insights' }, step: 'upload' } };

    case 'FRIENDS_EDIT_DONE':
      return { ...state, app: { ...state.app, friendsEdit: undefined, step: 'insights' } };

    case 'MERGE_REPORTED':
      return { ...state, app: { ...state.app, lastMerge: action.payload } };

    case 'RENEW_REQUESTED':
      return { ...state, app: { ...state.app, renewRequested: action.payload } };

    case 'INSIGHTS_VIEW':
      return { ...state, app: { ...state.app, insightsView: action.payload } };

    case 'FRIENDS_UPDATED':
      return { ...state, app: { ...state.app, friends: action.payload } };

    case 'CAMPAIGN_SAVED':
      return {
        ...state,
        app: { ...state.app, activeCampaignId: action.payload.id, activeCampaignName: action.payload.name },
      };

    case 'PROCEED_TO_INSIGHTS':
      return {
        ...state,
        app: { ...state.app, ...action.payload, step: 'insights' },
      };

    case 'TEMPLATES_SELECTED':
      return {
        ...state,
        app: {
          ...state.app,
          selectedTemplates: action.payload,
          // a card opened for a period of the breakdown page starts on that period
          stackCards: action.range
            ? [
                ...(state.app.stackCards ?? []).filter((c) => !action.payload.includes(c.templateId)),
                ...action.payload.map((id) => ({ ...makeCard(id, []), dateFrom: action.range!.from, dateTo: action.range!.to })),
              ]
            : state.app.stackCards,
          step: 'export',
        },
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
  handleManualDataProceed: (rows: ManualRow[]) => Promise<void>;
  handleTemplateSelect: (templateId: TemplateType, range?: { from: string; to: string }) => void;
  handleTemplatesSelect: (templateIds: TemplateType[]) => void;
  handleReset: () => void;
  handleRestoreSession: () => Promise<boolean>;
  handleLoadCampaign: (id: string, opts?: { proceed?: boolean }) => Promise<LoadedCampaign | null>;
  handleLoadCampaigns: (ids: string[], opts?: { proceed?: boolean }) => Promise<boolean>;
  handleSaveCampaign: (name: string, goalOverride?: number | null) => Promise<CampaignMeta | null>;
  handleMergeFile: (file: File) => Promise<MergeResult | null>;
  handleMergeRows: (incoming: RawDonation[], opts?: MergeOptions) => Promise<MergeResult | null>;
  handleMonobankProject: (rows: RawDonation[], jar: MonobankJarRef, goal?: number) => Promise<void>;
  handleUndoMerge: () => Promise<void>;
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
  const { t: tCampaigns } = useTranslation('campaigns');

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

  // The one way data enters a project: whatever the source, the rows are saved to the library
  // straight away (a new project gets a name of its own, renamed later from «Редагувати») and the
  // analytics opens on them. If storage fails the rows stay in the session and the error is shown.
  const commitRows = useCallback(
    async (rawData: RawDonation[], src: ProjectSource): Promise<boolean> => {
      const { donations, withdrawals, currentBalance } = normalizeDonations(rawData);
      if (donations.length === 0) return false;
      const fileName = src.fileName ?? null;
      let id = src.id ?? undefined;
      let name = src.name ?? projectName(fileName, src.monobankJar, donations, tCampaigns);
      let saveFailed = false;
      try {
        const meta = await saveCampaign({
          id,
          name,
          rawData,
          fileName,
          goal: src.goal,
          style: src.style,
          friends: src.friends,
          monobankJar: src.monobankJar,
          monobankSyncedAt: src.monobankSyncedAt,
        });
        id = meta.id;
        name = meta.name;
        clearSession(); // it is in the library now; nothing is left to restore
      } catch {
        saveFailed = true;
        saveSession(rawData, fileName);
      }
      dispatch({
        type: 'FILE_PARSED',
        payload: {
          rawData,
          donations,
          withdrawals,
          currentBalance,
          originalFileName: fileName ?? undefined,
          goal: src.goal,
          activeCampaignId: saveFailed ? undefined : id,
          activeCampaignName: saveFailed ? undefined : name,
          style: src.style,
          friends: src.friends,
          monobankJar: src.monobankJar,
          monobankSyncedAt: src.monobankSyncedAt,
        },
      });
      dispatch({ type: 'PROCEED_TO_INSIGHTS', payload: { ...buildAnalytics(donations, withdrawals, currentBalance), goal: src.goal } });
      if (saveFailed) dispatch({ type: 'SET_ERROR', payload: t('errors.campaignSaveError') });
      return true;
    },
    [buildAnalytics, t, tCampaigns],
  );

  /** the open project as a source for commitRows */
  const currentSource = useCallback((): ProjectSource => {
    const { app } = stateRef.current;
    return {
      id: app.activeCampaignId,
      name: app.activeCampaignName,
      fileName: app.originalFileName,
      goal: app.goal,
      style: app.stackStyle ?? undefined,
      friends: app.friends,
      monobankJar: app.monobankJar,
      monobankSyncedAt: app.monobankSyncedAt,
    };
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const rawData = await parseCSV(file);
      if (rawData.length === 0)
        throw new Error(t('errors.csvEmpty'));

      if (!(await commitRows(rawData, { fileName: file.name }))) throw new Error(t('errors.csvParseError'));
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
    }
  }, [commitRows, t]);

  // Fresh manual entry (nothing open, so a new project) and edited rows of the open project alike
  const handleManualDataProceed = useCallback(async (rows: ManualRow[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      if (!(await commitRows(manualRowsToRawDonations(rows), currentSource()))) throw new Error(t('errors.manualProcessError'));
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.manualDataError'),
      });
    }
  }, [commitRows, currentSource, t]);

  // `monobankJar` links the project to a jar at the same time. With `syncedAt` this is a renew from
  // Monobank, where an empty result is a normal answer: nothing new, but the data is fresh as of now.
  const handleMergeRows = useCallback(async (incoming: RawDonation[], opts?: MergeOptions): Promise<MergeResult | null> => {
    const rawData = stateRef.current.app.rawData;
    if (!rawData) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      if (incoming.length === 0 && !opts?.syncedAt) throw new Error(t('errors.csvEmpty'));

      const result = mergeRawDonations(rawData, incoming);
      const src = currentSource();
      const saved = await commitRows(result.merged, {
        ...src,
        fileName: src.fileName ?? opts?.fileName,
        monobankJar: opts?.monobankJar ?? src.monobankJar,
        monobankSyncedAt: opts?.syncedAt ?? src.monobankSyncedAt,
        friends: opts?.friends ?? src.friends,
      });
      if (!saved) throw new Error(t('errors.csvParseError'));
      if (!opts?.quiet || result.added > 0) dispatch({
        type: 'MERGE_REPORTED',
        payload: {
          added: result.added,
          duplicates: result.duplicates,
          timeShiftMinutes: result.timeShiftMinutes,
          suspectedOverlap: result.suspectedOverlap,
          // only a merge the app itself doubts can be taken back
          previousRows: result.suspectedOverlap ? rawData : undefined,
        },
      });
      return result;
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
      return null;
    }
  }, [commitRows, currentSource, t]);

  const handleUndoMerge = useCallback(async () => {
    const previous = stateRef.current.app.lastMerge?.previousRows;
    if (!previous) return;
    await commitRows(previous, currentSource());
    dispatch({ type: 'MERGE_REPORTED', payload: undefined });
  }, [commitRows, currentSource]);

  // A new project from a Monobank jar
  const handleMonobankProject = useCallback(async (rows: RawDonation[], jar: MonobankJarRef, goal?: number) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const saved = await commitRows(rows, { fileName: null, monobankJar: jar, goal, monobankSyncedAt: Date.now() });
    if (!saved) dispatch({ type: 'SET_ERROR', payload: t('errors.csvParseError') });
  }, [commitRows, t]);

  // Merges another CSV export into the currently loaded dataset (long
  // campaigns come in chunks); campaign link and goal survive the merge.
  const handleMergeFile = useCallback(async (file: File): Promise<MergeResult | null> => {
    if (!state.app.rawData) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      return await handleMergeRows(await parseCSV(file), { fileName: file.name });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : t('errors.fileProcessError'),
      });
      return null;
    }
  }, [state.app.rawData, handleMergeRows, t]);

  const handleTemplateSelect = useCallback((templateId: TemplateType, range?: { from: string; to: string }) => {
    dispatch({ type: 'TEMPLATES_SELECTED', payload: [templateId], range });
  }, []);

  const handleTemplatesSelect = useCallback((templateIds: TemplateType[]) => {
    if (templateIds.length === 0) return;
    dispatch({ type: 'TEMPLATES_SELECTED', payload: templateIds });
  }, []);

  const handleReset = useCallback(() => {
    clearSession();
    dispatch({ type: 'RESET' });
  }, []);

  // Rows left from a session that could not reach the library: they become a project like any other
  const handleRestoreSession = useCallback(async (): Promise<boolean> => {
    const session = loadSession();
    if (!session) return false;
    try {
      return await commitRows(session.rawData, {
        fileName: session.fileName,
        goal: session.goal,
        friends: session.friends,
        monobankJar: session.monobankJar,
      });
    } catch {
      return false;
    }
  }, [commitRows]);

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
          monobankSyncedAt: meta.monobankSyncedAt,
        },
      });
      if (opts?.proceed) {
        dispatch({ type: 'PROCEED_TO_INSIGHTS', payload: { ...buildAnalytics(donations, withdrawals, currentBalance), goal: meta.goal } });
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
          payload: { ...buildAnalytics(donations, withdrawals, currentBalance), goal: hasAnyGoal ? goalSum : undefined },
        });
      }
      return true;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.campaignLoadError') });
      return false;
    }
  }, [buildAnalytics, t]);

  // Saves the open project under `name` (renaming it) — goalOverride sets its goal, null clears it.
  const handleSaveCampaign = useCallback(async (name: string, goalOverride?: number | null): Promise<CampaignMeta | null> => {
    if (!state.app.rawData) return null;
    try {
      const meta = await saveCampaign({
        id: state.app.activeCampaignId ?? undefined,
        name,
        rawData: state.app.rawData,
        fileName: state.app.originalFileName,
        // null = the goal was cleared; undefined = keep what the project has
        goal: goalOverride === null ? undefined : goalOverride !== undefined ? goalOverride : state.app.goal,
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

  // Helpers are stored with the open project right away.
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
      if (idx[step] >= idx[state.app.step]) return;
      // everything is saved as it happens, so going back to step 1 just closes the project
      if (step === 'upload') handleReset();
      else dispatch({ type: 'GO_TO_STEP', payload: step });
    },
    [state.app.step, handleReset],
  );

  return (
    <AppContext.Provider
      value={{ state, dispatch, handleFileSelect, handleManualDataProceed, handleTemplateSelect, handleTemplatesSelect, handleReset, handleRestoreSession, handleLoadCampaign, handleLoadCampaigns, handleSaveCampaign, handleMergeFile, handleMergeRows, handleMonobankProject, handleUndoMerge, handleFriendsChange, goToStep }}
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
