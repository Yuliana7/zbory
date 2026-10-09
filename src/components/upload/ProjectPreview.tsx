import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Donation, MonobankJarRef, RawDonation } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useFriendsDraft } from '../../hooks/useFriendsDraft';
import { useUnsavedFriendsGuard } from '../../hooks/useUnsavedFriendsGuard';
import { SaveCampaignControl } from '../insights/SaveCampaignControl';
import { ArrowLeftIcon, ArrowRightIcon } from '../../icons';
import { downloadCSV, manualRowsToCSVString, rawDonationsToManualRows } from '../../utils/csvExporter';
import { parseGoal } from '../../utils/goal';
import { PreviewSection } from './preview/PreviewSection';
import { GoalSection } from './preview/GoalSection';
import { FriendsSection } from './preview/FriendsSection';
import { AddDataSection } from './preview/AddDataSection';

type OptionalSection = 'goal' | 'friends' | 'add-data';

interface ProjectPreviewProps {
  donations: Donation[];
  rawData: RawDonation[];
  totalCount: number;
  invalidRowCount: number;
  onProceed: (goal?: number) => void;
  onBack: () => void;
  onEdit?: () => void;
  onMergeFile: (file: File) => Promise<boolean>;
  onMonobank: () => void;
  monobankJar?: MonobankJarRef;
  isLoading: boolean;
  initialGoal?: number; // prefilled when the dataset came with a goal (campaign / restored session)
}

/** Step 1's check-and-adjust page for a freshly loaded project: the data itself, always open,
 * and the optional parts (goal, friendly jars, more data) as rows that open on demand. */
export function ProjectPreview({
  donations,
  rawData,
  totalCount,
  invalidRowCount,
  onProceed,
  onBack,
  onEdit,
  onMergeFile,
  onMonobank,
  monobankJar,
  isLoading,
  initialGoal,
}: ProjectPreviewProps) {
  const { t } = useTranslation('upload');
  const { t: tCamp } = useTranslation('campaigns');
  const { state } = useAppContext();
  const unsaved = !!state.app.unsavedChanges;
  const [goalInput, setGoalInput] = useState(initialGoal ? String(initialGoal) : '');
  const [showInvalidWarning, setShowInvalidWarning] = useState(false);
  const [open, setOpen] = useState<Set<OptionalSection>>(new Set());
  const dataRef = useRef<HTMLDivElement>(null);
  const goal = parseGoal(goalInput);

  const toggle = (id: OptionalSection) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const friendsDraft = useFriendsDraft();
  // leaving with helper edits that were never saved asks first; if saving is refused, show why
  const { guard, dialog } = useUnsavedFriendsGuard(friendsDraft, () => setOpen((prev) => new Set(prev).add('friends')));

  const handleProceed = () => {
    // Incomplete rows get one warning first; a second press goes ahead anyway
    if (invalidRowCount > 0 && !showInvalidWarning) {
      setShowInvalidWarning(true);
      dataRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (friendsDraft.dirty) setOpen((prev) => new Set(prev).add('friends'));
    guard(() => onProceed(goal ?? undefined));
  };

  const handleBack = () => guard(onBack);

  const handleDownload = () => {
    const csv = manualRowsToCSVString(rawDonationsToManualRows(rawData));
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    downloadCSV(csv, `jar_statement_${stamp}.csv`);
  };

  const proceedLabel = showInvalidWarning && invalidRowCount > 0 ? t('preview.proceedAnywayButton') : t('preview.proceedButton');

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-4">
      {unsaved && (
        <div role="status" className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {tCamp('unsavedChanges')}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800
                     bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-gray-300 transition-all"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {t('preview.cancelButton')}
        </button>
        <div className="flex items-center gap-2">
          {/* an empty goal field means "no goal": null clears the saved one */}
          <SaveCampaignControl goalOverride={goal} highlight={unsaved} />
          <button
            onClick={handleProceed}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       rounded-lg px-4 py-2 shadow-sm transition-all"
          >
            {proceedLabel}
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={dataRef} className="scroll-mt-4">
        <PreviewSection
          donations={donations}
          totalCount={totalCount}
          invalidRowCount={invalidRowCount}
          showInvalidWarning={showInvalidWarning}
          onEdit={onEdit}
          onDownload={handleDownload}
        />
      </div>
      <GoalSection value={goalInput} onChange={setGoalInput} open={open.has('goal')} onToggle={() => toggle('goal')} />
      <FriendsSection
        draft={friendsDraft}
        savedCount={state.app.friends?.length ?? 0}
        open={open.has('friends')}
        onToggle={() => toggle('friends')}
      />
      <AddDataSection
        monobankJar={monobankJar}
        onMergeFile={onMergeFile}
        onMonobank={onMonobank}
        isLoading={isLoading}
        open={open.has('add-data')}
        onToggle={() => toggle('add-data')}
      />

      <div className="flex justify-end pt-2">
        <button onClick={handleProceed} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
          {proceedLabel}
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>

      {dialog}
    </div>
  );
}
