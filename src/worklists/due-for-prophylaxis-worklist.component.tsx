import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { dueReason, prescription } from '../due-for-prophylaxis/due-list';
import { useDueList } from '../due-for-prophylaxis/due-for-prophylaxis.resource';
import { RecordDoseAction, useRecordDose } from '../due-for-prophylaxis/record-dose.component';
import { useReportDataset } from '../reports/report-dataset.resource';
import { Worklist, type WorklistState, WorklistTable } from './worklist.component';

function DuePatients({ title }: { title: string }) {
  const { t } = useTranslation();
  const { rows, recorded, checking, isLoading, error } = useDueList();
  const { opening, record } = useRecordDose();
  const entries = rows.map((row) => ({
    row,
    prophylaxis: prescription(t, row),
    why: dueReason(t, row, recorded.has(String(row.patient_uuid))),
  }));
  return (
    <WorklistTable
      title={title}
      csvName="due-for-prophylaxis"
      entries={entries}
      isLoading={isLoading}
      error={error}
      action={({ row }) => (
        <RecordDoseAction
          row={row}
          recordedToday={recorded.has(String(row.patient_uuid))}
          disabled={opening || checking}
          onRecord={record}
        />
      )}
    />
  );
}

/** The patients whose prophylaxis is due in the next 48 hours, due today or overdue. */
export default function DueForProphylaxisWorklist(state: WorklistState) {
  const { t } = useTranslation();
  const { dueForProphylaxis } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(dueForProphylaxis.report);
  const title = t('dueForProphylaxis', 'Due for prophylaxis');
  return (
    <Worklist
      state={state}
      title={title}
      tone="red"
      count={isLoading ? undefined : rows.length}
      error={error}
      list={<DuePatients title={title} />}
    />
  );
}
