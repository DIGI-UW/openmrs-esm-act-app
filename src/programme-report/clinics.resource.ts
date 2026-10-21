import useSWR from 'swr';
import { restBaseUrl } from '@openmrs/esm-framework';
import { useClinicLimit } from '../clinic-limit';
import { fetchAll } from '../fetch-all';

export interface Clinic {
  uuid: string;
  display: string;
}

/**
 * The locations carrying any of the tags, by name, for a clinic filter; for an administrator limited to their
 * clinics, only those.
 */
export function useClinics(tags: Array<string>) {
  const limit = useClinicLimit();
  const { data } = useSWR(['act-clinics', ...tags], async () => {
    const lists = await Promise.all(
      tags.map((tag) =>
        fetchAll<Clinic>(`${restBaseUrl}/location?tag=${encodeURIComponent(tag)}&v=custom:(uuid,display)`),
      ),
    );
    const byUuid = new Map(lists.flat().map((clinic) => [clinic.uuid, clinic]));
    return [...byUuid.values()].sort((a, b) => a.display.localeCompare(b.display));
  });
  if (limit.status === 'pending') {
    return [];
  }
  return limit.status === 'ready' ? (data ?? []).filter((clinic) => limit.uuids.includes(clinic.uuid)) : (data ?? []);
}
