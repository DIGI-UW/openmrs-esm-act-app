import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** A step from ACT Core's GET /actcore/nextsteps; form is null for a step no form records, such as a referral. */
export interface NextStep {
  key: string;
  form: string | null;
  title: string;
  reason: string;
  isNew: boolean;
  done: boolean;
}

export function useNextSteps(patientUuid: string) {
  const { data, error, isLoading } = useSWR<FetchResponse<{ steps: Array<NextStep> }>, Error>(
    // Keyed under the patient's /encounter, which common-lib's invalidatePatientEncounters revalidates on every save.
    patientUuid ? `${restBaseUrl}/encounter?patient=${patientUuid}&for=actcore-nextsteps` : null,
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

/** The published forms, with the edit privilege each one's encounter type needs. */
export function usePublishedForms(enabled: boolean) {
  const url = `${restBaseUrl}/form?v=custom:(uuid,published,retired,encounterType:(editPrivilege:(display)))`;
  const { data } = useSWR<FetchResponse<{ results: Array<ListedForm> }>, Error>(enabled ? url : null, openmrsFetch, {
    shouldRetryOnError: false,
  });
  return (data?.data?.results ?? []).filter((form) => form.published && !form.retired);
}
