import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getGlobalStore,
  launchWorkspace2,
  saveVisit,
  showSnackbar,
  useConfig,
  useSession,
  useVisit,
  type Visit,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';

/** How long to wait for the patient chart to take a visit just started, before giving up on the form. */
export const visitWaitMs = 10000;

interface PatientChartStore {
  visitContext?: Visit | null;
  workspaceGroupVisitUuid?: string | null;
}

// The patient chart's store; its useStartVisitIfNeeded reads visitContext and workspaceGroupVisitUuid the same way.
const chartStore = () => getGlobalStore<PatientChartStore>('patient-chart-global-store', {});

/** Resolves true once the chart has relaunched its workspace group with the visit, or false after visitWaitMs. */
function chartTakes(visitUuid: string) {
  return new Promise<boolean>((resolve) => {
    const done = (taken: boolean) => {
      unsubscribe();
      clearTimeout(timer);
      resolve(taken);
    };
    const unsubscribe = chartStore().subscribe((state) => state.workspaceGroupVisitUuid === visitUuid && done(true));
    const timer = setTimeout(() => done(false), visitWaitMs);
    // A revalidation already in flight can relaunch the chart with the visit before this subscribes.
    if (chartStore().getState().workspaceGroupVisitUuid === visitUuid) {
      done(true);
    }
  });
}

/**
 * Opens a form in the patient chart's form entry workspace, first starting a visit when the patient has none.
 * Inside the patient chart only, as it waits for the chart's workspace group to take the new visit.
 */
export function useOpenFormInVisit(patientUuid: string) {
  const { t } = useTranslation();
  const { visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { activeVisit, isLoading, mutate } = useVisit(patientUuid);
  const forms = useRef(new Map<string, ReturnType<typeof fetchForm>>());
  const [isOpening, setIsOpening] = useState(false);
  const opening = useRef(false);

  const open = useCallback(
    async (formUuid: string) => {
      // A second click while a visit is starting would start a second visit.
      if (opening.current) {
        return;
      }
      opening.current = true;
      setIsOpening(true);
      const { visitContext } = chartStore().getState();
      const hasVisit = visitContext?.patient?.uuid === patientUuid || Boolean(activeVisit);
      try {
        // Reused, as new form props for an open form make the workspace ask to close it.
        if (!forms.current.has(formUuid)) {
          forms.current.set(formUuid, fetchForm(formUuid));
        }
        const form = await forms.current.get(formUuid).catch((e) => {
          forms.current.delete(formUuid);
          throw e;
        });
        if (!hasVisit) {
          // A null start lets the server stamp it, so a fast client clock cannot put it in the future.
          const { data: visit } = await saveVisit(
            { patient: patientUuid, visitType, location: sessionLocation?.uuid, startDatetime: null },
            new AbortController(),
          ).catch((e) => {
            throw e?.response?.status === 403
              ? new Error(t('cannotStartVisit', 'You may not start a visit for this patient.'))
              : e;
          });
          mutate();
          showSnackbar({
            kind: 'success',
            title: t('visitStarted', '{{visitType}} started', { visitType: visit.visitType?.display }),
            subtitle: t('visitStartedForForm', 'Started automatically so the form can be saved'),
          });
          if (!(await chartTakes(visit.uuid))) {
            showSnackbar({
              kind: 'error',
              title: t('couldNotOpenForm', 'Could not open the form'),
              subtitle: t('openFromClinicalForms', 'The visit has started. Open the form from Clinical forms.'),
            });
            return;
          }
        }
        launchWorkspace2('patient-form-entry-workspace', {
          workspaceTitle: form.display,
          form,
          encounterUuid: '',
          additionalProps: { mode: 'enter', openClinicalFormsWorkspaceOnFormClose: false },
        });
      } catch (e) {
        showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
      } finally {
        opening.current = false;
        setIsOpening(false);
      }
    },
    [activeVisit, mutate, patientUuid, sessionLocation?.uuid, t, visitType],
  );

  return { open, isOpening: isOpening || isLoading };
}
