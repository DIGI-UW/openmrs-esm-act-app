import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import ScreeningCounts from './screening-counts.component';
import { type Counts, type ScreeningMonth } from './screening-counts.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

/** The design's September at Akunalaber: school, community and health facility, as entered. */
const september: Counts = {
  school_screened: 412,
  school_children: 96,
  school_adolescents: 316,
  school_adults: 0,
  school_females: 231,
  school_positive: 14,
  community_screened: 138,
  community_children: 22,
  community_adolescents: 61,
  community_adults: 55,
  community_females: 80,
  community_positive: 6,
  facility_screened: 57,
  facility_children: 4,
  facility_adolescents: 19,
  facility_adults: 34,
  facility_females: 36,
  facility_positive: 5,
};
const zeros = Object.fromEntries(Object.keys(september).map((key) => [key, 0]));

const posted: Array<{ url: string; body: unknown }> = [];

/** Akunalaber, a primary care clinic, and Gulu, a cardiac one; Akunalaber's last month is entered. */
function backendAnswers(save?: (body: { counts: Counts; notes: string }) => Promise<ScreeningMonth>) {
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    if (url.includes('/location?tag=RHD%20Community')) {
      return { data: { results: [{ uuid: 'akunalaber', display: 'Akunalaber HCIII' }], totalCount: 1 } };
    }
    if (url.includes('/location?tag=RHD%20Tertiary')) {
      return { data: { results: [{ uuid: 'gulu', display: 'Gulu RRH' }], totalCount: 1 } };
    }
    if (url.includes('/location?tag=')) {
      return { data: { results: [], totalCount: 0 } };
    }
    if (url.includes('/location/')) {
      return { data: { display: url.includes('/gulu') ? 'Gulu RRH' : 'Akunalaber HCIII' } };
    }
    const [, clinic, month] = url.match(/clinic=([^&]+)&month=(.+)$/) ?? [];
    if (init?.method === 'POST') {
      posted.push({ url, body: init.body });
      return { data: await save(init.body as never) };
    }
    const entered = clinic === 'akunalaber' && month === lastMonth;
    return {
      data: {
        clinic,
        month,
        saved: entered,
        counts: entered ? september : zeros,
        notes: entered ? 'Two primary schools visited' : null,
      },
    };
  }) as never);
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ScreeningCounts />
    </SWRConfig>,
  );
}

const rowError = () => screen.getByTestId('screening-row-error');

const cell = (setting: string, metric: string) => screen.getByLabelText(new RegExp(`^${setting}, ${metric}$`));

