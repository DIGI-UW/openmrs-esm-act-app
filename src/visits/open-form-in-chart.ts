import { type TFunction } from 'i18next';
import { getGlobalStore, launchWorkspace2, navigate, showSnackbar } from '@openmrs/esm-framework';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { patientChartUrl } from '../patient-chart-url';
import { findActiveVisit, startVisit } from './start-visit';
import { visitWaitMs } from './open-form-in-visit';

interface Workspace2Store {
  openedGroup?: { groupName: string; props?: { patientUuid?: string; visitContext?: { uuid?: string } | null } } | null;
}

const workspaceStore = () => getGlobalStore<Workspace2Store>('workspace2', {});

const chartHas = (state: Workspace2Store, patientUuid: string, visitUuid: string) =>
  state.openedGroup?.groupName === 'patient-chart' &&
  state.openedGroup.props?.patientUuid === patientUuid &&
  state.openedGroup.props?.visitContext?.uuid === visitUuid;

/**
 * Resolves opened once the chart's workspace group has the patient and the visit, as a form launched earlier is lost;
 * left if the user goes elsewhere, late after visitWaitMs.
 */
function chartOpens(patientUuid: string, visitUuid: string) {
  return new Promise<'opened' | 'left' | 'late'>((resolve) => {
    const done = (outcome: 'opened' | 'left' | 'late') => {
      unsubscribe();
      window.removeEventListener('single-spa:routing-event', onRoute);
      clearTimeout(timer);
      resolve(outcome);
    };
    const onRoute = () => !window.location.pathname.includes(`/patient/${patientUuid}/chart`) && done('left');
    const unsubscribe = workspaceStore().subscribe(
      (state) => chartHas(state, patientUuid, visitUuid) && done('opened'),
    );
    window.addEventListener('single-spa:routing-event', onRoute);
    const timer = setTimeout(() => done('late'), visitWaitMs);
    if (chartHas(workspaceStore().getState(), patientUuid, visitUuid)) {
      done('opened');
    }
  });
}

/**
 * Opens a form in the patient's chart from outside it: finds or starts their visit, opens the chart's summary,
 * and opens the form there once the chart has taken the visit.
 */
export async function openFormInChart(
  t: TFunction,
  {
    patientUuid,
    formUuid,
    visitType,
    location,
  }: { patientUuid: string; formUuid: string; visitType: string; location: string },
) {
  try {
    const form = await fetchForm(formUuid);
    const active = await findActiveVisit(patientUuid);
    const visit = active ?? (await startVisit(t, patientUuid, visitType, location));
    navigate({ to: `${patientChartUrl(patientUuid)}/Patient Summary` });
    const outcome = await chartOpens(patientUuid, visit.uuid);
    if (outcome === 'left') {
      return;
    }
    if (outcome === 'late') {
      showSnackbar({
        kind: 'error',
        title: t('couldNotOpenForm', 'Could not open the form'),
        subtitle: active
          ? t('openFormFromClinicalForms', 'Open the form from Clinical forms.')
          : t('openFromClinicalForms', 'The visit has started. Open the form from Clinical forms.'),
      });
      return;
    }
    launchWorkspace2('patient-form-entry-workspace', {
      workspaceTitle: form.display,
      form,
      encounterUuid: '',
      additionalProps: { mode: 'enter', openClinicalFormsWorkspaceOnFormClose: false },
    });
  } catch (e) {
    showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
  }
}
