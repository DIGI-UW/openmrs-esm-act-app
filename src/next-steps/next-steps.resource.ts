import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/**
 * A step from ACT Core's GET /actcore/nextsteps; form is null for a step no form records, such as a referral, or
 * for a dose on hold.
 */
export interface NextStep {
  key: string;
  form: string | null;
  title: string;
  reason: string;
  isNew: boolean;
  done: boolean;
  /** A BPG step held back after an anaphylaxis no consultation has reviewed yet; its reason says so. */
  onHold?: boolean;
  /** For a referral, the encounter type that records it; null when ACT Core has none mapped, so it cannot be sent. */
  referralType?: string | null;
}

/** The held BPG step among the patient's next steps, if ACT Core holds one. */
export function heldBpgStep(steps: Array<NextStep> | undefined) {
  return steps?.find((step) => step.key === 'bpg' && step.onHold) ?? null;
}

/** Keyed under the patient's /encounter, which common-lib's invalidatePatientEncounters revalidates on every save. */
export const nextStepsKey = (patientUuid: string) =>
  `${restBaseUrl}/encounter?patient=${patientUuid}&for=actcore-nextsteps`;

export function useNextSteps(patientUuid: string) {
  const { data, error, isLoading } = useSWR<FetchResponse<{ steps: Array<NextStep> }>, Error>(
    patientUuid ? nextStepsKey(patientUuid) : null,
    () => openmrsFetch<{ steps: Array<NextStep> }>(`${restBaseUrl}/actcore/nextsteps?patient=${patientUuid}`),
    { shouldRetryOnError: false },
  );
  return { steps: data?.data?.steps, error, isLoading };
}

interface ListedForm {
  uuid: string;
  published: boolean;
  retired: boolean;
  encounterType: { editPrivilege: { display: string } | null } | null;
}

/**
 * The published forms the patient chart's forms list offers the patient, with the edit privilege each one's
 * encounter type needs. ACT Core's patient search leaves out forms that don't apply, such as RHD Pregnancy for a man.
 */
export function usePublishedForms(patientUuid: string, enabled: boolean) {
  const url = `${restBaseUrl}/form?patient=${patientUuid}&v=custom:(uuid,published,retired,encounterType:(editPrivilege:(display)))`;
  const { data } = useSWR<FetchResponse<{ results: Array<ListedForm> }>, Error>(enabled ? url : null, openmrsFetch, {
    shouldRetryOnError: false,
  });
  return (data?.data?.results ?? []).filter((form) => form.published && !form.retired);
}
