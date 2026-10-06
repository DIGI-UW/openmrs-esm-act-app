import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

interface EncounterForm {
  uuid: string;
  form: { uuid: string } | null;
}

/**
 * The listed patients with a BPG or oral prophylaxis encounter dated since local midnight. The report cannot tell, as
 * ACT Core rebuilds its due dates overnight. A failure is not retried, as each retry sends every lookup again.
 */
export function useRecordedToday(patientUuids: Array<string>) {
  const { prophylaxisCard } = useConfig<Config>();
  // Local midnight as a UTC instant, as a bare date is read on the server's clock.
  const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const forms = [prophylaxisCard.bpgForm, prophylaxisCard.oralForm];
  const { data, isLoading, isValidating, error } = useSWR(
    patientUuids.length ? ['act-recorded-today', since, ...forms, ...patientUuids] : null,
    () =>
      Promise.all(
        patientUuids.map(async (patientUuid) => {
          const params = new URLSearchParams({ patient: patientUuid, fromdate: since, v: 'custom:(uuid,form:(uuid))' });
          const { data: page } = await openmrsFetch<{ results: Array<EncounterForm> }>(
            `${restBaseUrl}/encounter?${params}`,
          );
          return page.results.some((encounter) => forms.includes(encounter.form?.uuid)) ? patientUuid : null;
        }),
      ),
    { shouldRetryOnError: false },
  );

  return { recorded: new Set((data ?? []).filter(Boolean)), isLoading, isValidating, error };
}
