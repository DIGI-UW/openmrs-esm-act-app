import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

interface EncounterForm {
  uuid: string;
  form: { uuid: string } | null;
  obs: Array<{ concept: { uuid: string } }>;
}

/**
 * The listed patients with an oral encounter, or a BPG one with a Date of Injection, dated since local midnight, which
 * the report cannot tell as ACT Core rebuilds due dates overnight. A failure is not retried, as each retry resends all.
 */
export function useRecordedToday(patientUuids: Array<string>) {
  const { prophylaxisCard, prophylaxisPage } = useConfig<Config>();
  // Local midnight as a UTC instant, as a bare date is read on the server's clock.
  const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const forms = [prophylaxisCard.bpgForm, prophylaxisCard.oralForm];
  const injectionDate = prophylaxisPage.concepts.injectionDate;
  const recorded = (encounter: EncounterForm) =>
    encounter.form?.uuid === prophylaxisCard.oralForm ||
    (encounter.form?.uuid === prophylaxisCard.bpgForm && encounter.obs.some((o) => o.concept.uuid === injectionDate));
  const { data, isLoading, isValidating, error } = useSWR(
    patientUuids.length ? ['act-recorded-today', since, injectionDate, ...forms, ...patientUuids] : null,
    () =>
      Promise.all(
        patientUuids.map(async (patientUuid) => {
          const params = new URLSearchParams({
            patient: patientUuid,
            fromdate: since,
            v: 'custom:(uuid,form:(uuid),obs:(concept:(uuid)))',
          });
          const { data: page } = await openmrsFetch<{ results: Array<EncounterForm> }>(
            `${restBaseUrl}/encounter?${params}`,
          );
          return page.results.some(recorded) ? patientUuid : null;
        }),
      ),
    { shouldRetryOnError: false },
  );

  return { recorded: new Set((data ?? []).filter(Boolean)), isLoading, isValidating, error };
}
