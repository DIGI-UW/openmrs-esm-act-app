import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig, useSWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getDefaultsFromConfigSchema,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useSession,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import InrEditWorkspace from './inr-edit.workspace';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const i = config.inrReviews.concepts;
const { no, targets } = config.inrReviews.answers;
const t23 = targets.find((one) => one.label === '2.0-3.0')!.uuid;
const t35 = targets.find((one) => one.label === '2.5-3.5')!.uuid;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (uuid: string, concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  uuid,
  concept: { uuid: concept },
  value,
  groupMembers,
});

function inrEncounter(uuid: string, tested: string, inr: number, groups = 1, target = t35, next = '2026-11-13') {
  const group = (n: number) =>
    obs(`${uuid}-g${n}`, i.group, null, [
      obs(`${uuid}-g${n}-date`, i.dateTested, `${tested}T00:00:00.000+0300`),
      obs(`${uuid}-g${n}-inr`, i.value, inr),
      obs(`${uuid}-g${n}-dose`, i.doseChange, coded(no, 'No')),
    ]);
  return {
    uuid,
    encounterDatetime: `${tested}T09:00:00.000+0300`,
    obs: [
      obs(`${uuid}-target`, i.target, coded(target, 'target')),
      ...Array.from({ length: groups }, (_, n) => group(n)),
      obs(`${uuid}-next`, i.nextInr, `${next}T00:00:00.000+0300`),
    ],
  } as ChartEncounter;
}

function serve({
  inr = [] as Array<ChartEncounter>,
  readFails = false,
  writeFails = false,
  holdWrites = null as Promise<void> | null,
} = {}) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      await holdWrites;
      if (writeFails) {
        throw Object.assign(new Error('Server error'), { responseBody: { error: { message: 'Privileges required' } } });
      }
      return { data: {} };
    }
    if (readFails) {
      throw new Error('500');
    }
    if (url.includes(`encounterType=${config.inrReviews.encounterType}`)) {
      return { data: { results: inr, totalCount: inr.length } };
    }
    return { data: { results: [], totalCount: 0 } };
  }) as never);
}

const writes = () =>
  vi
    .mocked(openmrsFetch)
    .mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'POST') as Array<
    [string, { body: { obs?: Array<any> } }]
  >;
const reads = () =>
  vi
    .mocked(openmrsFetch)
    .mock.calls.filter(
      ([url, init]) =>
        !(init as { method?: string } | undefined)?.method &&
        String(url).includes('encounterType=' + config.inrReviews.encounterType),
    ).length;

const closeWorkspace = vi.fn();
let refetch: () => Promise<unknown>;
function Refetch() {
  const { mutate } = useSWRConfig();
  refetch = () => mutate(() => true);
  return null;
}
async function openEditor(encounterUuid = 'latest', groupUuid?: string) {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Refetch />
      <InrEditWorkspace
        workspaceProps={{ encounterUuid, groupUuid }}
        windowProps={null}
        groupProps={{ patientUuid: 'grace' }}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-inr-edit-workspace"
        windowName="act-inr-monitoring"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}
