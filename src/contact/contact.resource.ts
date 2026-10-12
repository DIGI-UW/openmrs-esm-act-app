import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

interface Attribute {
  attributeType: { uuid: string };
  value: string | { uuid?: string; display?: string };
}

interface Person {
  attributes: Array<Attribute>;
  preferredAddress: { cityVillage?: string | null } | null;
}

interface Place {
  display: string;
  tags: Array<{ display: string }>;
  parentLocation: Place | null;
}

const personRepresentation = 'custom:(attributes:(attributeType:(uuid),value),preferredAddress:(cityVillage))';
// Three levels reach a tertiary centre from a community clinic, through its district clinic.
const placeRepresentation =
  'custom:(display,tags:(display),parentLocation:(display,tags:(display),parentLocation:(display,tags:(display))))';

const text = (attribute: Attribute | undefined) =>
  attribute == null
    ? null
    : typeof attribute.value === 'object'
      ? (attribute.value?.display ?? null)
      : String(attribute.value);

/** The cardiac clinic itself when tagged a tertiary centre, else the nearest location above it that is. */
function tertiaryOf(place: Place | null | undefined, tag: string): string | null {
  for (let at = place; at; at = at.parentLocation) {
    if (at.tags?.some((t) => t.display === tag)) {
      return at.display;
    }
  }
  return null;
}

/** The patient's contact details and clinics, from their person attributes and preferred address. */
export function useContact(patientUuid: string) {
  const { contact } = useConfig<Config>();
  const { data, error, isLoading } = useSWR<FetchResponse<Person>, Error>(
    patientUuid ? `${restBaseUrl}/person/${patientUuid}?v=${personRepresentation}` : null,
    openmrsFetch,
  );
  const attributes = data?.data?.attributes ?? [];
  const first = (types: Array<string>) =>
    types.map((type) => attributes.find((attribute) => attribute.attributeType.uuid === type)).find(Boolean);
  const cardiac = first([contact.cardiacClinic]);
  const cardiacUuid = typeof cardiac?.value === 'object' ? cardiac.value?.uuid : null;
  const { data: place } = useSWR<FetchResponse<Place>, Error>(
    cardiacUuid ? `${restBaseUrl}/location/${cardiacUuid}?v=${placeRepresentation}` : null,
    openmrsFetch,
  );

  return {
    contact: data && {
      phone: text(first(contact.phone)),
      phoneOwner: text(first([contact.phoneOwner])),
      village: data.data.preferredAddress?.cityVillage || null,
      primaryCareClinic: text(first(contact.primaryCareClinic)),
      cardiacClinic: text(cardiac),
      tertiaryCentre: tertiaryOf(place?.data, contact.tertiaryTag),
    },
    error,
    isLoading,
  };
}
