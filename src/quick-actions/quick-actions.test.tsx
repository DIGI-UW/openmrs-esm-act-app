import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import {
  age,
  ExtensionSlot,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { openFormInChart } from '../visits/open-form-in-chart';
import { ActHomeQuickActions } from './quick-actions.component';
import {
  EnterProphylaxisAction,
  FacilityReportAction,
  FindPatientAction,
  RecordBpgAction,
  RecordOralAction,
  RegisterPatientAction,
} from './quick-action-tiles.component';

vi.mock('../visits/open-form-in-chart', () => ({ openFormInChart: vi.fn() }));

const bpgForm = '0119d2e6-e2e1-391c-9b88-d59a10b0780d';
const oralForm = 'ba29e982-ce18-302a-9fc4-d4b2c3983465';

function session() {
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    sessionId: 'session',
    user: { uuid: 'clinician', privileges: [], roles: [] },
    sessionLocation: { uuid: 'clinic', display: 'Kiswa Health Centre III' },
  } as never);
}

const defaultQuickActions: Config['quickActions'] = {
  registerPatientUrl: '${openmrsSpaBase}/patient-registration',
  enterProphylaxisInFastDataEntry: true,
  enterProphylaxisUrl: '${openmrsSpaBase}/forms',
  prophylaxisForms: [],
  findPatientInPanel: false,
  findPatientUrl: '${openmrsSpaBase}/search?query=',
};

// Enter prophylaxis switched back to fast data entry, with the default BPG and oral forms.
async function signInWithFastDataEntry() {
  const { quickActions } = getDefaultsFromConfigSchema(configSchema) as Config;
  await signInWith([homePrivilege, 'Add Patients', 'Add Encounters', 'Get Patients'], {
    quickActions: { ...quickActions, enterProphylaxisInFastDataEntry: true },
  });
}

describe('Quick actions card', () => {
  it("shows ACT home's tiles, which come from its own slot, untitled across the top of the page", async () => {
    await signInWith([homePrivilege]);

    render(<ActHomeQuickActions />);

    expect(screen.queryByRole('heading', { name: 'Quick actions' })).not.toBeInTheDocument();
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-home-quick-actions-slot' }),
    );
  });

  it('draws a tile with its subtitle under its label', async () => {
    await signInWith([homePrivilege, 'Add Encounters']);

    render(<EnterProphylaxisAction />);

    expect(screen.getByRole('button', { name: 'Enter prophylaxis BPG or oral' })).toBeInTheDocument();
  });
});

describe('ACT home quick actions', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege, 'Add Patients', 'Add Encounters', 'Get Patients']);
  });

  it('links register patient and find a patient to their screens', async () => {
    await signInWith([homePrivilege, 'Add Patients', 'Add Encounters', 'Get Patients'], {
      quickActions: defaultQuickActions,
    });
    render(
      <>
        <RegisterPatientAction />
        <FindPatientAction />
      </>,
    );

    expect(screen.getByRole('link', { name: /register patient/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient-registration',
    );
    // With an empty query, because the patient search app of 11.1.1-pre crashes on a /search page load without one.
    expect(screen.getByRole('link', { name: /find a patient/i })).toHaveAttribute('href', '/openmrs/spa/search?query=');
  });

  it("opens ACT's patient search over the page from Find a patient", async () => {
    render(<FindPatientAction />);

    await userEvent.click(screen.getByRole('button', { name: /find a patient/i }));

    expect(screen.getByRole('dialog', { name: 'Find a patient' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("opens Enter prophylaxis's patient search by default", async () => {
    render(<EnterProphylaxisAction />);

    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));

    expect(screen.getByRole('dialog', { name: 'Enter prophylaxis' })).toHaveTextContent('Which prophylaxis?');
  });

  it('offers BPG and oral prophylaxis as ACT 2.0 did, each opening its form in fast data entry', async () => {
    await signInWithFastDataEntry();
    render(<EnterProphylaxisAction />);

    const enter = screen.getByRole('button', { name: /enter prophylaxis/i });
    expect(enter).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /enter bpg/i })).not.toBeInTheDocument();

    await userEvent.click(enter);

    expect(enter).toHaveAttribute('aria-expanded', 'true');
    const choices = within(screen.getByRole('list', { name: /enter prophylaxis/i })).getAllByRole('link');
    expect(choices.map((choice) => [choice.textContent, choice.getAttribute('href')])).toEqual([
      ['Enter BPG', '/openmrs/spa/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d'],
      ['Enter oral prophylaxis', '/openmrs/spa/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465'],
    ]);
  });

  it('hides the choices again when enter prophylaxis is clicked a second time', async () => {
    await signInWithFastDataEntry();
    render(<EnterProphylaxisAction />);

    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));
    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));

    expect(screen.queryByRole('link', { name: /enter bpg/i })).not.toBeInTheDocument();
  });

  it('links enter prophylaxis straight to its screen when no prophylaxis forms are configured', async () => {
    await signInWith([homePrivilege, 'Add Patients', 'Add Encounters', 'Get Patients'], {
      quickActions: { ...defaultQuickActions, enterProphylaxisUrl: '${openmrsSpaBase}/forms/prophylaxis' },
    });

    render(<EnterProphylaxisAction />);

    expect(screen.getByRole('link', { name: /enter prophylaxis/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/forms/prophylaxis',
    );
  });
});

