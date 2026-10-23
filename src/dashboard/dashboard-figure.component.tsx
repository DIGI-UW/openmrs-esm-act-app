import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ArrowLeft, Close } from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useReportDataset } from '../reports/report-dataset.resource';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import {
  type Figure,
  figureNames,
  figureParams,
  isWidened,
  patientsReport,
  rowUnit,
  useCountParams,
  widened,
} from './dashboard-figure';
import styles from './dashboard.scss';

type Scope = Record<string, string>;

/**
 * The patients, consultations or recommendations behind one of the Dashboard's figures, from the patients report that
 * shares its count report's SQL, so the rows equal the figure. Each chip removes one filter and widens the list.
 */
export function DashboardFigure({
  figure,
  scope,
  asOf,
  clinicNames,
  onFigure,
  onScope,
  onAsOf,
  onBack,
}: {
  figure: Figure;
  scope: Scope;
  asOf: string;
  clinicNames: { cardiac?: string; primaryCare?: string };
  onFigure: (figure: Figure) => void;
  onScope: (scope: Scope) => void;
  onAsOf: (asOf: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const today = dayjs().format('YYYY-MM-DD');
  const params = useMemo(() => ({ endDate: asOf, ...scope, ...figureParams(figure) }), [asOf, scope, figure]);
  const { counted, countParams, pending } = useCountParams(params);
  const report = useReportDataset(counted ? patientsReport(dashboard, figure.figure) : null, countParams);
  const { rows } = report;
  const names = figureNames(t, figure);
  const unit = rowUnit(figure);
  const count = rows.length;
  const units = {
    patient: t('patientsCount', '{{count}} patients', { count }),
    consultation: t('consultationsCount', '{{count}} consultations', { count }),
    recommendation: t('recommendationsCount', '{{count}} recommendations', { count }),
  };
  const dated = rows.some((row) => row.figure_date);
  const headers = [
    t('actId', 'ACT ID'),
    t('patient', 'Patient'),
    t('age', 'Age'),
    t('sex', 'Sex'),
    t('cardiacClinic', 'Cardiac clinic'),
    t('primaryCareClinic', 'Primary care clinic'),
    names.section,
    ...(dated ? [t('date', 'Date')] : []),
  ];
  const cells = (row: Record<string, unknown>) => [
    String(row.rhd_id ?? ''),
    String(row.full_name ?? ''),
    row.age_years === null || row.age_years === undefined ? '' : String(row.age_years),
    String(row.sex ?? ''),
    String(row.cardiac_clinic ?? ''),
    String(row.primary_care_clinic ?? ''),
    String(row.figure_value ?? ''),
    ...(dated ? [row.figure_date ? dayjs(String(row.figure_date)).format('DD/MM/YYYY') : ''] : []),
  ];

  const chip = (key: string, text: string, remove: () => void) => (
    <Button
      key={key}
      kind="tertiary"
      size="sm"
      renderIcon={Close}
      iconDescription={t('remove', 'Remove')}
      onClick={remove}
    >
      {text}
    </Button>
  );

  return (
    <div className={styles.figure}>
      <div className={styles.figureBanner}>
        <p>
          {t('openedFromTheDashboard', 'Opened from the Dashboard: {{figure}}, {{amount}}.', {
            figure: [names.section, names.label].filter(Boolean).join(', '),
            amount: units[unit],
            interpolation: { escapeValue: false },
          })}
        </p>
        <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={onBack}>
          {t('backToTheDashboard', 'Back to the Dashboard')}
        </Button>
      </div>
      <div className={styles.chips}>
        {!isWidened(figure) &&
          chip('figure', [names.section, names.label].filter(Boolean).join(': '), () => onFigure(widened(figure)))}
        {scope.cardiacClinic &&
          chip('cardiac', `${t('cardiacClinic', 'Cardiac clinic')}: ${clinicNames.cardiac ?? ''}`, () => {
            const { cardiacClinic: _, ...rest } = scope;
            onScope(rest);
          })}
        {scope.primaryCareClinic &&
          chip(
            'primaryCare',
            `${t('primaryCareClinic', 'Primary care clinic')}: ${clinicNames.primaryCare ?? ''}`,
            () => {
              const { primaryCareClinic: _, ...rest } = scope;
              onScope(rest);
            },
          )}
        {asOf !== today &&
          chip(
            'asOf',
            t('asOfDate', 'As of {{date}}', {
              date: dayjs(asOf).format('DD/MM/YYYY'),
              interpolation: { escapeValue: false },
            }),
            () => onAsOf(today),
          )}
      </div>
      {report.error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadFigure', 'Could not load the patients behind this figure')}
        />
      ) : report.isLoading || pending ? (
        <SkeletonText paragraph lineCount={6} />
      ) : (
        <>
          <div className={styles.tableContainer}>
            <Table size="sm" aria-label={names.section}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header}>{header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={`${row.patient_uuid}-${index}`} data-testid="dashboard-figure-row">
                    {cells(row).map((cell, column) => (
                      <TableCell key={headers[column]}>
                        {column === 1 ? (
                          <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{cell}</ConfigurableLink>
                        ) : (
                          cell
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DownloadCsvButton
            name={`dashboard-${figure.figure}`}
            list={`dashboard:${figure.figure}`}
            identifiers
            filters={countParams}
            headers={headers}
            rows={() => rows.map(cells)}
            disabled={!rows.length}
          />
        </>
      )}
    </div>
  );
}
