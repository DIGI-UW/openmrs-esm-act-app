import { launchWorkspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';

export const patientSearchWorkspace = 'act-patient-search-workspace';

/** Opens O3's patient search beside the page; picking a patient closes it and hands their uuid to onPick. */
export function launchPatientSearch(workspaceTitle: string, onPick: (patientUuid: string) => void) {
  return launchWorkspace2(
    patientSearchWorkspace,
    {
      workspaceTitle,
      async onPatientSelected(
        patientUuid: string,
        _patient: fhir.Patient,
        _launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'],
        closeWorkspace: Workspace2DefinitionProps['closeWorkspace'],
      ) {
        if (await closeWorkspace()) {
          onPick(patientUuid);
        }
      },
    },
    { startVisitWorkspaceName: 'act-patient-search-start-visit-workspace' },
  );
}
