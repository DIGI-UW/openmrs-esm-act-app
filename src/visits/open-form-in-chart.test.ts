import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import {
  getGlobalStore,
  launchWorkspace2,
  navigate,
  openmrsFetch,
  saveVisit,
  showSnackbar,
} from '@openmrs/esm-framework';
import { openFormInChart } from './open-form-in-chart';
import { visitWaitMs } from './open-form-in-visit';

const t = ((key: string, fallback: string, values?: Record<string, string>) =>
  fallback.replace(/{{(\w+)}}/g, (_, name) => values?.[name] ?? '')) as never;
const bpgForm = { uuid: 'bpg-form', display: 'RHD BPG Delivery' };
const args = { patientUuid: 'grace', formUuid: 'bpg-form', visitType: 'rhd-clinic-visit', location: 'clinic' };
const workspaces = () => getGlobalStore<Record<string, unknown>>('workspace2', {});

function serve(activeVisits: Array<object>) {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({ data: url.includes('/visit?') ? { results: activeVisits } : bpgForm })) as never);
}

const openedForms = () =>
  vi.mocked(launchWorkspace2).mock.calls.filter(([name]) => name === 'patient-form-entry-workspace');
const chartOpensWith = (patientUuid: string, visitUuid: string) =>
  act(() =>
    workspaces().setState({
      openedGroup: { groupName: 'patient-chart', props: { patientUuid, visitContext: { uuid: visitUuid } } },
    }),
  );

describe('openFormInChart', () => {
  beforeEach(() => {
    workspaces().setState({ openedGroup: null });
    vi.mocked(saveVisit).mockResolvedValue({
      data: { uuid: 'new-visit', visitType: { display: 'RHD Clinic Visit' } },
    } as never);
  });

  it('opens the chart, then the form once the chart has opened with the visit the patient already has', async () => {
    serve([{ uuid: 'visit' }]);

    const opening = openFormInChart(t, args);
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/grace/chart/Patient Summary' }),
    );
    expect(saveVisit).not.toHaveBeenCalled();
    expect(openedForms()).toEqual([]);

    chartOpensWith('grace', 'visit');
    await opening;

    expect(openedForms()).toEqual([
      [
        'patient-form-entry-workspace',
        expect.objectContaining({ form: bpgForm, encounterUuid: '', workspaceTitle: 'RHD BPG Delivery' }),
      ],
    ]);
    // With no group props of its own, so it takes the chart's.
    expect(openedForms()[0]).toHaveLength(2);
  });

  it('waits past a workspace group for another patient or another visit', async () => {
    serve([{ uuid: 'visit' }]);

    const opening = openFormInChart(t, args);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    chartOpensWith('someone-else', 'visit');
    chartOpensWith('grace', 'old-visit');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openedForms()).toEqual([]);

    chartOpensWith('grace', 'visit');
    await opening;
    expect(openedForms()).toHaveLength(1);
  });

  it('starts a visit for a patient with none, before opening the chart', async () => {
    serve([]);

    const opening = openFormInChart(t, args);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());

    expect(vi.mocked(saveVisit).mock.calls[0][0]).toEqual({
      patient: 'grace',
      visitType: 'rhd-clinic-visit',
      location: 'clinic',
      startDatetime: null,
    });
    expect(vi.mocked(saveVisit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(navigate).mock.invocationCallOrder[0],
    );
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: 'RHD Clinic Visit started' }));
    chartOpensWith('grace', 'new-visit');
    await opening;
    expect(openedForms()).toHaveLength(1);
  });

  it('opens no form, and says so, when the chart has not opened with the visit in time', async () => {
    serve([{ uuid: 'visit' }]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const opening = openFormInChart(t, args);
      await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(visitWaitMs);
      await opening;
    } finally {
      vi.useRealTimers();
    }

    expect(openedForms()).toEqual([]);
    expect(showSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'error', subtitle: 'Open the form from Clinical forms.' }),
    );
  });

  it('opens nothing when the visit cannot be started', async () => {
    serve([]);
    vi.mocked(saveVisit).mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403 } }));

    await openFormInChart(t, args);

    expect(navigate).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', subtitle: 'You may not start a visit for this patient.' }),
    );
  });

  it("looks up only the patient's active visit", async () => {
    serve([{ uuid: 'visit' }]);

    const opening = openFormInChart(t, args);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    chartOpensWith('grace', 'visit');
    await opening;

    const visitLookup = vi
      .mocked(openmrsFetch)
      .mock.calls.map(([url]) => url)
      .find((url) => url.includes('/visit?'));
    expect(visitLookup).toContain('patient=grace&includeInactive=false');
  });

  it('says nothing, and opens nothing, when the user leaves the chart before it opens', async () => {
    serve([{ uuid: 'visit' }]);

    const opening = openFormInChart(t, args);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    window.history.pushState(null, '', '/openmrs/spa/home/act-registry');
    window.dispatchEvent(new Event('single-spa:routing-event'));
    await opening;

    expect(openedForms()).toEqual([]);
    expect(showSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});
