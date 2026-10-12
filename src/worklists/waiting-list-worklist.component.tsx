import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { bothClinics, useSessionClinicRows } from '../registry/registry.resource';
import { useReportDataset } from '../reports/report-dataset.resource';
import { WaitingListTable } from '../waiting-list/waiting-list.component';
import { Worklist, type WorklistState, WorklistSection } from './worklist.component';

/** The patients waiting for a procedure, shown as the Procedural waiting list shows them, with its filters and ranking. */
export default function WaitingListWorklist(state: WorklistState) {
  const { t } = useTranslation();
  const { waitingList } = useConfig<Config>();
  const report = useReportDataset(waitingList.report);
  const { rows, isLoading: scoping } = useSessionClinicRows(report.rows, bothClinics);
  const isLoading = report.isLoading || scoping;
  const error = report.error;
  const title = t('proceduralWaitingList', 'Procedural waiting list');
  return (
    <Worklist
      state={state}
      title={title}
      tone="red"
      count={isLoading ? undefined : rows.length}
      error={error}
      list={
        <WorklistSection title={title}>
          <WaitingListTable />
        </WorklistSection>
      }
    />
  );
}
