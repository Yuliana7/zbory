import { useState } from 'react';
import { useFriendsDraft } from '../../hooks/useFriendsDraft';
import { useTranslation } from 'react-i18next';
import type { Donation, MonobankJarRef, RawDonation } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { SaveCampaignControl } from '../insights/SaveCampaignControl';
import { ArrowLeftIcon, ArrowRightIcon } from '../../icons';
import { downloadCSV, manualRowsToCSVString, rawDonationsToManualRows } from '../../utils/csvExporter';
import { SECTION_IDS, clearSectionHash, type SectionId } from '../../utils/sectionAnchors';
import { PreviewSection } from './preview/PreviewSection';
import { GoalSection } from './preview/GoalSection';
import { FriendsSection } from './preview/FriendsSection';
import { UnsavedFriendsDialog } from './preview/UnsavedFriendsDialog';
import { AddDataSection } from './preview/AddDataSection';
import { useSectionAnchors } from './preview/useSectionAnchors';

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

/** Step 1's check-and-adjust page, in sections: the data itself, the campaign goal, friendly
 * jars and adding more data. Each section has a URL hash (see sectionAnchors) so the
 * «Змінити» menu can open the page already scrolled to the one you picked. */
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
  const unsaved = !!useAppContext().state.app.unsavedChanges;
  const goTo = useSectionAnchors();
  const [goalInput, setGoalInput] = useState(initialGoal ? String(initialGoal) : '');
  const [showInvalidWarning, setShowInvalidWarning] = useState(false);
  const goal = parseGoal(goalInput);
  const friendsDraft = useFriendsDraft();
  // the step the user tried to take while helper edits were unsaved; the dialog decides what happens to it
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  const handleProceed = () => {
    if (friendsDraft.dirty) {
      setPendingLeave(() => proceed);
      goTo('friends');
      return;
    }
    proceed();
  };

  const proceed = () => {
    // Incomplete rows get one warning first; a second press goes ahead anyway
    if (invalidRowCount > 0 && !showInvalidWarning) {
      setShowInvalidWarning(true);
      goTo('preview');
      return;
    }
    clearSectionHash(); // leaving the preview for good
    onProceed(goal ?? undefined);
  };

  const handleBack = () => {
    if (friendsDraft.dirty) {
      setPendingLeave(() => leaveBack);
      return;
    }
    leaveBack();
  };

  const leaveBack = () => {
    clearSectionHash();
    onBack();
  };

  // The dialog's three answers. Saving goes through the same draft the form uses; the step
  // continues once the saved helpers are in place.
  const resolveLeave = (how: 'save' | 'discard') => {
    const go = pendingLeave;
    setPendingLeave(null);
    if (how === 'save') {
      // two helpers with one name can't be stored — stay and let the form show which
      if (!friendsDraft.save()) {
        goTo('friends');
        return;
      }
    } else friendsDraft.discard();
    go?.();
  };

  const handleDownload = () => {
    const csv = manualRowsToCSVString(rawDonationsToManualRows(rawData));
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    downloadCSV(csv, `jar_statement_${stamp}.csv`);
  };

  const proceedLabel = showInvalidWarning && invalidRowCount > 0 ? t('preview.proceedAnywayButton') : t('preview.proceedButton');
  const sectionLabel: Record<SectionId, string> = {
    preview: t('sections.preview'),
    goal: t('sections.goal'),
    friends: t('sections.friends'),
    'add-data': t('sections.addData'),
  };

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
          <SaveCampaignControl goalOverride={goal ?? undefined} highlight={unsaved} />
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

      <nav aria-label={t('sections.nav')}>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {SECTION_IDS.map((id) => (
            <li key={id} className="shrink-0">
              <button
                onClick={() => goTo(id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                {sectionLabel[id]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <PreviewSection
        donations={donations}
        totalCount={totalCount}
        invalidRowCount={invalidRowCount}
        showInvalidWarning={showInvalidWarning}
        onEdit={onEdit}
        onDownload={handleDownload}
      />
      <GoalSection value={goalInput} onChange={setGoalInput} invalid={goalInput !== '' && goal === null} />
      <FriendsSection draft={friendsDraft} />
      <AddDataSection monobankJar={monobankJar} onMergeFile={onMergeFile} onMonobank={onMonobank} isLoading={isLoading} />

      {/* the page is long, especially on a phone — don't make people scroll back up to continue */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleProceed}
          className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
        >
          {proceedLabel}
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>

      {pendingLeave && (
        <UnsavedFriendsDialog
          onSave={() => resolveLeave('save')}
          onDiscard={() => resolveLeave('discard')}
          onCancel={() => setPendingLeave(null)}
        />
      )}
    </div>
  );
}

function parseGoal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[\s,.]/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
