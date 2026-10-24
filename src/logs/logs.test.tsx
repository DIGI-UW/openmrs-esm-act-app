import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { markTranslations } from '../i18n.test-helper';
import { downloadCsv } from '../table-filters/csv';
import Logs from './logs.component';
import { activityDetails, activityEntries, downloadEntries, readEntries, signInEntries } from './logs.fixture';

vi.mock('../table-filters/csv', () => ({ downloadCsv: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const BOTH = ['View Audit Logs', 'View Read Audit Logs', 'View Security Audit Logs', 'Task: act.lists.export'];

type Call = { url: string; method: string; body?: unknown };

/** The sources behind the tabs, each answering with its fixture; every request is kept for the assertions. */
function backend(overrides: Record<string, unknown> = {}) {
  const calls: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body });
    const path = url.replace('/ws/rest/v1', '');
    const match = Object.keys(overrides).find((prefix) => path.startsWith(prefix));
    if (match) {
      const answer = overrides[match];
      if (answer instanceof Error) {
        throw answer;
      }
      return { data: answer };
    }
    if (path.startsWith('/actcore/activity/')) {
      return { data: activityDetails[Number(path.split('/').pop())] };
    }
    if (path.startsWith('/actcore/activity?')) {
      return { data: { results: activityEntries, totalCount: 1284, from: '2025-10-22', to: null } };
    }
    if (path.startsWith('/actcore/reads?')) {
      return { data: { results: readEntries, totalCount: 212, from: '2025-10-22', to: null } };
    }
    if (path.startsWith('/actcore/download/record')) {
      return { data: {} };
    }
    if (path.startsWith('/actcore/download?')) {
      return { data: { results: downloadEntries, totalCount: downloadEntries.length, from: '2025-10-22', to: null } };
    }
    if (path.startsWith('/securityauditlogs?')) {
      const failures = path.includes('eventType=LOGIN_FAILURE');
      return {
        data: failures
          ? { securityAuditLogs: [signInEntries[1]], totalLogs: 9 }
          : { securityAuditLogs: signInEntries, totalLogs: 3418 },
      };
    }
    if (path.startsWith('/form?')) {
      return {
        data: {
          results: [
            { uuid: 'f-bpg', name: 'RHD BPG Delivery', retired: false, resources: [{ name: 'JSON schema' }] },
            { uuid: 'f-echo', name: 'RHD Echocardiogram', retired: false, resources: [{ name: 'JSON schema' }] },
          ],
        },
      };
    }
    return { data: { results: [] } };
  }) as never);
  return calls;
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Logs />
    </SWRConfig>,
  );

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

const dataRows = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .filter((row) => within(row).queryByRole('button', { name: 'Details' }));

const rowTexts = () =>
  dataRows().map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  );

const expand = async (index: number) => {
  await userEvent.click(within(dataRows()[index]).getByRole('button', { name: 'Details' }));
  return screen.findByTestId('log-detail');
};

/** The expanded row's line that starts with the label, as "Saved 21-Oct-2026, 10:52:14". */
const line = (detail: HTMLElement, label: string) =>
  within(detail)
    .getAllByTestId('detail-line')
    .find((one) => one.textContent?.startsWith(`${label} `));

const definitions = (detail: HTMLElement) =>
  within(detail)
    .getAllByRole('definition')
    .map((one) => one.textContent);

const lastUrl = (calls: Array<Call>, prefix: string) =>
  calls
    .filter((call) => call.url.includes(prefix))
    .map((call) => call.url)
    .pop();

