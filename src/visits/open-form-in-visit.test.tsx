import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  createGlobalStore,
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  openmrsFetch,
  saveVisit,
  showSnackbar,
  useConfig,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { useOpenFormInVisit, visitWaitMs } from './open-form-in-visit';

const bpgForm = { uuid: '0119d2e6-e2e1-391c-9b88-d59a10b0780d', name: 'RHD BPG Delivery', display: 'RHD BPG Delivery' };
const newVisit = { uuid: 'new-visit', visitType: { display: 'RHD Clinic Visit' } };

let chart: ReturnType<typeof createGlobalStore<Record<string, unknown>>>;
const mutateVisit = vi.fn();

function openedForms() {
  return vi.mocked(launchWorkspace2).mock.calls.filter(([name]) => name === 'patient-form-entry-workspace');
}

describe('useOpenFormInVisit', () => {
  beforeEach(() => {
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    vi.mocked(useSession).mockReturnValue({ sessionLocation: { uuid: 'clinic' } } as never);
    vi.mocked(openmrsFetch).mockResolvedValue({ data: bpgForm } as never);
    vi.mocked(saveVisit).mockResolvedValue({ data: newVisit } as never);
    vi.mocked(useVisit).mockReturnValue({ activeVisit: null, isLoading: false, mutate: mutateVisit } as never);
    chart = createGlobalStore('patient-chart-global-store', {
      patientUuid: 'winnie',
      visitContext: null,
      workspaceGroupVisitUuid: 'old-visit',
    });
  });

  it('opens the form at once in the visit the chart already has', async () => {
    chart.setState({ visitContext: { uuid: 'old-visit', patient: { uuid: 'winnie' } } });
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));

    expect(saveVisit).not.toHaveBeenCalled();
    expect(openedForms()).toEqual([
      [
        'patient-form-entry-workspace',
        expect.objectContaining({
          form: bpgForm,
          encounterUuid: '',
          workspaceTitle: 'RHD BPG Delivery',
          additionalProps: expect.objectContaining({ mode: 'enter', openClinicalFormsWorkspaceOnFormClose: false }),
        }),
      ],
    ]);
  });

  it('starts a visit for a patient with none, then opens the form once the chart has relaunched with it', async () => {
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    let opening: Promise<void>;
    act(() => {
      opening = result.current.open(bpgForm.uuid);
    });
    await vi.waitFor(() => expect(saveVisit).toHaveBeenCalled());

    expect(vi.mocked(saveVisit).mock.calls[0][0]).toEqual({
      patient: 'winnie',
      visitType: 'bf86d5a7-9511-5c11-acb1-8f8718775cd5',
      location: 'clinic',
      startDatetime: null,
    });
    await vi.waitFor(() => expect(mutateVisit).toHaveBeenCalled());
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'success',
        title: 'RHD Clinic Visit started',
        subtitle: 'Started automatically so the form can be saved',
      }),
    );
    expect(openedForms()).toEqual([]);

    // The visit reaching the store is not enough: the workspace group must have relaunched with it.
    act(() => chart.setState({ visitContext: newVisit }));
    act(() => chart.setState({ workspaceGroupVisitUuid: 'old-visit' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(openedForms()).toEqual([]);

    act(() => chart.setState({ workspaceGroupVisitUuid: 'new-visit' }));
    await act(() => opening);

    expect(openedForms()).toHaveLength(1);
  });

  it('starts a visit when the chart holds another patient’s visit', async () => {
    chart.setState({ visitContext: { uuid: 'their-visit', patient: { uuid: 'someone-else' } } });
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    act(() => {
      result.current.open(bpgForm.uuid);
    });

    await vi.waitFor(() => expect(saveVisit).toHaveBeenCalled());
  });

  it('opens no form, and says so, when the chart has not taken the new visit in time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() => useOpenFormInVisit('winnie'));
      let opening: Promise<void>;
      act(() => {
        opening = result.current.open(bpgForm.uuid);
      });
      await vi.waitFor(() => expect(mutateVisit).toHaveBeenCalled());

      await act(() => vi.advanceTimersByTimeAsync(visitWaitMs));
      await act(() => opening);

      expect(openedForms()).toEqual([]);
      expect(showSnackbar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'The visit has started. Open the form from Clinical forms.',
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens no form when the visit cannot be started', async () => {
    vi.mocked(saveVisit).mockRejectedValue(new Error('Visit location required'));
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));

    expect(openedForms()).toEqual([]);
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', subtitle: 'Visit location required' }),
    );
  });

  it('opens at once when the chart has not yet taken the visit useVisit found', async () => {
    vi.mocked(useVisit).mockReturnValue({
      activeVisit: { uuid: 'visit' },
      isLoading: false,
      mutate: mutateVisit,
    } as never);
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));

    expect(saveVisit).not.toHaveBeenCalled();
    expect(openedForms()).toHaveLength(1);
  });

  it('starts one visit for two quick clicks', async () => {
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    act(() => {
      result.current.open(bpgForm.uuid);
      result.current.open('ba29e982-ce18-302a-9fc4-d4b2c3983465');
    });
    await vi.waitFor(() => expect(saveVisit).toHaveBeenCalled());
    expect(result.current.isOpening).toBe(true);
    act(() => chart.setState({ workspaceGroupVisitUuid: 'new-visit' }));
    await vi.waitFor(() => expect(result.current.isOpening).toBe(false));

    expect(saveVisit).toHaveBeenCalledTimes(1);
    expect(openedForms()).toHaveLength(1);
  });

  it('asks for a form once, however often it is opened', async () => {
    chart.setState({ visitContext: { uuid: 'old-visit', patient: { uuid: 'winnie' } } });
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));
    await act(() => result.current.open(bpgForm.uuid));

    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    expect(openedForms()[1][1]).toEqual(openedForms()[0][1]);
  });

  it('says plainly when the user may not start a visit', async () => {
    vi.mocked(saveVisit).mockRejectedValue(
      Object.assign(new Error('Server responded with 403'), { response: { status: 403 } }),
    );
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', subtitle: 'You may not start a visit for this patient.' }),
    );
  });

  it('counts as opening while it is still finding out whether the patient has a visit', () => {
    vi.mocked(useVisit).mockReturnValue({ activeVisit: null, isLoading: true, mutate: mutateVisit } as never);

    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    expect(result.current.isOpening).toBe(true);
  });

  it('asks for a form again after asking for it failed', async () => {
    chart.setState({ visitContext: { uuid: 'old-visit', patient: { uuid: 'winnie' } } });
    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('Network down'));
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));
    await act(() => result.current.open(bpgForm.uuid));

    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    expect(openedForms()).toHaveLength(1);
  });

  it('starts no visit when the form cannot be fetched', async () => {
    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('Network down'));
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));

    expect(saveVisit).not.toHaveBeenCalled();
    expect(openedForms()).toEqual([]);
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', subtitle: 'Network down' }));
  });

  it('opens the form when the chart has taken the new visit before the hook starts waiting', async () => {
    vi.mocked(saveVisit).mockImplementation((async () => {
      chart.setState({ visitContext: newVisit, workspaceGroupVisitUuid: 'new-visit' });
      return { data: newVisit };
    }) as never);
    const { result } = renderHook(() => useOpenFormInVisit('winnie'));

    await act(() => result.current.open(bpgForm.uuid));

    expect(openedForms()).toHaveLength(1);
  });
});
