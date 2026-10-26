import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import UpdateProphylaxis from './update-prophylaxis.component';
import UpdateProphylaxisWorkspace from './update-prophylaxis.workspace';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const { concepts } = config.prophylaxisUpdate;
const today = dayjs().format('YYYY-MM-DD');
const q28 = { uuid: '50be4b26-6c5b-5aaa-9254-3bfd313b4522', display: 'Q28 day BPG' };
const q21 = '2f3ee632-dd14-51b0-a4ec-de10e7958019';

const prescribed = (uuid: string, datetime: string, started = '2026-06-10') => ({
  uuid,
  encounterDatetime: datetime,
  encounterType: { uuid: 'type' },
  obs: [
    {
      uuid: `${uuid}-group`,
      concept: { uuid: concepts.prescription },
      value: null,
      groupMembers: [
        { uuid: 'm1', concept: { uuid: concepts.prescription }, value: q28 },
        { uuid: 'm2', concept: { uuid: concepts.dateStarted }, value: `${started}T00:00:00.000+0000` },
      ],
    },
    {
      uuid: `${uuid}-duration`,
      concept: { uuid: concepts.duration },
      value: { uuid: 'two', display: '2 years and reassess' },
    },
  ],
});

function serve(encounters: Array<object>) {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) => {
    if (String(url).includes('/encountertype/')) {
      return Promise.resolve({ data: { editPrivilege: { display: 'Add Encounters' } } });
    }
    if (String(url).includes('encounterType:(uuid),obs:(')) {
      return Promise.resolve({ data: { results: encounters, totalCount: encounters.length } });
    }
    return Promise.resolve({ data: {} });
  }) as never);
}

const posts = () =>
  vi
    .mocked(openmrsFetch)
    .mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')
    .map(([url, init]) => [url, (init as { body: { obs: Array<Record<string, unknown>> } }).body] as const);

const memberValue = (group: Record<string, unknown>, concept: string) =>
  (group.groupMembers as Array<{ concept: string; value: unknown }>).find((one) => one.concept === concept)?.value;

const closeWorkspace = vi.fn();
async function openUpdate() {
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <UpdateProphylaxisWorkspace
        workspaceProps={null}
        windowProps={null}
        groupProps={{ patientUuid: 'winnie' }}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-update-prophylaxis-workspace"
        windowName="act-update-prophylaxis"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
  await screen.findByTestId('current-prescription');
}