describe('Logs', () => {
  beforeEach(() => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-logs');
  });

  describe('tabs and who sees them', () => {
    it('offers Activity, Patients opened, Downloads and Sign-ins to a site administrator holding the three audit privileges', async () => {
      backend();
      await signInWith(BOTH);

      renderPage();

      expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument();
      expect(tabNames()).toEqual([
        'Activitywhat users changed',
        'Patients openedwhat users read',
        'Downloadswhat left the system',
        'Sign-ins',
      ]);
    });

    it('offers only Activity for View Audit Logs, Sign-ins for View Security Audit Logs, and Patients opened and Downloads for View Read Audit Logs', async () => {
      backend();
      await signInWith(['View Audit Logs']);
      let view = renderPage();
      expect(tabNames()).toEqual(['Activitywhat users changed']);
      view.unmount();

      await signInWith(['View Security Audit Logs']);
      view = renderPage();
      expect(tabNames()).toEqual(['Sign-ins']);
      view.unmount();

      await signInWith(['View Read Audit Logs']);
      renderPage();
      expect(tabNames()).toEqual(['Patients openedwhat users read', 'Downloadswhat left the system']);
    });

    it('shows nothing to a clinician, who holds neither', async () => {
      backend();
      await signInWith(['App: act.registry']);

      const { container } = renderPage();

      expect(container).toBeEmptyDOMElement();
    });

    it("opens on the tab and user the URL names, as the link from a user's log does", async () => {
      const calls = backend();
      window.history.replaceState(null, '', '/openmrs/spa/home/act-logs?tab=downloads&user=dataClerk2');
      await signInWith(BOTH);

      renderPage();

      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Downloads');
      expect(screen.getByLabelText('User')).toHaveValue('dataClerk2');
      await waitFor(() => expect(lastUrl(calls, '/actcore/download?')).toContain('username=dataClerk2'));
    });
  });

  describe('Activity', () => {
    it('lists one row per save, newest first, with the time, user, action, summary and the patient with their ACT ID', async () => {
      backend();
      await signInWith(BOTH);

      renderPage();

      await screen.findByText('Grace Akello');
      expect(rowTexts()).toEqual([
        [
          '',
          'Today, 10:52',
          'Sarah Namusokeclinician · Clinician',
          'SavedRHD BPG Delivery6 fields set',
          'Grace Akellorhd00001',
        ],
        [
          '',
          'Today, 10:40',
          'Joseph OdongocommunityClinician · Community Clinician',
          'EditedRHD Oral Adherence2 fields changed: Date of Adherence Estimate, Adherence',
          'Samuel Okellorhd00002',
        ],
        [
          '',
          'Today, 09:15',
          'Sarah Namusokeclinician · Clinician',
          'VoidedRHD EchocardiogramReason: entered on the wrong patient',
          'Lakot Lamwakarhd00409',
        ],
        [
          '',
          'Today, 08:30',
          'Mary AchendataClerk · Data Clerk',
          'FlagDismissed flag RHD prophylaxis not prescribedReason: prescribed elsewhere',
          'Agnes Lamwakarhd00031',
        ],
        [
          '',
          'Yesterday, 17:05',
          'James KatoinstanceAdmin · Instance Administrator',
          'UserCreated user Data Clerk at Acimi HCIII',
          'Mary Achen',
        ],
      ]);
      expect(screen.getByText('Newest first')).toBeInTheDocument();
    });

    it("offers its pager's own words to translation", async () => {
      markTranslations();
      backend();
      await signInWith(BOTH);

      renderPage();

      await screen.findByText('Grace Akello');
      expect(screen.getByText('«Items per page:»')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '«Next page»' })).toBeInTheDocument();
    });

    it('expands a flag dismissal, which ACT Core records outside the audit log, without asking for a revision', async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');

      const detail = await expand(3);

      expect(within(detail).getByText('Reason: prescribed elsewhere')).toBeInTheDocument();
      expect(line(detail, 'Flag')).toHaveTextContent(/08:30:00/);
      expect(calls.some((call) => call.url.includes('/actcore/activity/'))).toBe(false);
    });

    it("expands a save to its fields, the exact time, the form's visit, where it came from and the links", async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');

      const detail = await expand(0);

      await within(detail).findByText('Date of Injection');
      expect(within(detail).getByText('21-Oct-2026')).toBeInTheDocument();
      expect(within(detail).getByText('1.2 MU (1,200,000 units)')).toBeInTheDocument();
      expect(line(detail, 'Saved')).toHaveTextContent(/Saved \d\d-\w{3}-\d{4}, 10:52:14/);
      expect(line(detail, 'Form')).toHaveTextContent('RHD BPG Delivery, visit of 2026-10-21');
      expect(line(detail, 'From')).toHaveTextContent('172.21.0.1, Chrome on macOS');
      expect(within(detail).getByRole('link', { name: "Open Grace Akello's chart" })).toHaveAttribute(
        'href',
        '/openmrs/spa/patient/p-grace/chart',
      );
      expect(
        within(detail).getByRole('link', { name: 'This change in the audit module (every field, every revision)' }),
      ).toHaveAttribute('href', expect.stringMatching(/^\/openmrs\/module\/auditlogweb\/auditlogs\.form\?username=/));
    });

    it('expands an edit to the changed fields with their previous values, and a void to its reason', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');

      let detail = await expand(1);
      await within(detail).findByText('Adherence');
      expect(definitions(detail)).toContain('60%80%');

      detail = await expand(2);
      await within(detail).findByText('Reason');
      expect(line(detail, 'Reason')).toHaveTextContent('entered on the wrong patient');
      expect(within(detail).getByText('No fields recorded')).toBeInTheDocument();
    });

    it('folds the user, dates, action and form filters into the request, from the first page again', async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');
      expect(lastUrl(calls, '/actcore/activity?')).toBe('/ws/rest/v1/actcore/activity?startIndex=0&limit=20');

      await userEvent.click(screen.getByRole('button', { name: /next page/i }));
      await waitFor(() =>
        expect(lastUrl(calls, '/actcore/activity?')).toBe('/ws/rest/v1/actcore/activity?startIndex=20&limit=20'),
      );

      await userEvent.type(screen.getByLabelText('User'), 'clinician');
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-21' } });
      await userEvent.selectOptions(screen.getByLabelText('Action'), 'saved');
      await userEvent.selectOptions(screen.getByLabelText('Form'), 'f-bpg');

      await waitFor(() =>
        expect(lastUrl(calls, '/actcore/activity?')).toBe(
          '/ws/rest/v1/actcore/activity?username=clinician&startDate=2026-10-01&endDate=2026-10-21&kind=saved&form=f-bpg&startIndex=0&limit=20',
        ),
      );
    });

    it('says since when the list reads, as ACT Core covers the last 12 months, until a From date is set', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');

      expect(screen.getByTestId('log-window')).toHaveTextContent(
        'Showing since 22-Oct-2025; set From to go further back',
      );

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
      await waitFor(() => expect(screen.queryByTestId('log-window')).not.toBeInTheDocument());
    });

    it('offers each action kind by name, and the forms the chart opens', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');

      const kinds = within(screen.getByLabelText('Action')).getAllByRole('option');
      expect(kinds.map((option) => option.textContent)).toEqual([
        'Any',
        'Saved a form',
        'Edited a form',
        'Voided a form',
        'Registered a patient',
        'Patient status',
        'Users',
        'Roles',
        'Clinics',
        'Studies',
        'Flags',
      ]);
      await waitFor(() =>
        expect(
          within(screen.getByLabelText('Form'))
            .getAllByRole('option')
            .map((option) => option.textContent),
        ).toEqual(['Any', 'RHD BPG Delivery', 'RHD Echocardiogram']),
      );
    });

    it('downloads every page of the filtered activity as CSV, recorded as a Logs download first', async () => {
      const calls = backend({
        '/actcore/activity?': { results: activityEntries, totalCount: activityEntries.length },
      });
      await signInWith(BOTH);
      renderPage();
      await screen.findByText('Grace Akello');
      await userEvent.type(screen.getByLabelText('User'), 'clinician');

      await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

      await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
      const record = calls.find((call) => call.url.endsWith('/actcore/download/record'));
      expect(record).toEqual({
        url: '/ws/rest/v1/actcore/download/record',
        method: 'POST',
        body: {
          list: 'logs:activity',
          columns: ['Time', 'User', 'Action', 'Summary', 'Target'],
          rows: 5,
          identifiers: true,
          filters: { user: 'clinician' },
        },
      });
      expect(calls.map((call) => call.url)).toContain(
        '/ws/rest/v1/actcore/activity?username=clinician&startIndex=0&limit=100',
      );
      expect(vi.mocked(downloadCsv).mock.lastCall?.[2]).toHaveLength(5);
      expect(vi.mocked(downloadCsv).mock.lastCall?.[2][0]).toEqual([
        expect.stringMatching(/10:52:14$/),
        'clinician',
        'Saved RHD BPG Delivery',
        '6 fields set',
        'Grace Akello rhd00001',
      ]);
    });

    it('says why when the log cannot be loaded, such as for a user the server refuses', async () => {
      backend({
        '/actcore/activity?': Object.assign(new Error('403'), {
          responseBody: { error: { message: 'Privilege required: View Audit Logs' } },
        }),
      });
      await signInWith(BOTH);

      renderPage();

      expect(await screen.findByText('Could not load the log')).toBeInTheDocument();
      expect(screen.getByText('Privilege required: View Audit Logs')).toBeInTheDocument();
    });

    it('says there is no activity yet, and that no entries match a filter', async () => {
      backend({ '/actcore/activity?': { results: [], totalCount: 0 } });
      await signInWith(BOTH);
      renderPage();

      expect(await screen.findByText('There is no activity to display')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('User'), 'nobody');
      expect(await screen.findByText('No entries match')).toBeInTheDocument();
    });
  });

  describe('Patients opened', () => {
    const open = async () => {
      await userEvent.click(screen.getByRole('tab', { name: /Patients opened/ }));
      await screen.findByText('Grace Akello');
    };

    it("folds a user's reads of one patient within an hour into one row, and notes a patient at another clinic", async () => {
      backend();
      await signInWith(BOTH);
      renderPage();

      await open();

      expect(rowTexts()).toEqual([
        [
          '',
          'Today, 07:41 to 07:48',
          'Joseph OdongocommunityClinician · Community Clinician',
          'Opened the chart3 times in 7 minutes',
          'Grace Akellorhd00001',
        ],
        [
          '',
          'Today, 07:17',
          'Joseph OdongocommunityClinician · Community Clinician',
          "Opened the chartthe patient record; the patient is at Uganda Heart Institute, not the user's clinic",
          'Patrick Ojokrhd00004',
        ],
        [
          '',
          'Yesterday, 16:02',
          'Joseph OdongocommunityClinician · Community Clinician',
          'Searched for "Akello", 4 results',
          'Patient search',
        ],
      ]);
    });

    it('says since when the reads are listed', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      expect(screen.getByTestId('log-window')).toHaveTextContent('Showing since 22-Oct-2025');
    });

    it('expands a row to each read with its time, the session, where it came from and the clinic comparison', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      const detail = await expand(0);

      expect(within(detail).getByText('What was read')).toBeInTheDocument();
      expect(
        within(detail)
          .getAllByRole('term')
          .map((one) => one.textContent),
      ).toEqual(['07:41:20', '07:44:00', '07:48:17']);
      expect(definitions(detail)).toEqual([
        'the patient record, 2 encounters and their 9 observations',
        'the BPG Delivery encounters',
        'every encounter',
      ]);
      expect(line(detail, 'Session')).toHaveTextContent('ED97E5A1');
      expect(line(detail, 'From')).toHaveTextContent('172.21.0.1, Chrome on macOS');
      expect(line(detail, "Patient's clinic")).toHaveTextContent("Akunalaber HCIII, the same as the user's: expected");
      expect(within(detail).getByRole('link', { name: 'Every read in the audit module' })).toHaveAttribute(
        'href',
        '/openmrs/module/auditlogweb/readauditlogs.form',
      );
    });

    it('folds the patient filter into the request beside the shared ones', async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      await userEvent.type(screen.getByLabelText('Patient'), 'rhd00001');
      await userEvent.type(screen.getByLabelText('User'), 'communityClinician');

      await waitFor(() =>
        expect(lastUrl(calls, '/actcore/reads?')).toBe(
          '/ws/rest/v1/actcore/reads?username=communityClinician&patient=rhd00001&startIndex=0&limit=20',
        ),
      );
    });
  });

  describe('Downloads', () => {
    const open = async () => {
      await userEvent.click(screen.getByRole('tab', { name: /Downloads/ }));
      await screen.findByText('Registry list');
    };

    it('lists each download with its fields, period, rows and identifiers, and sums them up above', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();

      await open();

      expect(rowTexts()).toEqual([
        [
          '',
          'Today, 10:50',
          'Sarah Namusokeclinician · Clinician',
          'Downloaded3 fields, All dates',
          'RHD BPG Delivery',
          '8',
          'With identifiers',
        ],
        [
          '',
          'Today, 10:49',
          'James KatoinstanceAdmin · Instance Administrator',
          'Downloaded1 fields, 2026-07-01 to 2026-09-30',
          'RHD Consultation Visit',
          '412',
          'Without identifiers',
        ],
        [
          '',
          'Yesterday, 09:03',
          'Peter OcensiteAdmin · Site Administrator',
          'DownloadedRegistry list, 4 columns',
          'Registry list',
          '486',
          'With identifiers',
        ],
      ]);
      expect(screen.getByTestId('downloads-summary')).toHaveTextContent(
        '3downloads2with identifiers3users906rows in total',
      );
      expect(screen.getByTestId('log-window')).toHaveTextContent('Showing since 22-Oct-2025');
    });

    it('expands a download to the fields in the file, those left out, why identifiers were kept, and when it was recorded', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      let detail = await expand(0);
      expect(within(detail).getByTestId('fields-in-file')).toHaveTextContent('ACT IDGiven nameDate of Injection');
      expect(within(detail).getByTestId('fields-left-out')).toHaveTextContent('None');
      expect(within(detail).getByTestId('why-identifiers')).toHaveTextContent(
        'The user holds Task: act.downloadIdentifiers',
      );
      expect(line(detail, 'Recorded')).toHaveTextContent(/10:50:31/);
      expect(line(detail, 'Patients')).toHaveTextContent('Every patient on the registry');

      detail = await expand(1);
      expect(within(detail).getByTestId('fields-left-out')).toHaveTextContent('Given namePrimary Phone');
      expect(within(detail).queryByText('Why identifiers were included')).not.toBeInTheDocument();
      expect(line(detail, 'Period')).toHaveTextContent('2026-07-01 to 2026-09-30');
    });

    it('folds the form and identifiers filters into the request, and fetches every matching download', async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await open();
      expect(lastUrl(calls, '/actcore/download?')).toBe('/ws/rest/v1/actcore/download?startIndex=0&limit=100');

      await userEvent.selectOptions(screen.getByLabelText('Form'), 'f-bpg');
      await userEvent.selectOptions(screen.getByLabelText('Identifiers'), 'with');

      await waitFor(() =>
        expect(lastUrl(calls, '/actcore/download?')).toBe(
          '/ws/rest/v1/actcore/download?form=f-bpg&identifiers=with&startIndex=0&limit=100',
        ),
      );
    });

    it('records its own CSV as a Logs download without identifiers', async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

      await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
      expect(calls.find((call) => call.url.endsWith('/actcore/download/record'))?.body).toEqual({
        list: 'logs:downloads',
        columns: ['Time', 'User', 'Target', 'Fields', 'Period', 'Rows', 'Identifiers'],
        rows: 3,
        identifiers: false,
        filters: {},
      });
    });
  });

  describe('Sign-ins', () => {
    const open = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Sign-ins' }));
      await screen.findByText('Signed in');
    };

    it("lists sign-ins, failures and sign-outs from the audit module's security log, with the week's failures counted", async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();

      await open();

      expect(rowTexts()).toEqual([
        ['', 'Today, 07:39', 'communityClinician', 'Signed inChrome on macOS', '172.21.0.1'],
        ['', 'Today, 07:38', 'communityClinician', 'Sign-in failedInvalid credential', '172.21.0.1'],
        ['', 'Yesterday, 18:10', 'dataClerk', 'Signed out', '172.21.0.9'],
      ]);
      expect(await screen.findByTestId('failed-sign-ins')).toHaveTextContent('Failed sign-ins in the last 7 days: 9');
      expect(lastUrl(calls, '/securityauditlogs?page')).toBe('/ws/rest/v1/securityauditlogs?page=0&size=20');
      expect(lastUrl(calls, 'eventType=LOGIN_FAILURE')).toMatch(
        /^\/ws\/rest\/v1\/securityauditlogs\?eventType=LOGIN_FAILURE&startDate=\d{2}%2F\d{2}%2F\d{4}&page=0&size=1$/,
      );
    });

    it("pages by the audit module's page number and size, and folds the shared filters into its parameters, with its DD/MM/YYYY dates", async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      await userEvent.click(screen.getByRole('button', { name: /next page/i }));
      await waitFor(() =>
        expect(lastUrl(calls, '/securityauditlogs?page')).toBe('/ws/rest/v1/securityauditlogs?page=1&size=20'),
      );

      await userEvent.type(screen.getByLabelText('User'), 'dataClerk');
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-14' } });
      await waitFor(() =>
        expect(lastUrl(calls, '/securityauditlogs?username')).toBe(
          '/ws/rest/v1/securityauditlogs?username=dataClerk&startDate=14%2F10%2F2026&page=0&size=20',
        ),
      );
    });

    it("counts the week's failures for the user the table is filtered to, and says so", async () => {
      const calls = backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      await userEvent.type(screen.getByLabelText('User'), 'dataClerk');

      await waitFor(() =>
        expect(lastUrl(calls, 'eventType=LOGIN_FAILURE')).toMatch(
          /^\/ws\/rest\/v1\/securityauditlogs\?username=dataClerk&eventType=LOGIN_FAILURE&startDate=\d{2}%2F\d{2}%2F\d{4}&page=0&size=1$/,
        ),
      );
      expect(await screen.findByTestId('failed-sign-ins')).toHaveTextContent(
        'Failed sign-ins by dataClerk in the last 7 days: 9',
      );
    });

    it('expands a sign-in to its session, source and the link to the full security record', async () => {
      backend();
      await signInWith(BOTH);
      renderPage();
      await open();

      const detail = await expand(0);

      expect(line(detail, 'Session')).toHaveTextContent('ED97E5A1');
      expect(line(detail, 'From')).toHaveTextContent('172.21.0.1, Chrome on macOS');
      expect(
        within(detail).getByRole('link', { name: 'The full security record in the audit module' }),
      ).toHaveAttribute('href', '/openmrs/module/auditlogweb/securityauditlogs.form');
    });
  });
});
