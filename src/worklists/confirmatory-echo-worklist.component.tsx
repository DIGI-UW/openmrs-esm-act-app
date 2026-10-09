import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { Worklist, type WorklistState, WorklistTable } from './worklist.component';

/** The patients who screened positive and are waiting for a confirmatory echo. */
export default function ConfirmatoryEchoWorklist(state: WorklistState) {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(screenPositive.report);
  const title = t('confirmatoryEchoDue', 'Confirmatory echo due');
  const entries = rows.map((row) => {
    const screened = parseReportDate(row.screen_date);
    return {
      row,
      why: screened
        ? t('screenedPositiveOn', 'Screened positive · {{date}}', {
            date: formatDate(screened, { time: false, noToday: true }),
          })
        : t('screenedPositive', 'Screened positive'),
    };
  });
  return (
    <Worklist
      state={state}
      title={title}
      tone="orange"
      count={isLoading ? undefined : rows.length}
      error={error}
      list={
        <WorklistTable
          title={title}
          csvName="confirmatory-echo-due"
          entries={entries}
          isLoading={isLoading}
          error={error}
        />
      }
    />
  );
}
