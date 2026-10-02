import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

interface Person {
  attributes: Array<{ attributeType: { uuid: string }; value: unknown }>;
  preferredAddress: { cityVillage: string | null } | null;
}

export function useContact(patientUuid: string) {
  const { contactCard } = useConfig<Config>();
  const url = `${restBaseUrl}/person/${patientUuid}?v=custom:(attributes:(attributeType:(uuid),value),preferredAddress:(cityVillage))`;
  const { data, error } = useSWR<Person, Error>(url, async () => (await openmrsFetch<Person>(url)).data);
  // A Location attribute comes back as its location, the others as their text.
  const attribute = (type: string) => {
    const value = data?.attributes.find((a) => a.attributeType.uuid === type)?.value;
    return value == null ? null : typeof value === 'object' ? (value as { display: string }).display : String(value);
  };
  const contact = data && {
    phone: attribute(contactCard.phoneAttributeType),
    phoneOwner: contactCard.phoneOwnerAttributeTypes.map(attribute).find((value) => value) ?? null,
    village: data.preferredAddress?.cityVillage ?? null,
    primaryClinic: attribute(contactCard.primaryClinicAttributeType),
  };
  return { contact, error };
}
