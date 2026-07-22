import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemplateType, Aggregates, CommentInsights, CardState, SharedStyle } from '../../types';
import { ProgressCard } from '../../components/templates/ProgressCard';
import { DailyActivityCard } from '../../components/templates/DailyActivityCard';
import { ThankYouCard } from '../../components/templates/ThankYouCard';
import { MilestoneCard } from '../../components/templates/MilestoneCard';
import { DonorsCountCard } from '../../components/templates/DonorsCountCard';
import { UrgencyCard } from '../../components/templates/UrgencyCard';
import { TopDonorsCard } from '../../components/templates/TopDonorsCard';
import { WeeklyRecapCard } from '../../components/templates/WeeklyRecapCard';
import { SpeedCard } from '../../components/templates/SpeedCard';
import { FundsFlowCard } from '../../components/templates/FundsFlowCard';
import { FinalReportCard } from '../../components/templates/FinalReportCard';
import { ConcreteAskCard } from '../../components/templates/ConcreteAskCard';
import { EmojiCloudCard } from '../../components/templates/EmojiCloudCard';
import { CommentsCard, type SelectedComment } from '../../components/templates/CommentsCard';
import { ReportCard } from '../../components/templates/ReportCard';
import { CampaignsChartCard } from '../../components/templates/CampaignsChartCard';
import { buildReport, datasetsToItems, type ReportPeriod } from '../../utils/campaignAnalytics';
import { FORMAT_DIMS, type Format } from '../../utils/exportStack';

// ─── Card canvas: background + template, the exact node captured for PNG ─────

interface CardCanvasProps {
  card: CardState;
  style: SharedStyle;
  aggregates: Aggregates;
  goal?: number;
  commentInsights: CommentInsights | null;
  crossItems: ReturnType<typeof datasetsToItems> | null;
  selectedComments: SelectedComment[];
  safeZonePad: boolean;
  templateRef: React.RefObject<HTMLDivElement>;
  exRef?: React.RefObject<HTMLDivElement>;
}

