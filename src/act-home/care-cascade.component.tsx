import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { formatDate, toOmrsIsoString, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useProgrammeScope } from '../programme-report/programme-scope';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useSessionClinicScope } from '../session-clinic';
import { ActHomeCard } from './act-home-card.component';
import styles from './care-cascade.scss';

function Cascade() {
  const { t } = useTranslation();
  const { careCascade } = useConfig<Config>();
  // The reports app runs a date as that day's midnight, so the counts match the report run for today.
  const today = useMemo(() => dayjs().startOf('day'), []);
  // The session's clinic, as Reports counts it; the report is not evaluated for every clinic while that is unknown.
  const scope = useProgrammeScope(false);
  const clinic = useSessionClinicScope();
  const clinicName = clinic.status === 'ready' ? clinic.clinic?.name : null;
  const { cardiacClinic, primaryCareClinic } = scope.status === 'ready' ? scope.params : {};
  const params = useMemo(
    () => ({
      endDate: toOmrsIsoString(today.toDate()),
      ...(cardiacClinic && { cardiacClinic }),
      ...(primaryCareClinic && { primaryCareClinic }),
    }),
    [today, cardiacClinic, primaryCareClinic],
  );
  const report = useReportDataset(scope.status === 'pending' ? null : careCascade.report, params);
  const { rows, error } = report;
  const isLoading = report.isLoading || scope.status === 'pending';
  // The cascade descriptor names its columns step and patients, one row per step.
  const byStep = new Map(rows.map((row) => [String(row.step), Number(row.patients)]));
  const steps = careCascade.steps
    .filter(({ step }) => byStep.has(step))
    .map(({ step, label }) => ({ step, label, patients: byStep.get(step) }));
  const largest = Math.max(0, ...steps.map((row) => row.patients));

  return (
    <ActHomeCard
      title={t('careCascade', 'Care cascade')}
      link={{ label: t('report', 'Report'), to: careCascade.reportUrl }}
    >
      {clinicName && (
        <p className={styles.caption}>
          {t('patientsEnrolledAt', 'Patients enrolled at {{clinic}}', { clinic: clinicName })}
        </p>
      )}
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadCareCascade', 'Could not load the care cascade')}
        />
      ) : isLoading ? (
        <div data-testid="cascade-loading">
          <SkeletonText paragraph lineCount={4} />
        </div>
      ) : steps.length ? (
        <>
          <div className={styles.steps}>
            {steps.map((row) => (
              <div key={row.step} data-testid="cascade-step" className={styles.step}>
                <span>{row.label}</span>
                <span className={styles.track}>
                  <span
                    data-testid="cascade-bar"
                    className={styles.bar}
                    style={{ width: `${largest ? Math.round((row.patients / largest) * 100) : 0}%` }}
                  />
                </span>
                <span className={styles.count}>{row.patients}</span>
              </div>
            ))}
          </div>
          <p className={styles.asOf}>
            {t('cascadeReportDate', 'Report date: {{date}}', {
              date: formatDate(today.toDate(), { time: false, noToday: true }),
            })}
          </p>
        </>
      ) : (
        <p className={styles.empty}>{t('noCareCascadeData', 'No care cascade data')}</p>
      )}
    </ActHomeCard>
  );
}

export default function CareCascade() {
  return <Cascade />;
}