describe('Screening counts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    posted.length = 0;
    await signInWith(['App: act.screeningCounts', 'Task: act.enterScreeningCounts']);
  });

  it("opens on the first clinic's last month, cardiac and primary care clinics both offered", async () => {
    backendAnswers();
    renderPage();

    expect(await screen.findByDisplayValue('412')).toBeInTheDocument();
    const clinics = within(screen.getByLabelText('Clinic')).getAllByRole('option');
    expect(clinics.map((option) => option.textContent)).toEqual(['Akunalaber HCIII', 'Gulu RRH']);
    expect(screen.getByLabelText('Month')).toHaveValue(lastMonth);
    expect(cell('Community', 'Adults 20\\+')).toHaveValue('55');
    expect(cell('Health facility', 'Positive')).toHaveValue('5');
    expect(screen.getByLabelText('Notes')).toHaveValue('Two primary schools visited');
    expect(screen.getByText("Each row's age groups add up to its screened total.")).toBeInTheDocument();
  });

  it('saves the month as typed, every count a number, and says so', async () => {
    backendAnswers(async ({ counts, notes }) => ({
      clinic: 'akunalaber',
      month: lastMonth,
      saved: true,
      counts,
      notes,
    }));
    renderPage();
    await screen.findByDisplayValue('412');

    await userEvent.clear(cell('School', 'Screened'));
    await userEvent.type(cell('School', 'Screened'), '413');
    await userEvent.clear(cell('School', 'Adults 20\\+'));
    await userEvent.type(cell('School', 'Adults 20\\+'), '1');
    await userEvent.click(screen.getByRole('button', { name: `Save ${dayjs(`${lastMonth}-01`).format('MMMM')}` }));

    expect(posted).toHaveLength(1);
    expect(posted[0].url).toMatch(new RegExp(`/actcore/screeningcounts\\?clinic=akunalaber&month=${lastMonth}$`));
    expect(posted[0].body).toEqual({
      counts: { ...september, school_screened: 413, school_adults: 1 },
      notes: 'Two primary schools visited',
    });
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it("says which row's age groups do not add up, or count more females or positives than screened, and will not save", async () => {
    backendAnswers();
    renderPage();
    await screen.findByDisplayValue('412');
    const saveButton = screen.getByRole('button', { name: /^Save / });

    await userEvent.clear(cell('Community', 'Children 0-9'));
    await userEvent.type(cell('Community', 'Children 0-9'), '21');
    expect(rowError()).toHaveTextContent('Community: The age groups add up to 137, not the 138 screened');
    expect(saveButton).toBeDisabled();

    await userEvent.clear(cell('Community', 'Children 0-9'));
    await userEvent.type(cell('Community', 'Children 0-9'), '22');
    await userEvent.clear(cell('Health facility', 'Female'));
    await userEvent.type(cell('Health facility', 'Female'), '58');
    expect(rowError()).toHaveTextContent('Health facility: Female and positive cannot be more than the 57');
    expect(saveButton).toBeDisabled();

    await userEvent.clear(cell('Health facility', 'Female'));
    await userEvent.type(cell('Health facility', 'Female'), '5.5');
    expect(rowError()).toHaveTextContent('Enter whole numbers, 0 or more');
    expect(saveButton).toBeDisabled();
  });

  it("shows ACT Core's reason when it refuses the month", async () => {
    backendAnswers(() =>
      Promise.reject({ responseBody: { error: { message: 'The school age groups add up to 1, not the 2 screened' } } }),
    );
    renderPage();
    await screen.findByDisplayValue('412');

    await userEvent.click(screen.getByRole('button', { name: /^Save / }));

    expect(await screen.findByText('The school age groups add up to 1, not the 2 screened')).toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('puts the saved counts back on Cancel', async () => {
    backendAnswers();
    renderPage();
    await screen.findByDisplayValue('412');

    await userEvent.clear(cell('School', 'Screened'));
    await userEvent.type(cell('School', 'Screened'), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(cell('School', 'Screened')).toHaveValue('412');
  });

  it('says the clinics could not load, rather than that there are none', async () => {
    backendAnswers();
    const answer = mockOpenmrsFetch.getMockImplementation();
    mockOpenmrsFetch.mockImplementation(((url: string, init?: unknown) =>
      url.includes('/location?tag=')
        ? Promise.reject(new Error('The server did not answer'))
        : answer(url, init as never)) as never);
    renderPage();

    expect(await screen.findByText('Could not load the clinics')).toBeInTheDocument();
    expect(screen.queryByText('There are no clinics to enter counts for.')).not.toBeInTheDocument();
  });

  it('shows no clinics message while the clinics load', async () => {
    backendAnswers();
    const answer = mockOpenmrsFetch.getMockImplementation();
    let release: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    mockOpenmrsFetch.mockImplementation((async (url: string, init?: unknown) => {
      if (url.includes('/location?tag=')) {
        await released;
      }
      return answer(url, init as never);
    }) as never);
    renderPage();

    await vi.waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    expect(screen.queryByText('There are no clinics to enter counts for.')).not.toBeInTheDocument();
    release();
    expect(await screen.findByDisplayValue('412')).toBeInTheDocument();
  });

  it('loads another month or clinic, a month not entered being zeros', async () => {
    backendAnswers();
    renderPage();
    await screen.findByDisplayValue('412');

    await userEvent.selectOptions(screen.getByLabelText('Clinic'), 'gulu');

    expect(await screen.findAllByDisplayValue('0')).toHaveLength(18);
    expect(screen.getByLabelText('Notes')).toHaveValue('');
  });

  it('shows the counts without inputs or a save to a user who may only read them', async () => {
    await signInWith(['App: act.screeningCounts']);
    backendAnswers();
    renderPage();

    expect(await screen.findByTestId('screening-school_screened')).toHaveTextContent('412');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save / })).not.toBeInTheDocument();
    expect(screen.getByText('Two primary schools visited')).toBeInTheDocument();
    expect(screen.queryByText("Each row's age groups add up to its screened total.")).not.toBeInTheDocument();
  });

  it('offers a site administrator only the clinics on their account', async () => {
    await signInWith(['App: act.screeningCounts', 'Task: act.enterScreeningCounts', 'Edit Users']);
    const session = vi.mocked(useSession)();
    vi.mocked(useSession).mockReturnValue({
      ...session,
      user: { ...session.user, userProperties: { 'actcore.clinics': 'gulu' } },
    } as never);
    backendAnswers();
    renderPage();

    await vi.waitFor(() =>
      expect(
        within(screen.getByLabelText('Clinic'))
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Gulu RRH']),
    );
  });
});
