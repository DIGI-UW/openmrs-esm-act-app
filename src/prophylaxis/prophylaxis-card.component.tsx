import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@carbon/react';
import {
  CardHeader,
  ConfigurableLink,
  formatDate,
  getAssignedExtensions,
  parseDate,
  useAssignedExtensions,
  useExtensionStore,
} from '@openmrs/esm-framework';
import { patientChartUrl } from '../patient-chart-url';
import { useOralEntries } from '../prophylaxis-page/prophylaxis-page.resource';
import { RecordProphylaxisButtons } from './record-prophylaxis-buttons.component';
import { type ProphylaxisSummary, useProphylaxisSummary } from './prophylaxis.resource';
import styles from '../styles/summary-card.scss';

interface ProphylaxisCardProps {
  patientUuid: string;
}

function useRegimenLabel() {
  const { t } = useTranslation();
  return (summary: ProphylaxisSummary) => {
    if (summary.type === 'Oral') {
      return summary.regimen ?? t('oral', 'Oral');
    }
    if (summary.type !== 'BPG' || !summary.intervalDays) {
      return t('noPrescription', 'No prescription');
    }
    return summary.intervalDays % 7 === 0
      ? t('bpgEveryWeeks', 'BPG · every {{weeks}} weeks', { weeks: summary.intervalDays / 7 })
      : t('bpgEveryDays', 'BPG · every {{days}} days', { days: summary.intervalDays });
  };
}

/** The Prophylaxis page's path, found in the chart's nav as ChartReview finds dashboards, or null when it is not there. */
function useProphylaxisPagePath() {
  // Re-renders when a dashboard group's slot fills, which getAssignedExtensions does not subscribe to.
  useExtensionStore();
  const page = useAssignedExtensions('patient-chart-dashboard-slot')
    .flatMap((link) => (link.config?.slotName ? getAssignedExtensions(link.config.slotName) : [link]))
    .find((link) => link.name === 'act-prophylaxis-dashboard-link');
  return page ? ({ ...page.meta, ...page.config }.path as string) : null;
}

const date = (value: string | null) => (value ? formatDate(parseDate(value), { time: false }) : '--');

/** The patient summary's prophylaxis: regimen, last and next dose, on-time count, and the forms to record a dose. */
export default function ProphylaxisCard({ patientUuid }: ProphylaxisCardProps) {
  const { t } = useTranslation();
  const { summary, error } = useProphylaxisSummary(patientUuid);
  const regimenLabel = useRegimenLabel();
  const pagePath = useProphylaxisPagePath();
  // An oral regimen has no doses to count on time, so the card shows the latest reported adherence instead.
  const oral = summary?.type === 'Oral';
  const { entries } = useOralEntries(oral ? patientUuid : null);
  // ACT Core takes the latest report by encounter date, not by estimate date.
  const latestAdherence = entries
    .filter((entry) => entry.adherence != null)
    .sort((a, b) => b.encounterDatetime.localeCompare(a.encounterDatetime))[0]?.adherence;

  if (error) {
    return null;
  }

  const fields = summary && [
    { id: 'type', label: t('type', 'Type'), value: regimenLabel(summary) },
    // ACT Core dates an oral regimen by its latest adherence report and when that report's supply runs out.
    {
      id: 'last-dose',
      label: oral ? t('lastReport', 'Last report') : t('lastDose', 'Last dose'),
      value: date(summary.lastGiven),
    },
    {
      id: 'next-due',
      label: oral ? t('nextRefill', 'Next refill') : t('nextDue', 'Next due'),
      value: date(summary.nextDue),
      overdue: summary.status === 'overdue',
    },
    oral
      ? {
          id: 'on-time',
          label: t('adherenceLastReport', 'Adherence (last report)'),
          value: latestAdherence == null ? '--' : `${latestAdherence}%`,
        }
      : {
          id: 'on-time',
          label: t('onTimeSixMonths', 'On-time (6 months)'),
          value: summary.onTime
            ? t('onTimeCount', '{{given}} of {{total}}', { given: summary.onTime.given, total: summary.onTime.total })
            : '--',
        },
  ];

  return (
    <div className={styles.card}>
      <CardHeader title={t('prophylaxis', 'Prophylaxis')}>
        <div className={styles.actions}>
          {pagePath && (
            <ConfigurableLink to={`${patientChartUrl(patientUuid)}/${pagePath}`} className={styles.headerLink}>
              {t('history', 'History')}
            </ConfigurableLink>
          )}
          <RecordProphylaxisButtons patientUuid={patientUuid} />
        </div>
      </CardHeader>
      {!fields ? (
        <div data-testid="prophylaxis-loading">
          <SkeletonText paragraph lineCount={2} />
        </div>
      ) : (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div key={field.id} className={styles.field}>
              <dt className={styles.label}>{field.label}</dt>
              <dd
                className={styles.value}
                data-testid={`prophylaxis-${field.id}`}
                data-overdue={String(Boolean(field.overdue))}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