describe('Home quick action tiles', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.communityHome']);
    session();
    vi.mocked(useDebounce).mockImplementation((value) => value);
    vi.mocked(age).mockImplementation(() => '15 yrs');
    vi.mocked(openFormInChart).mockReset();
    vi.mocked(openmrsFetch).mockImplementation(((url: string) => {
      if (url.includes('/user/')) {
        return Promise.resolve({ data: { userProperties: {} } });
      }
      return Promise.resolve({
        data: {
          results: [
            {
              uuid: 'grace',
              person: { display: 'Grace Achieng', gender: 'F', age: 15, birthdate: '2011-03-14T00:00:00.000+0000' },
              identifiers: [],
            },
          ],
        },
      });
    }) as never);
  });

  it.each([
    { Tile: RecordBpgAction, label: 'Record BPG injection', subtitle: 'Benzathine penicillin G' },
    { Tile: RecordOralAction, label: 'Record oral prophylaxis', subtitle: 'Oral adherence' },
    { Tile: RegisterPatientAction, label: 'Register patient', subtitle: 'Start someone on care' },
    { Tile: FindPatientAction, label: 'Find a patient', subtitle: 'Name or ACT ID' },
    { Tile: FacilityReportAction, label: 'Facility report', subtitle: 'Monthly · quarterly' },
  ])('labels $label with $subtitle', ({ Tile, label, subtitle }) => {
    render(<Tile />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(subtitle)).toBeInTheDocument();
  });

  it.each([
    { Tile: RecordBpgAction, label: 'Record BPG injection', formUuid: bpgForm },
    { Tile: RecordOralAction, label: 'Record oral prophylaxis', formUuid: oralForm },
  ])(
    "opens $label's patient search, then the chosen patient's chart with its form",
    async ({ Tile, label, formUuid }) => {
      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <Tile />
        </SWRConfig>,
      );

      await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
      const search = screen.getByRole('dialog', { name: label });
      expect(within(search).queryByRole('tab')).not.toBeInTheDocument();
      await userEvent.type(within(search).getByRole('searchbox'), 'Grace');
      await userEvent.click(await within(search).findByRole('button', { name: /Grace Achieng/ }));

      await vi.waitFor(() =>
        expect(openFormInChart).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ patientUuid: 'grace', formUuid, location: 'clinic' }),
        ),
      );
    },
  );

  it('links Register patient and Facility report to their configured screens', () => {
    render(
      <>
        <RegisterPatientAction />
        <FacilityReportAction />
      </>,
    );

    expect(screen.getByRole('link', { name: /Register patient/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient-registration',
    );
    expect(screen.getByRole('link', { name: /Facility report/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-facility-reports',
    );
  });

  it("opens ACT's patient search from Find a patient", async () => {
    render(<FindPatientAction />);

    await userEvent.click(screen.getByRole('button', { name: /Find a patient/ }));

    expect(screen.getByRole('dialog', { name: 'Find a patient' })).toBeInTheDocument();
  });
});
