import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Button } from '@carbon/react';
import {
  closeWorkspaceGroup2,
  ConfigurableLink,
  fetchCurrentPatient,
  launchWorkspace2,
  showSnackbar,
  useConfig,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { patientChartUrl } from '../patient-chart-url';
import { type ReportRow } from '../reports/report-dataset.resource';
import { findActiveVisit, startVisit } from '../visits/start-visit';
import { isOral } from './due-list';
import styles from './due-for-prophylaxis.scss';

const recordDoseFormEntryWorkspace = 'act-record-dose-form-entry-workspace';

/** A promise kept for reuse, dropped if it fails, so the next click asks again. */
function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  if (!cache.has(key)) {
    cache.set(
      key,
      load().catch((e) => {
        cache.delete(key);
        throw e;
      }),
    );
  }
  return cache.get(key);
}

/**
 * Opens a due row's dose form beside the list, one at a time, as a second click while a visit starts would start a second.
 * Called by what stays mounted while the panel is open, not by the table, which an empty filter or search unmounts and
 * whose caches would go with it.
 */
export function useRecordDose() {
  const { t } = useTranslation();
  const { visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { mutate } = useSWRConfig();
  const [opening, setOpening] = useState(false);
  // Ignores the saved encounter the workspace passes, which mutate would store as a report's rows.
  const refresh = useCallback(() => {
    mutate((key) => Array.isArray(key) && key[0] === 'rhd-report-dataset');
  }, [mutate]);
  // Same objects on a second click, so the open workspace does not prompt to close the form.
  const forms = useRef(new Map<string, ReturnType<typeof fetchForm>>());
  const patients = useRef(new Map<string, Promise<fhir.Patient>>());
  // Reused only while it is still the patient's active visit, as a visit can be ended.
  const visits = useRef(new Map<string, Visit>());

  const record = async (row: ReportRow, formUuid: string) => {
    const patientUuid = String(row.patient_uuid);
    setOpening(true);
    try {
      const [form, patient, active] = await Promise.all([
        cached(forms.current, formUuid, () => fetchForm(formUuid)),
        cached(patients.current, patientUuid, () => fetchCurrentPatient(patientUuid)),
        findActiveVisit(patientUuid),
      ]);
      const previous = visits.current.get(patientUuid);
      let visit = active && previous?.uuid === active.uuid ? previous : active;
      if (!visit) {
        // Asked first, so no visit is started for a form the user then chooses not to open.
        if (!(await closeWorkspaceGroup2())) {
          return;
        }
        visit = await startVisit(t, patientUuid, visitType, sessionLocation?.uuid);
      }
      visits.current.set(patientUuid, visit);
      await launchWorkspace2(
        recordDoseFormEntryWorkspace,
        { form, encounterUuid: '', handlePostResponse: refresh },
        { patient, patientUuid, visitContext: visit },
      );
    } catch (e) {
      showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
    } finally {
      setOpening(false);
    }
  };
  return { opening, record };
}

export type RecordDose = ReturnType<typeof useRecordDose>;

/** A due row's Record BPG or Record oral, View chart once recorded today, or Needs prescription without one. */
export function RecordDoseAction({
  row,
  recordedToday,
  disabled,
  onRecord,
}: {
  row: ReportRow;
  recordedToday: boolean;
  disabled?: boolean;
  onRecord: (row: ReportRow, formUuid: string) => void;
}) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  if (row.status === 'no_prescription') {
    return <span className={styles.needsPrescription}>{t('needsPrescription', 'Needs prescription')}</span>;
  }
  if (recordedToday) {
    return <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{t('viewChart', 'View chart')}</ConfigurableLink>;
  }
  const oral = isOral(row);
  const form = oral ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm;
  return (
    <MayEnterForm formUuid={form}>
      <Button
        className={styles.recordDose}
        kind="primary"
        size="sm"
        disabled={disabled}
        onClick={() => onRecord(row, form)}
      >
        {oral ? t('recordOral', 'Record oral') : t('recordBpg', 'Record BPG')}
      </Button>
    </MayEnterForm>
  );
}
