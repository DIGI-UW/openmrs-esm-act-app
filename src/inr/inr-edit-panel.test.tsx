import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
import InrEditPanel from './inr-edit-panel.component';
import { latestInrEntry } from './inr-edit.resource';
import InrTrend from './inr-trend.component';

vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  AreaChart: vi.fn(() => <div data-testid="area-chart" />),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const i = config.inrReviews.concepts;
const { yes, no, targets } = config.inrReviews.answers;
const t23 = targets.find((one) => one.label === '2.0-3.0')!.uuid;
const t35 = targets.find((one) => one.label === '2.5-3.5')!.uuid;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (uuid: string, concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  uuid,
  concept: { uuid: concept },
  value,
  groupMembers,
});

const onWarfarin = (): ChartEncounter =>
  ({
    uuid: 'consultation',
    encounterDatetime: '2026-09-01T09:00:00.000+0300',
    obs: [
      obs('m', c.medication, null, [
        obs('m1', c.medication, coded(config.consultations.vitaminKAntagonists[0], 'Warfarin')),
      ]),
    ],
  }) as ChartEncounter;

function inrEncounter(
  uuid: string,
  tested: string,
  inr: number,
  groups = 1,
  target = t35,
  next = '2026-11-13',
): ChartEncounter {
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
  consultations = [] as Array<ChartEncounter>,
  inr = [] as Array<ChartEncounter>,
  mayEnter = true,
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
    if (url.includes('/form/')) {
      return {
        data: { uuid: 'form', encounterType: { editPrivilege: mayEnter ? null : { display: 'Task: nobody' } } },
      };
    }
    if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
      return { data: { results: consultations, totalCount: consultations.length } };
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
    [string, { body: { obs?: Array<any>; [key: string]: unknown } }]
  >;
const reads = () =>
  vi
    .mocked(openmrsFetch)
    .mock.calls.filter(
      ([url, init]) =>
        !(init as { method?: string } | undefined)?.method &&
        String(url).includes('encounterType=' + config.inrReviews.encounterType),
    ).length;

const renderTrend = (onSubmit = vi.fn()) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <form onSubmit={onSubmit}>
        <textarea aria-label="Interval history" />
        <InrTrend patientUuid="grace" />
        <button type="submit">Save consultation</button>
      </form>
    </SWRConfig>,
  );

const typeInr = (value: string) => fireEvent.change(screen.getByLabelText('INR value'), { target: { value } });

