import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import {
  type AssignedExtension,
  age,
  ExtensionSlot,
  openmrsFetch,
  useAssignedExtensions,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { openFormInChart } from '../visits/open-form-in-chart';
import CommunityHomeDashboard from './community-home-dashboard.component';
import CommunityQuickActions from './community-quick-actions.component';
import {
  FacilityReportAction,
  FindPatientAction,
  RecordBpgAction,
  RecordOralAction,
  RegisterPatientAction,
} from './community-quick-action-tiles.component';

vi.mock('../visits/open-form-in-chart', () => ({ openFormInChart: vi.fn() }));

const bpgForm = '0119d2e6-e2e1-391c-9b88-d59a10b0780d';
const oralForm = 'ba29e982-ce18-302a-9fc4-d4b2c3983465';
const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);

function session() {
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    sessionId: 'session',
    user: { uuid: 'clinician', privileges: [], roles: [] },
    sessionLocation: { uuid: 'clinic', display: 'Kiswa Health Centre III' },
  } as never);
}

describe('Community home', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0));
    await signInWith(['App: act.communityHome']);
    session();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is headed Home, with the session's location and today's date", () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<CommunityHomeDashboard />);

    const header = screen.getByTestId('act-page-header');
    expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent('Home');
    expect(within(header).getByText('Kiswa Health Centre III')).toBeInTheDocument();
    expect(within(header).getByText('28-Sept-2026')).toBeInTheDocument();
  });

  it('says so while no widget is assigned to Home', () => {
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<CommunityHomeDashboard />);

    expect(screen.getByText('No widgets have been added to Home yet.')).toBeInTheDocument();
  });

  it("renders the widgets assigned to Home's own slot", () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<CommunityHomeDashboard />);

    expect(mockUseAssignedExtensions).toHaveBeenCalledWith('act-community-home-widgets-slot');
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-community-home-widgets-slot' }),
    );
  });

  it('frames the quick action tiles, which come from their own slot', () => {
    render(<CommunityQuickActions />);

    expect(screen.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-community-home-quick-actions-slot' }),
    );
  });
});

describe('Community home quick action tiles', () => {
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
    expect(screen.getByRole('link', { name: /Facility report/ })).toHaveAttribute('href', '/openmrs/spa/reports');
  });

  it("opens ACT's patient search from Find a patient", async () => {
    render(<FindPatientAction />);

    await userEvent.click(screen.getByRole('button', { name: /Find a patient/ }));

    expect(screen.getByRole('dialog', { name: 'Find a patient' })).toBeInTheDocument();
  });
});
