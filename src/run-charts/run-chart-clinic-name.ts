import { useTranslation } from 'react-i18next';
import { useSession } from '@openmrs/esm-framework';
import { type Clinic } from '../programme-report/clinics.resource';

/**
 * The name of the clinic charted, 'All clinics' only for none. While the clinics load, or when theirs is not in
 * the list, it is the session's location, else the uuid, never 'All clinics'.
 */
export function useClinicName(clinics: Array<Clinic>, uuid: string) {
  const { t } = useTranslation();
  const { sessionLocation } = useSession();
  if (!uuid) {
    return t('allClinics', 'All clinics');
  }
  return (
    clinics.find((clinic) => clinic.uuid === uuid)?.display ??
    (uuid === sessionLocation?.uuid ? sessionLocation.display : uuid)
  );
}
