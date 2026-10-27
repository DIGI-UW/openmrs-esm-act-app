import React from 'react';
import { useTranslation } from 'react-i18next';
import useSWRImmutable from 'swr/immutable';
import { Button } from '@carbon/react';
import {
  EditIcon,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { usePrescription } from './prescription.resource';

/** Whether the user holds Add Encounters and the edit privilege of the encounter type that Update prophylaxis saves. */
function useMayUpdateProphylaxis() {
  const { user } = useSession();
  const { prophylaxisUpdate } = useConfig<Config>();
  const { data: encounterType } = useSWRImmutable(['act-encounter-type', prophylaxisUpdate.encounterType], () =>
    openmrsFetch<{ editPrivilege?: { display: string } | null }>(
      `${restBaseUrl}/encountertype/${prophylaxisUpdate.encounterType}?v=custom:(uuid,editPrivilege:(display))`,
    ).then((response) => response.data),
  );
  return (
    Boolean(user && encounterType) &&
    userHasAccess([PRIVILEGE_ADD_ENCOUNTERS, encounterType?.editPrivilege?.display].filter(Boolean), user!)
  );
}

/** Update prophylaxis, for a user who may record the update encounter: opens the workspace that changes or stops it. */
export default function UpdateProphylaxis({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisUpdate } = useConfig<Config>();
  const may = useMayUpdateProphylaxis();
  const { isLoading } = usePrescription(patientUuid, prophylaxisUpdate.concepts);

  if (!may) {
    return null;
  }
  return (
    <Button
      kind="ghost"
      size="sm"
      renderIcon={(props) => <EditIcon size={16} {...props} />}
      disabled={isLoading}
      onClick={() => launchWorkspace2('act-update-prophylaxis-workspace')}
    >
      {t('updateProphylaxis', 'Update prophylaxis')}
    </Button>
  );
}