describe('the INR editor under the consultation form chart', () => {
  beforeEach(async () => {
    vi.mocked(showSnackbar).mockClear();
    await signInWith(['Get Encounters', 'Get Observations', 'Add Encounters', 'Edit Encounters']);
    vi.mocked(useSession).mockReturnValue({
      ...(vi.mocked(useSession)() as object),
      sessionLocation: { uuid: 'gulu' },
    } as never);
  });

  it("opens in place with the latest entry's values, leaving the consultation's own answers alone", async () => {
    serve({ inr: [inrEncounter('older', '2026-08-01', 1.8), inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.type(screen.getByLabelText('Interval history'), 'unsaved note');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    expect(screen.getByLabelText('Date tested')).toHaveValue('2026-10-16');
    expect(screen.getByLabelText('INR value')).toHaveValue(1.7);
    expect(screen.getByLabelText('INR target')).toHaveValue(t35);
    expect(screen.getByLabelText('Next INR date')).toHaveValue('2026-11-13');
    expect(screen.getByLabelText('Interval history')).toHaveValue('unsaved note');
  });

  it('saves the whole entry to the encounter in place, closes, and reloads the INR', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));
    const before = reads();

    typeInr('2.6');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(screen.queryByLabelText('INR value')).not.toBeInTheDocument());
    const [[url, init]] = writes();
    expect(url).toBe(`${restBaseUrl}/encounter/latest`);
    const group = init.body.obs!.find((one) => one.concept === i.group);
    expect(group.groupMembers.map((member: any) => [member.concept, member.value])).toEqual([
      [i.dateTested, '2026-10-16'],
      [i.value, 2.6],
      [i.doseChange, no],
    ]);
    expect(init.body.obs!.filter((one) => one.voided).map((one) => one.uuid)).toEqual(['latest-g0']);
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(reads()).toBeGreaterThan(before);
  });

  it('asks for the date and an INR above 0 and up to 99, and writes nothing until they are', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    typeInr('');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter an INR above 0 and up to 99')).toBeInTheDocument();
    typeInr('100');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    typeInr('0');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(screen.getByLabelText('Date tested'), { target: { value: '' } });
    typeInr('2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter the date tested')).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('writes nothing on Cancel and closes on Escape', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('INR value')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit INR monitoring' }));
    await userEvent.type(screen.getByLabelText('INR value'), '{Escape}');

    expect(screen.queryByLabelText('INR value')).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("cancels Enter in a field, which is what would submit the consultation's form, but not on a button", async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    renderTrend(onSubmit);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    // fireEvent returns false when the event's default, here the implicit form submission, was cancelled.
    expect(fireEvent.keyDown(screen.getByLabelText('INR value'), { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(screen.getByLabelText('Date tested'), { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(screen.getByLabelText('INR target'), { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Enter' })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(writes()).toEqual([]);
  });

  it("keeps every key in the panel away from the consultation form's own key handlers", async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    const outside = vi.fn();
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <div onKeyDown={outside}>
          <InrTrend patientUuid="grace" />
        </div>
      </SWRConfig>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    await userEvent.type(screen.getByLabelText('INR value'), '7');

    expect(outside).not.toHaveBeenCalled();
  });

  it('records a new INR as a new encounter at the session location, taking the latest target', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Record new INR' }));

    expect(screen.getByLabelText('INR target')).toHaveValue(t35);
    expect(screen.getByLabelText('Next INR date')).toHaveValue('');
    typeInr('2.9');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    const [[url, init]] = writes();
    expect(url).toBe(`${restBaseUrl}/encounter`);
    expect(init.body).toMatchObject({
      patient: 'grace',
      encounterType: config.inrReviews.encounterType,
      location: 'gulu',
    });
    expect(init.body.obs!.filter((one) => one.voided)).toEqual([]);
  });

  it('offers the first INR Monitoring to a user who may add encounters but not edit them, and to no one who may not', async () => {
    await signInWith(['Get Encounters', 'Get Observations', 'Add Encounters']);
    serve({ consultations: [onWarfarin()] });
    const view = renderTrend();
    expect(await screen.findByRole('button', { name: 'Record INR monitoring' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit INR monitoring' })).not.toBeInTheDocument();
    view.unmount();

    serve({ consultations: [onWarfarin()], mayEnter: false });
    renderTrend();
    expect(await screen.findByText('No INR recorded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record INR monitoring' })).not.toBeInTheDocument();
  });

  it('shows the new dose field only once Dose change is Yes', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    expect(screen.queryByLabelText('New anticoagulant dose')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'Yes');
    expect(screen.getByLabelText('New anticoagulant dose')).toBeInTheDocument();
  });

  it('offers to record the first INR Monitoring to a patient on warfarin who has none', async () => {
    serve({ consultations: [onWarfarin()] });
    renderTrend();

    await userEvent.click(await screen.findByRole('button', { name: 'Record INR monitoring' }));
    typeInr('2.2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe(`${restBaseUrl}/encounter`);
  });

  it('adds the INR to the encounter of a patient whose INR Monitoring holds no INR, not to a second one', async () => {
    const noValue = {
      ...inrEncounter('empty', '2026-10-01', 1),
      obs: [obs('empty-target', i.target, coded(t23, 'target'))],
    };
    serve({ consultations: [onWarfarin()], inr: [noValue as ChartEncounter] });
    renderTrend();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));
    typeInr('2.4');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe(`${restBaseUrl}/encounter/empty`);
  });

  it('leaves the target and the next INR that earlier entries share read only', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7, 2)] });
    renderTrend();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    expect(screen.getByLabelText('INR target')).toBeDisabled();
    expect(screen.getByLabelText('Next INR date')).toBeDisabled();
  });

  it('saves a new dose only while Dose change is Yes', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));
    const members = () =>
      writes()
        .at(-1)![1]
        .body.obs!.find((one) => one.concept === i.group)
        .groupMembers.map((member: any) => [member.concept, member.value]);

    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'Yes');
    await userEvent.type(screen.getByLabelText('New anticoagulant dose'), '4 mg');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(members()).toContainEqual([i.newDose, '4 mg']);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));
    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'Yes');
    await userEvent.type(screen.getByLabelText('New anticoagulant dose'), '5 mg');
    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'No');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(writes()).toHaveLength(2));
    expect(members().map(([concept]: [string]) => concept)).not.toContain(i.newDose);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));
    await userEvent.selectOptions(screen.getByLabelText('Dose change'), 'Yes');
    await userEvent.type(screen.getByLabelText('New anticoagulant dose'), '6 mg');
    fireEvent.change(screen.getByLabelText('Dose change'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(writes()).toHaveLength(3));
    expect(members().map(([concept]: [string]) => concept)).not.toContain(i.newDose);
  });

  it('disables Save and Cancel while saving, posts once, and ignores Escape until the save ends', async () => {
    let release!: () => void;
    serve({
      inr: [inrEncounter('latest', '2026-10-16', 1.7)],
      holdWrites: new Promise<void>((resolve) => (release = resolve)),
    });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.type(screen.getByLabelText('INR value'), '{Escape}');
    expect(screen.getByLabelText('INR value')).toBeInTheDocument();
    expect(writes()).toHaveLength(1);

    release();
    await vi.waitFor(() => expect(screen.queryByLabelText('INR value')).not.toBeInTheDocument());
    expect(writes()).toHaveLength(1);
  });

  it('edits the target and the next INR of an encounter holding one entry, replacing the old answers', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7, 1)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    expect(screen.getByLabelText('INR target')).toBeEnabled();
    expect(screen.getByLabelText('Next INR date')).toBeEnabled();
    await userEvent.selectOptions(screen.getByLabelText('INR target'), '2.0-3.0');
    fireEvent.change(screen.getByLabelText('Next INR date'), { target: { value: '2026-12-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    const obsWritten = writes()[0][1].body.obs!;
    expect(obsWritten.filter((one) => one.voided).map((one) => one.uuid)).toEqual([
      'latest-g0',
      'latest-target',
      'latest-next',
    ]);
    expect(obsWritten.filter((one) => !one.voided && one.concept !== i.group)).toEqual([
      { concept: i.target, person: 'grace', value: t23 },
      { concept: i.nextInr, person: 'grace', value: '2026-12-01' },
    ]);
  });

  it('accepts an INR of 99 and rejects one just above it', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    typeInr('99.1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(writes()).toEqual([]);
    typeInr('99');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
  });

  it('dates a new INR today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T10:00:00'));
    try {
      serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
      renderTrend();
      await userEvent.click(await screen.findByRole('button', { name: 'Record new INR' }));
      expect(screen.getByLabelText('Date tested')).toHaveValue(dayjs().format('YYYY-MM-DD'));
      expect(screen.getByLabelText('Date tested')).toHaveValue('2026-10-30');
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers only the buttons that fit the entry', async () => {
    const noValue = {
      ...inrEncounter('empty', '2026-10-01', 1),
      obs: [obs('empty-target', i.target, coded(t23, 'target'))],
    };
    serve({ consultations: [onWarfarin()], inr: [noValue as ChartEncounter] });
    const view = renderTrend();
    expect(await screen.findByRole('button', { name: 'Edit INR monitoring' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record new INR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record INR monitoring' })).not.toBeInTheDocument();
    view.unmount();

    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    expect(await screen.findByRole('button', { name: 'Record new INR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit INR monitoring' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record INR monitoring' })).not.toBeInTheDocument();
  });

  it('voids the group the panel opened with when the latest entry changes underneath it', async () => {
    const entryOf = (uuid: string, group: string) =>
      latestInrEntry(
        [
          {
            uuid,
            encounterDatetime: '2026-10-16T09:00:00.000+0300',
            obs: [
              obs(group, i.group, null, [
                obs(`${group}-date`, i.dateTested, '2026-10-16T00:00:00.000+0300'),
                obs(`${group}-inr`, i.value, 1.7),
              ]),
            ],
          } as ChartEncounter,
        ],
        config.inrReviews.concepts,
      );
    serve();
    const panel = (entry: ReturnType<typeof entryOf>) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <InrEditPanel patientUuid="grace" entry={entry} mode="edit" onClose={vi.fn()} />
      </SWRConfig>
    );
    const view = render(panel(entryOf('first', 'g-first')));

    view.rerender(panel(entryOf('second', 'g-second')));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][0]).toBe(`${restBaseUrl}/encounter/first`);
    expect(
      writes()[0][1]
        .body.obs!.filter((one) => one.voided)
        .map((one) => one.uuid),
    ).toEqual(['g-first']);
  });

  it('keeps the panel open with the reason when the save fails', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)], writeFails: true });
    renderTrend();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR monitoring' }));

    typeInr('2.6');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Privileges required')).toBeInTheDocument();
    expect(screen.getByLabelText('INR value')).toHaveValue(2.6);
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('offers no editing to a user who may not edit encounters, and no recording to one who may not record the form', async () => {
    await signInWith(['Get Encounters', 'Get Observations', 'Add Encounters']);
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)] });
    renderTrend();
    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit INR monitoring' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Record new INR' })).toBeInTheDocument();
  });

  it('offers nothing to a user who may not record the INR form', async () => {
    serve({ inr: [inrEncounter('latest', '2026-10-16', 1.7)], mayEnter: false });
    renderTrend();

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /INR/ })).not.toBeInTheDocument();
  });
});
