import { fetchForm } from './flag-gaps.resource';
import { focusFormQuestion } from './focus-question';

/**
 * Opens a saved encounter for editing in the patient chart's form entry workspace, through the given launcher,
 * and when a concept is given, at the question that records it.
 */
export async function openEncounterForm(
  launch: (workspaceName: string, props: object) => unknown,
  formUuid: string,
  encounterUuid: string,
  focusConcept?: string,
) {
  const form = await fetchForm(formUuid);
  await launch('patient-form-entry-workspace', { form, encounterUuid });
  if (focusConcept) {
    // The form is open by now; not finding its question leaves it at the top, as it opened before.
    focusFormQuestion(form, focusConcept).catch(() => undefined);
  }
}
