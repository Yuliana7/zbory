import { useTranslation } from 'react-i18next';
import type { Format } from '../../../utils/exportStack';
import { Collapsible, ToggleRow } from '../shared';

interface LayoutPanelProps {
  open: boolean;
  onToggle: () => void;
  isDailyActivity: boolean;
  format: Format;
  hasHeaderToggle: boolean;
  hasFooterToggle: boolean;
  showHeader: boolean;
  onShowHeaderChange: (v: boolean) => void;
  showFooter: boolean;
  onShowFooterChange: (v: boolean) => void;
  showUAFlag: boolean;
  onShowUAFlagChange: (v: boolean) => void;
  showChart: boolean;
  onShowChartChange: (v: boolean) => void;
  showBars: boolean;
  onShowBarsChange: (v: boolean) => void;
  showBestDay: boolean;
  onShowBestDayChange: (v: boolean) => void;
}

export function LayoutPanel({
  open, onToggle, isDailyActivity, format,
  hasHeaderToggle, hasFooterToggle,
  showHeader, onShowHeaderChange,
  showFooter, onShowFooterChange,
  showUAFlag, onShowUAFlagChange,
  showChart, onShowChartChange,
  showBars, onShowBarsChange,
  showBestDay, onShowBestDayChange,
}: LayoutPanelProps) {
  const { t } = useTranslation('export');
  return (
    <Collapsible label={t('layout.label')} open={open} onToggle={onToggle}>
      <div className="space-y-3">
        {hasHeaderToggle && (
          <ToggleRow label={t('layout.header')} value={showHeader} onChange={onShowHeaderChange} />
        )}
        {hasFooterToggle && (
          <ToggleRow label={t('layout.footer')} value={showFooter} onChange={onShowFooterChange} />
        )}
        <ToggleRow label={t('layout.UAFlag')} value={showUAFlag} onChange={onShowUAFlagChange} />
        {isDailyActivity && (
          <>
            <ToggleRow label={t('layout.chart')} value={showChart} onChange={onShowChartChange} />
            {format === 'story' && (
              <ToggleRow label={t('layout.bars')} value={showBars} onChange={onShowBarsChange} />
            )}
            <ToggleRow label={t('layout.bestDay')} value={showBestDay} onChange={onShowBestDayChange} />
          </>
        )}
      </div>
    </Collapsible>
  );
}