describe('UpdateProphylaxisWorkspace', () => {
  beforeEach(async () => {
    await signInWith(['Add Encounters']);
    vi.mocked(useSession).mockReturnValue({
      ...vi.mocked(useSession)(),
      sessionLocation: { uuid: 'gulu', display: 'Gulu' },
    } as never);
    vi.mocked(showSnackbar).mockClear();
    closeWorkspace.mockReset();
  });

  it('shows the current regimen, start and duration, and saves a changed regimen as a new encounter starting today', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    await openUpdate();

    const current = screen.getByTestId('current-prescription');
    expect(current).toHaveTextContent('Q28 day BPG');
    expect(current).toHaveTextContent(/10.*Jun.*2026/);
    expect(current).toHaveTextContent('2 years and reassess');
    await userEvent.selectOptions(screen.getByLabelText('Regimen'), q21);
    expect(screen.getByLabelText('Date started')).toHaveValue(today);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [[url, body]] = posts() as unknown as [
      [string, Record<string, unknown> & { obs: Array<Record<string, unknown>> }],
    ];
    expect(url).toBe(`${restBaseUrl}/encounter`);
    expect(body).toMatchObject({
      patient: 'winnie',
      encounterType: config.prophylaxisUpdate.encounterType,
      location: 'gulu',
    });
    expect(memberValue(body.obs[0], concepts.prescription)).toBe(q21);
    expect(memberValue(body.obs[0], concepts.dateStarted)).toBe(today);
    expect(memberValue(body.obs[1], concepts.prescription)).toBe(q28.uuid);
    expect(memberValue(body.obs[1], concepts.dateStarted)).toBe('2026-06-10');
    expect(body.obs.find((one) => one.concept === concepts.duration)?.value).toBe('two');
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
  });

  it('keeps the start of a regimen that is not changed', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    await openUpdate();

    expect(screen.getByLabelText('Date started')).toHaveValue('2026-06-10');
  });

  it('needs a reason to stop, and saves the stop with the prescription start, stop date and reason', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    await openUpdate();

    await userEvent.click(screen.getByLabelText('Stop this prophylaxis'));
    const stop = screen.getByRole('button', { name: 'Stop prophylaxis' });
    expect(stop).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Reason stopped'), 'eaf16fa9-03d7-5846-94c3-b02805889ed9');
    expect(stop).toBeEnabled();
    await userEvent.click(stop);

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [[, body]] = posts();
    expect(memberValue(body.obs[0], concepts.prescription)).toBe(q28.uuid);
    expect(memberValue(body.obs[0], concepts.dateStarted)).toBe('2026-06-10');
    expect(memberValue(body.obs[0], concepts.dateStopped)).toBe(today);
    expect(memberValue(body.obs[0], concepts.reasonStopped)).toBe('eaf16fa9-03d7-5846-94c3-b02805889ed9');
  });

  it('stops the main prescription with its own regimen and start, whatever the form was changed to first', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    await openUpdate();

    await userEvent.selectOptions(screen.getByLabelText('Regimen'), q21);
    await userEvent.click(screen.getByLabelText('Stop this prophylaxis'));
    await userEvent.selectOptions(screen.getByLabelText('Reason stopped'), 'eaf16fa9-03d7-5846-94c3-b02805889ed9');
    await userEvent.click(screen.getByRole('button', { name: 'Stop prophylaxis' }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [[, body]] = posts();
    expect(memberValue(body.obs[0], concepts.prescription)).toBe(q28.uuid);
    expect(memberValue(body.obs[0], concepts.dateStarted)).toBe('2026-06-10');
    expect(memberValue(body.obs[0], concepts.dateStopped)).toBe(today);
  });

  it("changes today's record in place, and says so, because ACT Core keeps the first record of a day", async () => {
    serve([prescribed('todays', `${today}T08:00:00.000+0000`, today)]);
    await openUpdate();

    expect(screen.getByText('Recorded today')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Regimen'), q21);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [[url, body]] = posts();
    expect(url).toBe(`${restBaseUrl}/encounter/todays`);
    expect(body.obs.filter((one) => one.voided).map((one) => one.uuid)).toEqual(['todays-group', 'todays-duration']);
  });

  it('offers a patient with no prescription a first one, and no stop', async () => {
    serve([]);
    await openUpdate();

    expect(screen.getByTestId('current-prescription')).toHaveTextContent('No prescription');
    expect(screen.queryByLabelText('Stop this prophylaxis')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Regimen'), q21);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps the workspace open and says why when the save is refused', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    await openUpdate();
    const serving = vi.mocked(openmrsFetch).getMockImplementation()!;
    vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? Promise.reject(new Error('Privileges required'))
        : serving(url, init as never)) as never);

    await userEvent.selectOptions(screen.getByLabelText('Regimen'), q21);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(screen.getByTestId('current-prescription')).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(closeWorkspace).toHaveBeenCalledWith();
  });

  it('flags unsaved changes once the form is edited, so closing the workspace asks first', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    await openUpdate();
    const unsaved = () => vi.mocked(Workspace2).mock.lastCall![0].hasUnsavedChanges;

    expect(unsaved()).toBe(false);
    await userEvent.selectOptions(screen.getByLabelText('Regimen'), q21);
    expect(unsaved()).toBe(true);
  });
});

describe('UpdateProphylaxis', () => {
  beforeEach(async () => {
    await signInWith(['Add Encounters']);
    vi.mocked(launchWorkspace2).mockClear();
  });

  it('opens the workspace, which takes the patient from the chart, once the prescription has loaded', async () => {
    serve([prescribed('earlier', '2026-06-10T09:00:00.000+0000')]);
    render(
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
        <UpdateProphylaxis patientUuid="winnie" />
      </SWRConfig>,
    );
    const button = await screen.findByRole('button', { name: /Update prophylaxis/ });
    await waitFor(() => expect(button).toBeEnabled());

    await userEvent.click(button);

    expect(launchWorkspace2).toHaveBeenCalledWith('act-update-prophylaxis-workspace');
  });
});
