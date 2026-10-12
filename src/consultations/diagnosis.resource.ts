import useSWR from 'swr';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';
import { type PatientEncounter, patientEncountersUrl } from '../patient-encounters';
import { display, groupsOf, memberValue } from './consultations.resource';

const representation =
  'custom:(uuid,encounterDatetime,obs:(concept:(uuid),value:(uuid,display),groupMembers:(concept:(uuid),value:(uuid,display))))';

const uuidOf = (value: unknown) => (value as { uuid?: string } | null)?.uuid;

/**
 * The patient's active primary diagnosis from Patient Information, newest first, as the screen positive and registry
 * reports pick it: its details (RHD C/RHD D and so on), else its category. Null when none is recorded.
 */
export function useDiagnosis(patientUuid: string | null) {
  const { diagnosis: config } = useConfig<Config>();
  const { concepts } = config;
  const url = patientUuid ? patientEncountersUrl(patientUuid, config.encounterType, representation) : null;
  const { data, error, isLoading } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));

  const latestFirst = [...(data ?? [])].sort((a, b) => b.encounterDatetime.localeCompare(a.encounterDatetime));
  const current = latestFirst
    .flatMap((encounter) => groupsOf(encounter, concepts.diagnosis))
    .find(
      (members) =>
        memberValue(members, concepts.category) != null &&
        uuidOf(memberValue(members, concepts.active)) !== config.no &&
        uuidOf(memberValue(members, concepts.priority)) !== config.secondary,
    );
  const details = current
    ?.filter((member) => config.details.includes(member.concept.uuid))
    .map((member) => display(member.value));
  const diagnosis = current ? details.join(', ') || display(memberValue(current, concepts.category)) : null;
  return { diagnosis, error, isLoading };
}
