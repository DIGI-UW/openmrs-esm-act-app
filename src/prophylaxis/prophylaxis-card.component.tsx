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
  useConfig,
  useExtensionStore,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useOralEntries } from '../prophylaxis-page/prophylaxis-page.resource';
import { RecordProphylaxisButtons } from './record-prophylaxis-buttons.component';
import { usePrescription } from './prescription.resource';
import { type ProphylaxisSummary, useProphylaxisSummary } from './prophylaxis.resource';
import UpdateProphylaxis from './update-prophylaxis.component';
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

/** A fraction as a whole percentage, as ACT 2.0 showed adherence. */
const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** The patient summary's prophylaxis: regimen, its start and duration, last and next dose, on-time count, and the forms to record a dose. */
export default function ProphylaxisCard({ patientUuid }: ProphylaxisCardProps) {
  const { t } = useTranslation();
  const { summary, error } = useProphylaxisSummary(patientUuid);
  const { prophylaxisUpdate } = useConfig<Config>();
  const { prescription } = usePrescription(patientUuid, prophylaxisUpdate.concepts);
  const prescribed = prescription?.groups[0];
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
    { id: 'started', label: t('started', 'Started'), value: date(prescribed?.started ?? null) },
    { id: 'duration', label: t('duration', 'Duration'), value: prescription?.duration?.label || '--' },
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
      : summary.adherence != null
        ? {
            id: 'on-time',
            label: t('adherenceTwelveMonths', 'Adherence (12 months)'),
            value: percent(summary.adherence),
            detail: summary.onTime
              ? t('onTimeCountMonths', '{{given}} of {{total}} on time, {{months}} months', {
                  given: summary.onTime.given,
                  total: summary.onTime.total,
                  months: summary.onTime.months,
                })
              : null,
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
          <UpdateProphylaxis patientUuid={patientUuid} />
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
                {'detail' in field && field.detail && (
                  <span className={styles.detail} data-testid={`prophylaxis-${field.id}-detail`}>
                    {field.detail}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
