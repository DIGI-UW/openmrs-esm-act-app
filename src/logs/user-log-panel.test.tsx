import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { activityEntries, downloadEntries, readEntries, signInEntries } from './logs.fixture';
import { UserLogPanel } from './user-log-panel.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

/** Each source answers its fixture, and a count request (limit=1) the week's total. */
function backend() {
  const urls: Array<string> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string) => {
    urls.push(url);
    const count = url.includes('limit=1&') || url.endsWith('limit=1') || url.endsWith('size=1');
    if (url.includes('/actcore/activity?')) {
      return { data: { results: count ? [] : activityEntries.slice(0, 2), totalCount: count ? 14 : 2 } };
    }
    if (url.includes('/actcore/reads?')) {
      return { data: { results: count ? [] : readEntries.slice(0, 1), totalCount: count ? 31 : 1 } };
    }
    if (url.includes('/actcore/download?')) {
      return { data: { results: count ? [] : downloadEntries.slice(2), totalCount: count ? 0 : 1 } };
    }
    if (url.includes('/securityauditlogs?')) {
      return { data: { securityAuditLogs: signInEntries.slice(0, 1), totalLogs: 1 } };
    }
    return { data: { results: [] } };
  }) as never);
  return urls;
}

const renderPanel = (onClose = vi.fn()) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <UserLogPanel
        username="dataClerk2"
        name="Mary Achen"
        subtitle="dataClerk2 · Data Clerk · Acimi HCIII"
        onClose={onClose}
      />
    </SWRConfig>,
  );

describe('UserLogPanel', () => {
  beforeEach(() => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it("shows the user's latest entries from the four sources merged newest first, with the week's counts and a link to Logs", async () => {
    const urls = backend();
    await signInWith(['View Audit Logs', 'View Read Audit Logs', 'View Security Audit Logs']);

    renderPanel();

    expect(screen.getByRole('heading', { name: "Mary Achen's log" })).toBeInTheDocument();
    expect(screen.getByText('dataClerk2 · Data Clerk · Acimi HCIII')).toBeInTheDocument();
    await screen.findByText('Saved RHD BPG Delivery');
    const entries = screen.getAllByRole('definition').map((entry) => entry.textContent);
    expect(entries).toEqual([
      'Saved RHD BPG Delivery for Grace Akellorhd000016 fields set',
      'Edited RHD Oral Adherence for Samuel Okellorhd000022 fields changed: Date of Adherence Estimate, Adherence',
      'Opened the chart of Grace Akello3 reads',
      'Signed in',
      'Downloaded Registry list486 rows',
    ]);
    await waitFor(() =>
      expect(screen.getByTestId('log-counts')).toHaveTextContent('14forms saved, 7 days31patients opened0downloads'),
    );
    expect(screen.getByRole('link', { name: 'Everything in Logs' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-logs?user=dataClerk2',
    );
    expect(urls).toContain('/ws/rest/v1/actcore/activity?username=dataClerk2&startIndex=0&limit=10');
    expect(urls).toContain('/ws/rest/v1/securityauditlogs?username=dataClerk2&page=0&size=10');
    expect(urls.find((url) => url.includes('kind=saved'))).toMatch(
      /^\/ws\/rest\/v1\/actcore\/activity\?username=dataClerk2&kind=saved&startDate=\d{4}-\d{2}-\d{2}&startIndex=0&limit=1$/,
    );
  });

  it('reads only the sources the signed-in administrator may: changes alone for View Audit Logs alone', async () => {
    const urls = backend();
    await signInWith(['View Audit Logs']);

    renderPanel();

    await screen.findByText('Saved RHD BPG Delivery');
    expect(screen.queryByText(/Opened the chart/)).not.toBeInTheDocument();
    expect(screen.queryByText('patients opened')).not.toBeInTheDocument();
    expect(
      urls.some(
        (url) =>
          url.includes('/actcore/reads') || url.includes('/actcore/download') || url.includes('securityauditlogs'),
      ),
    ).toBe(false);
    expect(screen.queryByText('Signed in')).not.toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).queryByText('Opened')).not.toBeInTheDocument();
  });

  it('closes from its button', async () => {
    backend();
    await signInWith(['View Audit Logs']);
    const onClose = vi.fn();
    renderPanel(onClose);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
