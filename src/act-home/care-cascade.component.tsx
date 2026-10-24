import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useProgrammeScope } from '../programme-report/programme-scope';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useSessionClinicScope } from '../session-clinic';
import { ActHomeCard } from './act-home-card.component';
import { cascadeSteps } from './care-cascade-steps';
import styles from './care-cascade.scss';

/**
 * The care cascade as of today at one clinic scope, the report's clinic parameters; `null` while the scope is not
 * known, when nothing is evaluated. ACT home and Reports draw it alike, so they count alike.
 */
export function CareCascadeCard({
  scope,
  scopeError,
  clinicName,
  link,
}: {
  scope: Record<string, string> | null;
  scopeError?: boolean;
  clinicName?: string;
  link?: { label: string; to: string };
}) {
  const { t } = useTranslation();
  const { careCascade } = useConfig<Config>();
  // Send a plain date: the server runs on UTC, so a local-midnight timestamp east of UTC lands on yesterday.
  const today = useMemo(() => dayjs().startOf('day'), []);
  const { cardiacClinic, primaryCareClinic } = scope ?? {};
  const params = useMemo(
    () => ({
      endDate: today.format('YYYY-MM-DD'),
      ...(cardiacClinic && { cardiacClinic }),
      ...(primaryCareClinic && { primaryCareClinic }),
    }),
    [today, cardiacClinic, primaryCareClinic],
  );
  const report = useReportDataset(scope ? careCascade.report : null, params);
  const { rows } = report;
  const error = report.error ?? (scopeError ? new Error('The session location could not be read') : undefined);
  const isLoading = report.isLoading || (!scope && !scopeError);
  const steps = cascadeSteps(rows, careCascade.steps).map(({ step, label, value }) => ({
    step,
    label,
    patients: value,
  }));
  const largest = Math.max(0, ...steps.map((row) => row.patients));

  return (
    <ActHomeCard title={t('careCascade', 'Care cascade')} link={link}>
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
                <span>{t(row.label)}</span>
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

function Cascade() {
  const { t } = useTranslation();
  const { careCascade } = useConfig<Config>();
  // The session's clinic, as Reports counts it.
  const scope = useProgrammeScope(false);
  const clinic = useSessionClinicScope();
  return (
    <CareCascadeCard
      scope={scope.status === 'ready' ? scope.params : null}
      scopeError={scope.status === 'error'}
      clinicName={clinic.status === 'ready' ? clinic.clinic?.name : undefined}
      link={{ label: t('report', 'Report'), to: careCascade.reportUrl }}
    />
  );
}

export default function CareCascade() {
  return <Cascade />;
}
