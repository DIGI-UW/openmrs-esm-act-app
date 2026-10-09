import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { labelUrgencies, rankWaitingRows } from '../waiting-list/urgency';
import { Worklist, type WorklistState, WorklistTable } from './worklist.component';

/** The patients waiting for a procedure, most urgent first, as the Procedural waiting list ranks them. */
export default function WaitingListWorklist(state: WorklistState) {
  const { t } = useTranslation();
  const { waitingList, urgencyBands } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(waitingList.report);
  const title = t('proceduralWaitingList', 'Procedural waiting list');
  const entries = useMemo(
    () =>
      rankWaitingRows(labelUrgencies(rows, urgencyBands, 'shortLabel'), urgencyBands).map(({ row }) => ({
        row,
        why: [row.procedure_name, row.urgency].filter(Boolean).join(' · '),
      })),
    [rows, urgencyBands],
  );
  return (
    <Worklist
      state={state}
      title={title}
      tone="red"
      count={isLoading ? undefined : rows.length}
      error={error}
      list={
        <WorklistTable
          title={title}
          csvName="procedural-waiting-list"
          entries={entries}
          isLoading={isLoading}
          error={error}
        />
      }
    />
  );
}
