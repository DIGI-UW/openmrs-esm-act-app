import { type TFunction } from 'i18next';
import { openmrsFetch, restBaseUrl, saveVisit, showSnackbar, type Visit } from '@openmrs/esm-framework';

// What the chart's form entry reads of a visit context: its dates, location and type.
const visitRepresentation = 'custom:(uuid,startDatetime,stopDatetime,location:(uuid,display),visitType:(uuid,display))';

/** The patient's active visit, if any, from the server rather than from the patient chart. */
export async function findActiveVisit(patientUuid: string) {
  const { data } = await openmrsFetch<{ results: Array<Visit> }>(
    `${restBaseUrl}/visit?patient=${patientUuid}&includeInactive=false&v=${visitRepresentation}`,
  );
  return data.results[0] ?? null;
}

/** Starts a visit of the type so a form can be saved, and says so; a refusal is worded for the user. */
export async function startVisit(t: TFunction, patientUuid: string, visitType: string, location: string) {
  // A null start lets the server stamp it, so a fast client clock cannot put it in the future.
  const { data: visit } = await saveVisit(
    { patient: patientUuid, visitType, location, startDatetime: null },
    new AbortController(),
  ).catch((e) => {
    throw e?.response?.status === 403
      ? new Error(t('cannotStartVisit', 'You may not start a visit for this patient.'))
      : e;
  });
  showSnackbar({
    kind: 'success',
    title: t('visitStarted', '{{visitType}} started', { visitType: visit.visitType?.display }),
    subtitle: t('visitStartedForForm', 'Started automatically so the form can be saved'),
  });
  return visit as Visit;
}
