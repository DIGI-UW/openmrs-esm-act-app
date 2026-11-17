import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCurrentPatient, launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { fetchForm } from './flag-gaps/flag-gaps.resource';
import { type ReportRow } from './reports/report-dataset.resource';

/**
 * Opens a report row's encounter to edit in `workspace`, beside the list, and calls `refresh` once its form saves.
 * The row needs patient_uuid, encounter_uuid and form_uuid.
 */
export function useOpenFormBesideList(workspace: string, refresh: () => unknown) {
  const { t } = useTranslation();
  // Not refresh itself: mutate(encounter) would store the saved encounter as the list's data.
  const handlePostResponse = useCallback(() => {
    refresh();
  }, [refresh]);
  // Same objects on a second click, so the open workspace does not prompt to close the form.
  const loaded = useRef(new Map<string, Promise<[Awaited<ReturnType<typeof fetchForm>>, fhir.Patient]>>());
  return async (row: ReportRow) => {
    const patientUuid = String(row.patient_uuid);
    const encounterUuid = String(row.encounter_uuid);
    if (!loaded.current.has(encounterUuid)) {
      loaded.current.set(
        encounterUuid,
        Promise.all([fetchForm(String(row.form_uuid)), fetchCurrentPatient(patientUuid)]),
      );
    }
    try {
      const [form, patient] = await loaded.current.get(encounterUuid);
      // An edit loads its own visit; the workspace calls handlePostResponse, not mutateVisitContext.
      await launchWorkspace2(
        workspace,
        { form, encounterUuid, handlePostResponse },
        { patient, patientUuid, visitContext: null },
      );
    } catch (e) {
      loaded.current.delete(encounterUuid);
      showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
    }
  };
}