export function CardCanvas({ card, style, aggregates, goal, commentInsights, crossItems, selectedComments, safeZonePad, templateRef, exRef }: CardCanvasProps) {
  const dims = FORMAT_DIMS[card.format];
  // Image is rendered as a separate overlay (with filter/transform controls),
  // so the template itself gets 'transparent' when an image is active.
  const bgOverride = style.bgTransparent || style.bgImage ? 'transparent' : style.bgColor ?? undefined;

  return (
    <div
      ref={exRef}
      style={{
        position: 'relative',
        width: dims.width,
        height: dims.height,
        overflow: 'hidden',
        // palette bg shows through semi-transparent image when opacity < 1
        background: style.bgImage ? style.palette.background : undefined,
      }}
    >
      {style.bgImage && (
        <img
          src={style.bgImage}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${style.bgOffsetX}%, ${style.bgOffsetY}%) scale(${style.bgZoom}) rotate(${style.bgRotate}deg)`,
            filter: `brightness(${style.bgBrightness})`,
            opacity: style.bgOpacity,
          }}
        />
      )}
      <TemplateRenderer
        templateId={card.templateId}
        templateRef={templateRef}
        aggregates={aggregates}
        goal={goal}
        format={card.format}
        palette={style.palette}
        textOverrides={card.textOverrides}
        fontScale={style.fontScale}
        showRefunds={card.showRefunds}
        bgOverride={bgOverride}
        showHeader={card.showHeader}
        showFooter={card.showFooter}
        showUAFlag={card.showUAFlag}
        showChart={card.showChart}
        showBars={card.showBars}
        showBestDay={card.showBestDay}
        safeZonePad={safeZonePad}
        commentInsights={commentInsights}
        crossItems={crossItems}
        selectedComments={selectedComments}
      />
    </div>
  );
}

// ─── Template renderer ────────────────────────────────────────────────────────

interface RendererProps {
  templateId: TemplateType;
  templateRef: React.RefObject<HTMLDivElement>;
  aggregates: Aggregates;
  goal?: number;
  format: Format;
  palette: SharedStyle['palette'];
  textOverrides: Record<string, string>;
  fontScale: number;
  showRefunds: boolean;
  bgOverride?: string;
  showHeader: boolean;
  showFooter: boolean;
  showUAFlag: boolean;
  showChart: boolean;
  showBars: boolean;
  showBestDay: boolean;
  safeZonePad?: boolean;
  commentInsights: CommentInsights | null;
  crossItems: ReturnType<typeof datasetsToItems> | null;
  selectedComments: SelectedComment[];
}

function TemplateRenderer({
  templateId,
  templateRef,
  aggregates,
  goal,
  format,
  palette,
  textOverrides,
  fontScale,
  showRefunds,
  bgOverride,
  showHeader,
  showFooter,
  showUAFlag,
  showChart,
  showBars,
  showBestDay,
  safeZonePad,
  commentInsights,
  crossItems,
  selectedComments
}: RendererProps) {
  const { t: tCamp } = useTranslation('campaigns');
  // Report period rides in textOverrides (key 'periodKey') so it survives
  // card persistence and batch export without a new CardState field.
  const periodKey = textOverrides['periodKey'] ?? 'all';
  const period: ReportPeriod = useMemo(() => {
    const [kind, year, quarter] = periodKey.split('-');
    if (kind === 'y') return { kind: 'year', year: Number(year) };
    if (kind === 'q') return { kind: 'quarter', year: Number(year), quarter: Number(quarter) };
    return { kind: 'all' };
  }, [periodKey]);
  const report = useMemo(
    () => (templateId === 'report' && crossItems ? buildReport(crossItems, period) : null),
    [templateId, crossItems, period],
  );
  const periodLabel =
    period.kind === 'all'
      ? tCamp('report.labelAll')
      : period.kind === 'year'
        ? tCamp('report.labelYear', { year: period.year })
        : tCamp('report.labelQuarter', { quarter: period.quarter, year: period.year });

  const shared = { ref: templateRef, aggregates, format, palette, textOverrides, fontScale, bgOverride, safeZonePad, showUAFlag };
  switch (templateId) {
    case 'progress': return <ProgressCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'daily-activity': return <DailyActivityCard {...shared} showHeader={showHeader} showChart={showChart} showBars={showBars} showBestDay={showBestDay} />;
    case 'thank-you': return <ThankYouCard {...shared} />;
    case 'milestone': return <MilestoneCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'donors-count': return <DonorsCountCard {...shared} />;
    case 'urgency': return <UrgencyCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'top-donors': return <TopDonorsCard {...shared} mode="sum" />;
    case 'top-donors-count': return <TopDonorsCard {...shared} mode="count" />;
    case 'weekly-recap': return <WeeklyRecapCard {...shared} showHeader={showHeader} showFooter={showFooter} />;
    case 'speed': return <SpeedCard {...shared} showHeader={showHeader} showFooter={showFooter} />;
    case 'funds-flow': return <FundsFlowCard {...shared} showRefunds={showRefunds} showHeader={showHeader} showFooter={showFooter} />;
    case 'final-report': return <FinalReportCard {...shared} showHeader={showHeader} showFooter={showFooter} />;
    case 'concrete-ask': return <ConcreteAskCard {...shared} goal={goal} showHeader={showHeader} showFooter={showFooter} />;
    case 'emoji-cloud': return <EmojiCloudCard {...shared} commentInsights={commentInsights} />;
    case 'comments': return <CommentsCard {...shared} selectedComments={selectedComments} />;
    case 'report': return report ? <ReportCard {...shared} report={report} periodLabel={periodLabel} /> : null;
    case 'campaigns-chart': return crossItems ? <CampaignsChartCard {...shared} items={crossItems} /> : null;
  }
}
