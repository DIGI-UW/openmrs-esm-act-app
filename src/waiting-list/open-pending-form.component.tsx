import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getGlobalStore, launchWorkspace2, showSnackbar, useStore } from '@openmrs/esm-framework';
import { openEncounterForm } from '../flag-gaps/open-encounter-form';
import { takePendingForm } from './pending-form';

interface WorkspaceGroupState {
  openedGroup: { groupName: string; props: Record<string, unknown> | null } | null;
}

/**
 * Opens the encounter a waiting list row asked for, once the chart has opened its workspace group for the
 * patient: the form workspace needs that group's props, and launching sooner would open the group without them.
 */
export default function OpenPendingForm() {
  const { t } = useTranslation();
  const openedGroup = useStore(
    getGlobalStore<WorkspaceGroupState>('workspace2', { openedGroup: null }),
    (state) => state.openedGroup,
  );
  const chartPatient = openedGroup?.groupName === 'patient-chart' ? openedGroup.props?.patientUuid : undefined;

  useEffect(() => {
    const pending = typeof chartPatient === 'string' ? takePendingForm(chartPatient) : null;
    if (!pending) {
      return;
    }
    openEncounterForm(launchWorkspace2, pending.formUuid, pending.encounterUuid).catch((e) =>
      showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message }),
    );
  }, [chartPatient, t]);

  return null;
}
