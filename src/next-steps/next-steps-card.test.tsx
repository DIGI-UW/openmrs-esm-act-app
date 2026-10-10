import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ScopedMutator, SWRConfig, useSWRConfig } from 'swr';
import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type NextStep } from './next-steps.resource';
import NextStepsCard from './next-steps-card.component';

vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const openForm = vi.fn();
const bpgForm = '0119d2e6-e2e1-391c-9b88-d59a10b0780d';
const echoForm = '88e54fb0-1243-3f7a-b925-f64648ca6635';

// Grace Achieng on the seeded distro: BPG overdue and no echo, from actcore's /actcore/nextsteps.
const grace: Array<NextStep> = [
  {
    key: 'bpg',
    form: bpgForm,
    title: 'Give BPG injection',
    reason: 'Overdue: was due 03-Oct-2026',
    isNew: false,
    done: false,
  },
  {
    key: 'echo',
    form: echoForm,
    title: 'Echocardiogram',
    reason: 'No echocardiogram recorded',
    isNew: false,
    done: false,
  },
];

const forms = [
  { uuid: bpgForm, published: true, retired: false, encounterType: { editPrivilege: null } },
  {
    uuid: echoForm,
    published: true,
    retired: false,
    encounterType: { editPrivilege: { display: 'Task: act.enterClinicalForms' } },
  },
  { uuid: 'old', published: true, retired: true, encounterType: null },
];

let steps: Array<NextStep> = grace;

function respond() {
  mockOpenmrsFetch.mockImplementation(((url: string) =>
    Promise.resolve({ data: url.includes('/actcore/nextsteps') ? { steps } : { results: forms } })) as never);
}

let mutateCache: ScopedMutator;

function CacheMutator() {
  mutateCache = useSWRConfig().mutate;
  return null;
}

function renderCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <CacheMutator />
      <NextStepsCard patientUuid="grace" />
    </SWRConfig>,
  );
}

// The chart's invalidatePatientEncounters, which the forms app runs after every save.
const invalidatePatientEncounters = () =>
  mutateCache(
    (key) => typeof key === 'string' && key.includes(`${restBaseUrl}/encounter`) && key.includes('patient=grace'),
  );

const rows = () => screen.getAllByRole('listitem');

describe('NextStepsCard', () => {
  beforeEach(async () => {
    await signInWith(['Add Encounters']);
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    vi.mocked(usePatient).mockReturnValue({
      patient: { name: [{ given: ['Grace'], family: 'Achieng' }] },
      isLoading: false,
    } as never);
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
    vi.mocked(showSnackbar).mockClear();
    openForm.mockClear();
    steps = grace;
    respond();
  });

  it("lists each step with its title, reason and action, under the card's header", async () => {
    renderCard();

    expect(await screen.findByText('Give BPG injection')).toBeInTheDocument();
    expect(screen.getByText('Next steps for this visit')).toBeInTheDocument();
    expect(screen.getByText('Forms show up here only when Grace needs them')).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([
      'Give BPG injectionOverdue: was due 03-Oct-2026Record BPG',
      'EchocardiogramNo echocardiogram recordedEnter result',
    ]);
  });

  it('asks ACT Core for the patient', async () => {
    renderCard();

    await screen.findByText('Give BPG injection');
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/actcore/nextsteps?patient=grace`);
  });

  it("opens the step's form in the patient's visit", async () => {
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Record BPG' }));

    expect(openForm).toHaveBeenCalledWith(bpgForm);
  });

  it('counts the forms the user may open, and opens Clinical forms from All forms', async () => {
    renderCard();

    const allForms = await screen.findByRole('button', { name: 'All forms (1)' });
    await userEvent.click(allForms);

    expect(launchWorkspace2).toHaveBeenCalledWith('clinical-forms-workspace');
  });

  it('marks a new step New, and shows a done step Completed after the rest', async () => {
    steps = [
      {
        key: 'consult',
        form: 'consult',
        title: 'Consultation visit',
        reason: 'Anaphylaxis reported after BPG: review before the next dose',
        isNew: true,
        done: false,
      },
      {
        key: 'bpg',
        form: bpgForm,
        title: 'Give BPG injection',
        reason: 'Entered this visit',
        isNew: false,
        done: true,
      },
    ];
    respond();

    renderCard();

    await screen.findByText('Consultation visit');
    const [consult, bpg] = rows();
    expect(consult).toHaveAttribute('data-new', 'true');
    expect(within(consult).getByText('New')).toBeInTheDocument();
    expect(within(consult).getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(bpg).toHaveAttribute('data-done', 'true');
    expect(within(bpg).getByText('Completed')).toBeInTheDocument();
    expect(within(bpg).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers no action for a referral, which no form records', async () => {
    steps = [
      {
        key: 'refer',
        form: null,
        title: 'Refer to clinician',
        reason: 'Anaphylaxis reported: a clinician must review before the next dose',
        isNew: true,
        done: false,
      },
    ];
    respond();

    renderCard();

    await screen.findByText('Refer to clinician');
    expect(within(rows()[0]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('says so when nothing is due', async () => {
    steps = [];
    respond();

    renderCard();

    expect(await screen.findByText('Nothing due for this patient today.')).toBeInTheDocument();
  });

  it('asks again after a save, and names the steps the save added', async () => {
    renderCard();
    await screen.findByText('Give BPG injection');
    expect(showSnackbar).not.toHaveBeenCalled();

    steps = [
      {
        key: 'consult',
        form: 'consult',
        title: 'Consultation visit',
        reason: 'Anaphylaxis reported after BPG: review before the next dose',
        isNew: true,
        done: false,
      },
      ...grace.slice(1),
      { ...grace[0], reason: 'Entered this visit', done: true },
    ];
    respond();
    await invalidatePatientEncounters();

    await screen.findByText('Consultation visit');
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Next step added: Consultation visit' }),
    );
  });

  it('shows nothing when turned off', async () => {
    vi.mocked(useConfig<Config>).mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Config),
      nextSteps: { enabled: false },
    });

    const { container } = renderCard();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(expect.stringContaining('/actcore/nextsteps'));
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(expect.stringContaining('/form?'));
  });

  it('keeps the last list when asking again after a save fails', async () => {
    renderCard();
    await screen.findByText('Give BPG injection');

    mockOpenmrsFetch.mockImplementation(((url: string) =>
      url.includes('/actcore/nextsteps')
        ? Promise.reject(new Error('timeout'))
        : Promise.resolve({ data: { results: forms } })) as never);
    await invalidatePatientEncounters();

    await waitFor(() =>
      expect(mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/actcore/nextsteps'))).toHaveLength(2),
    );
    expect(screen.getByText('Give BPG injection')).toBeInTheDocument();
  });

  it('shows nothing when ACT Core cannot be reached', async () => {
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      url.includes('/actcore/nextsteps')
        ? Promise.reject(new Error('Not found'))
        : Promise.resolve({ data: { results: [] } })) as never);

    const { container } = renderCard();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
