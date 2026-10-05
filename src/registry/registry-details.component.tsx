import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { rankWaitingRows } from '../waiting-list/urgency';
import styles from './registry.scss';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromToday(date: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - today.getTime()) / DAY_MS);
}

const shortDate = (date: Date) => formatDate(date, { time: false, noToday: true });

/** What the registry's card showed in ACT 2.0 beyond the table's columns: clinics, visits, doses and procedures. */
export function RegistryDetails({ row }: { row: ReportRow }) {
  const { t } = useTranslation();
  const { waitingList, urgencyBands } = useConfig<Config>();
  const { rows: waitingRows } = useReportDataset(waitingList.report);
  const interventions = useMemo(
    () =>
      rankWaitingRows(
        waitingRows.filter((waiting) => waiting.patient_uuid === row.patient_uuid),
        urgencyBands,
      ),
    [waitingRows, urgencyBands, row.patient_uuid],
  );
  const none = t('none', 'None');
  const nextConsultation = parseReportDate(row.next_consultation_date);
  const lastInjection = parseReportDate(row.last_injection_date);
  const nextInjection = parseReportDate(row.next_due_date);

  const fields: Array<{ id: string; label: string; value: React.ReactNode; overdue?: boolean }> = [
    { id: 'cardiac-clinic', label: t('cardiacClinic', 'Cardiac clinic'), value: String(row.cardiac_clinic ?? none) },
    {
      id: 'primary-care-clinic',
      label: t('primaryCareClinic', 'Primary care clinic'),
      value: String(row.primary_care_clinic ?? none),
    },
    {
      id: 'next-consultation',
      label: t('nextConsultation', 'Next consultation'),
      value: nextConsultation ? shortDate(nextConsultation) : none,
      overdue: nextConsultation != null && daysFromToday(nextConsultation) < 0,
    },
    {
      id: 'last-injection',
      label: t('lastInjection', 'Last injection'),
      value: lastInjection
        ? t('dateDaysAgo', '{{date}} ({{days}} days ago)', {
            date: shortDate(lastInjection),
            days: -daysFromToday(lastInjection),
          })
        : none,
    },
    {
      id: 'injection-due',
      label: t('injectionDue', 'Injection due'),
      value: nextInjection ? shortDate(nextInjection) : none,
      overdue: nextInjection != null && daysFromToday(nextInjection) < 0,
    },
  ];

  return (
    <div className={styles.details}>
      <dl className={styles.detailFields}>
        {fields.map((field) => (
          <div key={field.id}>
            <dt className={styles.detailLabel}>{field.label}</dt>
            <dd
              data-testid={`registry-${field.id}`}
              data-overdue={String(Boolean(field.overdue))}
              className={field.overdue ? styles.overdue : undefined}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className={styles.detailLabel}>{t('interventions', 'Interventions')}</h4>
        {interventions.length ? (
          <ul data-testid="registry-interventions">
            {interventions.map(({ row: waiting, daysPending, band, overdue }) => {
              const deadline = urgencyBands[band]?.deadlineDays;
              const name = String(waiting.procedure_name ?? waiting.procedure_type ?? '');
              const when =
                deadline == null || daysPending == null
                  ? ''
                  : overdue
                    ? t('daysOverdue', '{{days}} days overdue', { days: daysPending - deadline })
                    : t('dueInDays', 'Due in {{days}} days', { days: deadline - daysPending });
              return (
                <li
                  key={String(waiting.recommendation_uuid)}
                  data-overdue={String(overdue)}
                  className={overdue ? styles.overdue : undefined}
                >
                  {when ? `${name}: ${when}` : name}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{none}</p>
        )}
      </div>
    </div>
  );
}
