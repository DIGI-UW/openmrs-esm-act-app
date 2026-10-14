import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import Studies from './studies.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const studies = [
  { uuid: 'arc', name: 'ARC', states: [] },
  { uuid: 'miller', name: 'Miller', states: [] },
];

const participant = (overrides: Record<string, unknown>) => ({
  patient_uuid: 'patient-1',
  rhd_id: 'rhd00037',
  full_name: 'Herman Muhereza',
  study_uuid: 'arc',
  study: 'ARC',
  enrollment_uuid: 'enrollment-1',
  study_id: 'ARC-0042',
  date_enrolled: '2026-09-01T00:00:00.000+0000',
  date_completed: null,
  status: 'Active',
  active: 1,
  primary_care_clinic: 'Kiswa HC III',
  cardiac_clinic: 'Mulago Cardiac Clinic',
  ...overrides,
});

const rows = [
  participant({}),
  participant({
    patient_uuid: 'patient-2',
    full_name: 'Sarah Akello',
    enrollment_uuid: 'enrollment-2',
    study_id: 'ARC-0007',
    status: 'Inactive - Voluntary withdrawal',
    active: 0,
    date_completed: '2026-10-10T00:00:00.000+0000',
  }),
  participant({
    patient_uuid: 'patient-3',
    full_name: 'John Okello',
    enrollment_uuid: 'enrollment-3',
    study_uuid: 'miller',
    study: 'Miller',
    study_id: 'M-1',
  }),
];

function backendAnswers(saveFails?: string) {
  const posts: Array<{ url: string; body: unknown }> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === 'POST') {
      posts.push({ url, body: init.body });
      if (saveFails) {
        throw Object.assign(new Error('400'), { responseBody: { error: { globalErrors: [{ message: saveFails }] } } });
      }
      return { data: {} } as never;
    }
    return { data: { results: studies } } as never;
  });
  return posts;
}

const studyRow = async (name: string) =>
  within(await screen.findByRole('table', { name: 'Studies' })).getByRole('row', { name: new RegExp(`^${name}`) });

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Studies />
    </SWRConfig>,
  );
}

describe('Studies', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.studies', 'Task: act.manageStudies', 'Task: act.lists.export']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it('lists each study with its active and all participants', async () => {
    backendAnswers();

    renderPage();

    const arc = await studyRow('ARC');
    expect(
      within(arc)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['ARC', '1', '2', expect.anything()]);
    const miller = await studyRow('Miller');
    expect(
      within(miller)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .slice(0, 3),
    ).toEqual(['Miller', '1', '1']);
  });

  it('creates a study by name', async () => {
    const posts = backendAnswers();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Create study/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name for the study')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Study name'), '  Stage Study 2 ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toEqual([{ url: '/ws/rest/v1/actcore/studies', body: { name: 'Stage Study 2' } }]),
    );
  });

  it("says why a study could not be renamed, in the server's words", async () => {
    backendAnswers('A program is already named Miller');
    renderPage();

    const arc = await studyRow('ARC');
    await userEvent.click(within(arc).getByRole('button', { name: 'Rename study' }));
    await userEvent.clear(screen.getByLabelText('Study name'));
    await userEvent.type(screen.getByLabelText('Study name'), 'Miller');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('A program is already named Miller')).toBeInTheDocument();
  });

  it('offers neither create nor rename to a user who may not manage studies', async () => {
    await signInWith(['App: act.studies']);
    backendAnswers();

    renderPage();

    expect(await studyRow('ARC')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create study/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename study' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('lists every participant, filtered by study and by status', async () => {
    backendAnswers();
    renderPage();

    const participants = screen.getByRole('table', { name: 'Study participants' });
    expect(within(participants).getAllByRole('row')).toHaveLength(4);
    const withdrawn = within(participants).getByRole('row', { name: /Sarah Akello/ });
    expect(within(withdrawn).getByText('ARC-0007')).toBeInTheDocument();
    expect(within(withdrawn).getByText('Inactive - Voluntary withdrawal')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Study'), 'ARC');
    expect(within(screen.getByRole('table', { name: 'Study participants' })).getAllByRole('row')).toHaveLength(3);
    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Active');
    const filtered = screen.getByRole('table', { name: 'Study participants' });
    expect(within(filtered).getAllByRole('row')).toHaveLength(2);
    expect(within(filtered).getByText('Herman Muhereza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  });

  it('says so when no one is enrolled in a study yet', async () => {
    backendAnswers();
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('There are no study participants to display')).toBeInTheDocument();
  });
});