const typeInr = (value: string) => fireEvent.change(screen.getByLabelText('INR value'), { target: { value } });
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('InrEditWorkspace', () => {
  beforeEach(async () => {
    vi.mocked(showSnackbar).mockClear();
    closeWorkspace.mockReset();
    await signInWith(['Get Encounters', 'Get Observations', 'Add Encounters', 'Edit Encounters']);
    vi.mocked(useSession).mockReturnValue({
      ...(vi.mocked(useSession)() as object),
      sessionLocation: { uuid: 'gulu' },
    } as never);
  });

  it("opens with the values of the INR of the encounter it was launched for, not another encounter's", async () => {
    serve({ inr: [inrEncounter('older', '2026-08-01', 1.8), inrEncounter('latest', '2026-10-16', 1.7)] });

    await openEditor('older');

    expect(await screen.findByLabelText('INR value')).toHaveValue(1.8);
    expect(screen.getByLabelText('Date tested')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('INR target')).toHaveValue(t35);
    expect(screen.getByLabelText('Next INR date')).toHaveValue('2026-11-13');
  });

  it('saves the whole entry to the encounter, closes the workspace, and reloads the INR', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor();
    await screen.findByLabelText('INR value');
    const before = reads();

    typeInr('2.6');
    await save();

    await vi.waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    await vi.waitFor(() => expect(reads()).toBeGreaterThan(before));
    // The rewritten group has a new uuid, so the editor closes before the list reloads.
    const calls = vi.mocked(openmrsFetch).mock.calls;
    const written = calls.findIndex(([, init]) => (init as { method?: string } | undefined)?.method === 'POST');
    const reloaded = calls.findIndex(
      ([url], n) => n > written && String(url).includes(`encounterType=${config.inrReviews.encounterType}`),
    );
    expect(closeWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(openmrsFetch).mock.invocationCallOrder[reloaded],
    );
    const [[url, init]] = writes();
    expect(url).toBe(`${restBaseUrl}/encounter/latest`);
    const group = init.body.obs!.find((one) => one.concept === i.group);
    expect(group.groupMembers.map((member: any) => [member.concept, member.value])).toEqual([
      [i.dateTested, '2026-10-16'],
      [i.value, 2.6],
      [i.doseChange, no],
    ]);
    expect(init.body.obs!.filter((one) => one.voided).map((one) => one.uuid)).toEqual([
      'latest-g0',
      'latest-g0-date',
      'latest-g0-inr',
      'latest-g0-dose',
    ]);
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('asks for the date and an INR above 0 and up to 99, and writes nothing until they are', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor();
    await screen.findByLabelText('INR value');

    typeInr('');
    await save();
    expect(await screen.findByText('Enter an INR above 0 and up to 99')).toBeInTheDocument();
    typeInr('99.1');
    await save();
    typeInr('0');
    await save();
    fireEvent.change(screen.getByLabelText('Date tested'), { target: { value: '' } });
    typeInr('2.5');
    await save();

    expect(screen.getByText('Enter the date tested')).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('accepts an INR of 99', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor();
    await screen.findByLabelText('INR value');

    typeInr('99');
    await save();

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
  });

  it('writes nothing on Cancel', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor();
    await screen.findByLabelText('INR value');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
    expect(writes()).toEqual([]);
  });

  it('shows the new dose field only once Dose change is Yes, and saves it only then', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor();
    await screen.findByLabelText('INR value');
    const members = () =>
      writes()
        .at(-1)![1]
        .body.obs!.find((one) => one.concept === i.group)
        .groupMembers.map((member: any) => [member.concept, member.value]);

    expect(screen.queryByLabelText('New anticoagulant dose')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'Yes');
    await userEvent.type(screen.getByLabelText('New anticoagulant dose'), '4 mg');
    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'No');
    await save();

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(members().map(([concept]: [string]) => concept)).not.toContain(i.newDose);
  });

  it('leaves the target and the next INR that earlier entries share read only', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7, 2)] });

    await openEditor();

    expect(await screen.findByLabelText('INR target')).toBeDisabled();
    expect(screen.getByLabelText('Next INR date')).toBeDisabled();
  });

  const targetOptions = async () =>
    within(await screen.findByLabelText('INR target'))
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);
  const withoutTarget = {
    uuid: 'bare',
    encounterDatetime: '2026-10-22T09:00:00.000+0300',
    obs: [
      obs('bare-g', i.group, null, [
        obs('bare-g-date', i.dateTested, '2026-10-20T00:00:00.000+0300'),
        obs('bare-g-inr', i.value, 2.2),
      ]),
    ],
  } as ChartEncounter;

  it('offers no blank INR target while the entry has one, as a blank would not clear it', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor('latest');

    expect(await targetOptions()).not.toContain('');
  });

  it('offers a blank INR target while the entry has none', async () => {
    serve({ inr: [withoutTarget] });
    await openEditor('bare');

    expect(await targetOptions()).toContain('');
  });

  it('edits the target and the next INR of an encounter holding one entry, replacing the old answers', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7, 1)] });
    await openEditor();
    await screen.findByLabelText('INR value');

    await userEvent.selectOptions(screen.getByLabelText('INR target'), '2.0-3.0');
    fireEvent.change(screen.getByLabelText('Next INR date'), { target: { value: '2026-12-01' } });
    await save();

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    const obsWritten = writes()[0][1].body.obs!;
    expect(obsWritten.filter((one) => one.voided).map((one) => one.uuid)).toEqual([
      'latest-g0',
      'latest-g0-date',
      'latest-g0-inr',
      'latest-g0-dose',
      'latest-target',
      'latest-next',
    ]);
    expect(obsWritten.filter((one) => !one.voided && one.concept !== i.group)).toEqual([
      { concept: i.target, person: 'grace', value: t23 },
      { concept: i.nextInr, person: 'grace', value: '2026-12-01' },
    ]);
  });

  it('adds the INR to an INR Monitoring that holds none, not to a second encounter', async () => {
    const noValue = {
      ...inrEncounter('empty', '2026-10-01', 1),
      obs: [obs('empty-target', i.target, coded(t23, 'target'))],
    };
    serve({ inr: [noValue as ChartEncounter] });
    await openEditor('empty');
    await screen.findByLabelText('INR value');

    expect(screen.getByLabelText('Date tested')).toHaveValue(dayjs().format('YYYY-MM-DD'));
    typeInr('2.4');
    await save();

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe(`${restBaseUrl}/encounter/empty`);
  });

  it('disables Save and Cancel while saving and posts once', async () => {
    let release!: () => void;
    serve({
      inr: [inrEncounter('latest', '2026-10-16', 1.7)],
      holdWrites: new Promise<void>((resolve) => (release = resolve)),
    });
    await openEditor();
    await screen.findByLabelText('INR value');

    await save();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await save();
    expect(writes()).toHaveLength(1);

    release();
    await vi.waitFor(() => expect(closeWorkspace).toHaveBeenCalled());
    expect(writes()).toHaveLength(1);
  });

  it('keeps the editor open with the reason when the save fails', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)], writeFails: true });
    await openEditor();
    await screen.findByLabelText('INR value');

    typeInr('2.6');
    await save();

    expect(await screen.findByText('Privileges required')).toBeInTheDocument();
    expect(screen.getByLabelText('INR value')).toHaveValue(2.6);
    expect(closeWorkspace).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('edits the entry of the row it was opened from, not the newest in the same encounter', async () => {
    const two = {
      uuid: 'two',
      encounterDatetime: '2026-10-22T09:00:00.000+0300',
      obs: [
        obs('two-target', i.target, coded(t35, 'target')),
        obs('g-old', i.group, null, [
          obs('g-old-date', i.dateTested, '2026-07-01T00:00:00.000+0300'),
          obs('g-old-inr', i.value, 1.8),
        ]),
        obs('g-new', i.group, null, [
          obs('g-new-date', i.dateTested, '2026-10-16T00:00:00.000+0300'),
          obs('g-new-inr', i.value, 2.9),
        ]),
      ],
    } as ChartEncounter;
    serve({ inr: [two] });
    await openEditor('two', 'g-old');
    await screen.findByLabelText('INR value');

    expect(screen.getByLabelText('INR value')).toHaveValue(1.8);
    typeInr('2.1');
    await save();

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(
      writes()[0][1]
        .body.obs!.filter((one) => one.voided)
        .map((one) => one.uuid),
    ).toEqual(['g-old', 'g-old-date', 'g-old-inr']);
  });

  it('opens a row whose group holds a Date Tested but no INR, so its INR can be entered', async () => {
    const missed = {
      uuid: 'missed',
      encounterDatetime: '2026-10-22T09:00:00.000+0300',
      obs: [obs('g-empty', i.group, null, [obs('g-empty-date', i.dateTested, '2026-10-20T00:00:00.000+0300')])],
    } as ChartEncounter;
    serve({ inr: [missed] });

    await openEditor('missed', 'g-empty');

    expect(await screen.findByLabelText('INR value')).toHaveValue(null);
    expect(screen.getByLabelText('Date tested')).toHaveValue('2026-10-20');
    typeInr('2.2');
    await save();
    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(
      writes()[0][1]
        .body.obs!.filter((one) => one.voided)
        .map((one) => one.uuid),
    ).toEqual(['g-empty', 'g-empty-date']);
  });

  it('keeps the entry it opened with, and what was typed, when a reload no longer holds that group', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    await openEditor('latest', 'latest-g0');
    await screen.findByLabelText('INR value');
    typeInr('2.5');

    serve({ inr: [] });
    await act(() => refetch());

    expect(screen.getByLabelText('INR value')).toHaveValue(2.5);
    expect(screen.queryByText('This INR could not be found')).not.toBeInTheDocument();
  });

  it('says the INR could not be found when the row it was opened from is not in the encounter', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });

    await openEditor('latest', 'gone');

    expect(await screen.findByText('This INR could not be found')).toBeInTheDocument();
  });

  it('says the INR could not be loaded, not that it is missing, when the read fails', async () => {
    serve({ readFails: true });

    await openEditor();

    expect(await screen.findByText('The INR could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('This INR could not be found')).not.toBeInTheDocument();
  });

  it('says the INR could not be found for an encounter that is not the patient’s', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });

    await openEditor('someone-elses');

    expect(await screen.findByText('This INR could not be found')).toBeInTheDocument();
    expect(screen.queryByLabelText('INR value')).not.toBeInTheDocument();
  });
});
