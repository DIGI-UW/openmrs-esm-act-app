import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import {
  age,
  type AssignedExtension,
  ExtensionSlot,
  fetchCurrentPatient,
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  navigate,
  openmrsFetch,
  useAssignedExtensions,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { findActiveVisit } from '../visits/start-visit';
import { ActHomeQuickActions } from './quick-actions.component';
import {
  EnterProphylaxisAction,
  FacilityReportAction,
  FindPatientAction,
  FormsAndSitesAction,
  RecordBpgAction,
  RecordOralAction,
  RegisterPatientAction,
  ResearchParticipationAction,
  RolePermissionsAction,
} from './quick-action-tiles.component';

vi.mock('../visits/start-visit', () => ({ findActiveVisit: vi.fn(), startVisit: vi.fn() }));
vi.mock('../flag-gaps/flag-gaps.resource', () => ({ fetchForm: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCurrentPatient: vi.fn(),
}));

/** Picks a patient in the O3 patient search the last launch opened, as its result cards do. */
async function pickInPatientSearch(patientUuid: string, closed = true) {
  const [name, props, windowProps] = vi.mocked(launchWorkspace2).mock.lastCall;
  expect(name).toBe('act-patient-search-workspace');
  expect(windowProps).toEqual({ startVisitWorkspaceName: 'act-patient-search-start-visit-workspace' });
  const { onPatientSelected } = props as {
    onPatientSelected: (uuid: string, patient: unknown, launchChild: unknown, close: () => Promise<boolean>) => unknown;
  };
  await act(() => onPatientSelected(patientUuid, { id: patientUuid }, vi.fn(), () => Promise.resolve(closed)));
}

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
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege, 'Add Encounters']);

    render(<EnterProphylaxisAction />);

    expect(screen.getByRole('link', { name: 'Enter prophylaxis BPG or oral' })).toBeInTheDocument();
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

  it("opens O3's patient search beside the page from Find a patient, then the chosen patient's chart", async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    render(<FindPatientAction />);

    await userEvent.click(screen.getByRole('button', { name: /find a patient/i }));
    expect(vi.mocked(launchWorkspace2).mock.lastCall[1]).toEqual(
      expect.objectContaining({ workspaceTitle: 'Find a patient' }),
    );
    await pickInPatientSearch('grace');

    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/grace/chart' });
  });

  it('stays on the page when the patient search does not close', async () => {
    render(<FindPatientAction />);

    await userEvent.click(screen.getByRole('button', { name: /find a patient/i }));
    await pickInPatientSearch('grace', false);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the patients on prophylaxis by default', () => {
    render(<EnterProphylaxisAction />);

    expect(screen.getByRole('link', { name: /enter prophylaxis/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-enter-prophylaxis',
    );
  });

  it('offers BPG and oral prophylaxis as ACT 2.0 did, each opening its form in fast data entry', async () => {
    await signInWithFastDataEntry();
    render(<EnterProphylaxisAction />);

    const enter = screen.getByRole('button', { name: /enter prophylaxis/i });
    expect(enter).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /enterBpg/ })).not.toBeInTheDocument();

    await userEvent.click(enter);

    expect(enter).toHaveAttribute('aria-expanded', 'true');
    const choices = within(screen.getByRole('list', { name: /enter prophylaxis/i })).getAllByRole('link');
    expect(choices.map((choice) => [choice.textContent, choice.getAttribute('href')])).toEqual([
      ['enterBpg', '/openmrs/spa/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d'],
      ['enterOralProphylaxis', '/openmrs/spa/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465'],
    ]);
  });

  it('hides the choices again when enter prophylaxis is clicked a second time', async () => {
    await signInWithFastDataEntry();
    render(<EnterProphylaxisAction />);

    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));
    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));

    expect(screen.queryByRole('link', { name: /enterBpg/ })).not.toBeInTheDocument();
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
    vi.mocked(useAssignedExtensions).mockImplementation((slot) =>
      slot === 'homepage-dashboard-slot'
        ? ([{ name: 'act-role-permissions-dashboard-link' }] as Array<AssignedExtension>)
        : [],
    );
    vi.mocked(fetchForm).mockImplementation((uuid: string) => Promise.resolve({ uuid }) as never);
    vi.mocked(fetchCurrentPatient).mockImplementation((uuid: string) => Promise.resolve({ id: uuid }) as never);
    vi.mocked(findActiveVisit).mockResolvedValue({ uuid: 'active-visit' } as never);
    vi.mocked(launchWorkspace2).mockResolvedValue(true);
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
    { Tile: FormsAndSitesAction, label: 'Forms & sites', subtitle: 'Configure instance' },
    { Tile: RolePermissionsAction, label: 'Role permissions', subtitle: 'Who sees what' },
    { Tile: ResearchParticipationAction, label: 'Studies', subtitle: 'Governed · OFF by default' },
  ])('labels $label with $subtitle', ({ Tile, label, subtitle }) => {
    render(<Tile />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(subtitle)).toBeInTheDocument();
  });

  it.each([
    { Tile: RecordBpgAction, label: 'Record BPG injection', formUuid: bpgForm },
    { Tile: RecordOralAction, label: 'Record oral prophylaxis', formUuid: oralForm },
  ])(
    "opens O3's patient search for $label, then the chosen patient's dose form beside the page",
    async ({ Tile, label, formUuid }) => {
      render(
        <SWRConfig value={{ provider: () => new Map() }}>
          <Tile />
        </SWRConfig>,
      );

      await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
      expect(vi.mocked(launchWorkspace2).mock.lastCall[1]).toEqual(expect.objectContaining({ workspaceTitle: label }));
      await pickInPatientSearch('grace');

      await vi.waitFor(() =>
        expect(launchWorkspace2).toHaveBeenLastCalledWith(
          'act-record-dose-form-entry-workspace',
          expect.objectContaining({ form: { uuid: formUuid } }),
          expect.objectContaining({ patientUuid: 'grace', visitContext: { uuid: 'active-visit' } }),
        ),
      );
    },
  );

  it('links Register patient, Facility report, Forms & sites, Role permissions and Studies to their configured screens', () => {
    window.openmrsBase = '/openmrs';
    render(
      <>
        <RegisterPatientAction />
        <FacilityReportAction />
        <FormsAndSitesAction />
        <RolePermissionsAction />
        <ResearchParticipationAction />
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
    expect(screen.getByRole('link', { name: /Forms & sites/ })).toHaveAttribute('href', '/openmrs/spa/form-builder');
    expect(screen.getByRole('link', { name: /Role permissions/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-role-permissions',
    );
    expect(screen.getByRole('link', { name: /Studies/ })).toHaveAttribute('href', '/openmrs/spa/home/act-studies');
  });

  it("leaves out Role permissions when the home dashboard does not assign its page's link", () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([]);

    const { container } = render(<RolePermissionsAction />);

    expect(container).toBeEmptyDOMElement();
  });

  it("opens O3's patient search from Find a patient", async () => {
    render(<FindPatientAction />);

    await userEvent.click(screen.getByRole('button', { name: /Find a patient/ }));

    expect(launchWorkspace2).toHaveBeenCalledWith(
      'act-patient-search-workspace',
      expect.objectContaining({ workspaceTitle: 'Find a patient' }),
      expect.anything(),
    );
  });
});
