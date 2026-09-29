import { fetchForm } from './flag-gaps.resource';

/** Opens a saved encounter for editing in the patient chart's form entry workspace, through the given launcher. */
export async function openEncounterForm(
  launch: (workspaceName: string, props: object) => unknown,
  formUuid: string,
  encounterUuid: string,
) {
  const form = await fetchForm(formUuid);
  await launch('patient-form-entry-workspace', { form, encounterUuid });
}
