import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { PRIVILEGE_SCREEN_POSITIVE } from '../constants';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { ScreenPositiveTable } from '../screen-positive/screen-positive.component';
import { Worklist, type WorklistState, WorklistSection, WorklistTable } from './worklist.component';

/**
 * The patients who screened positive and are waiting for a confirmatory echo. A user who has Confirmatory echo due
 * gets its table here, with its filters and Enter diagnosis; anyone else sees the worklist's own columns.
 */
export default function ConfirmatoryEchoWorklist(state: WorklistState) {
  const { t } = useTranslation();
  const { user } = useSession();
  const hasPage = Boolean(user) && userHasAccess(PRIVILEGE_SCREEN_POSITIVE, user);
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
        hasPage ? (
          <WorklistSection title={title}>
            <ScreenPositiveTable />
          </WorklistSection>
        ) : (
          <WorklistTable
            title={title}
            csvName="confirmatory-echo-due"
            entries={entries}
            isLoading={isLoading}
            error={error}
          />
        )
      }
    />
  );
}
