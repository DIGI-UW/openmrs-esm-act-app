import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

interface FoundPatient {
  uuid: string;
  identifiers: Array<{ identifier: string; identifierType: { uuid: string } }>;
}

/** The patient whose ACT ID is the one typed or scanned, ignoring case, as the identifier search also matches other types. */
export async function findPatientByActId(actId: string, actIdentifierType: string) {
  const typed = actId.trim().toLowerCase();
  const { data } = await openmrsFetch<{ results: Array<FoundPatient> }>(
    `${restBaseUrl}/patient?identifier=${encodeURIComponent(actId.trim())}&v=custom:(uuid,identifiers:(identifier,identifierType:(uuid)))`,
  );
  return data.results.find(({ identifiers }) =>
    identifiers.some(
      ({ identifier, identifierType }) =>
        identifierType.uuid === actIdentifierType && identifier.toLowerCase() === typed,
    ),
  )?.uuid;
}
