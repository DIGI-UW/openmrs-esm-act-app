import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

interface EncounterForm {
  uuid: string;
  form: { uuid: string } | null;
}

/**
 * The listed patients with a BPG or oral prophylaxis form saved since local midnight. The report cannot tell, as
 * ACT Core rebuilds its due dates overnight.
 */
export function useRecordedToday(patientUuids: Array<string>) {
  const { prophylaxisCard } = useConfig<Config>();
  // Local midnight with its offset, as a bare date is read on the server's clock.
  const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const forms = [prophylaxisCard.bpgForm, prophylaxisCard.oralForm];
  const { data, isLoading } = useSWR(
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
  );

  return { recorded: new Set((data ?? []).filter(Boolean)), isLoading };
}
