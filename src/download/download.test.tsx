import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { downloadCsv } from '../table-filters/csv';
import { formFields } from './download.resource';
import DownloadData from './download.component';

vi.mock('../table-filters/csv', () => ({ downloadCsv: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const schema = {
  pages: [
    {
      sections: [
        {
          questions: [
            { label: 'Date of Echocardiogram', type: 'obs', questionOptions: { concept: 'echo-date' } },
            { label: 'Notes', type: 'markdown', questionOptions: {} },
            {
              label: 'Mitral valve',
              type: 'obsGroup',
              questionOptions: { concept: 'mitral-group' },
              questions: [{ label: 'Regurgitation', type: 'obs', questionOptions: { concept: 'mr' } }],
            },
            { label: 'Location', type: 'encounterLocation', questionOptions: {} },
            { label: 'Date again', type: 'obs', questionOptions: { concept: 'echo-date' } },
          ],
        },
      ],
    },
  ],
};

const forms = [
  { uuid: 'echo', name: 'RHD Echocardiogram', retired: false, resources: [{ name: 'JSON schema' }] },
  { uuid: 'old', name: 'Old form', retired: true, resources: [{ name: 'JSON schema' }] },
  { uuid: 'html', name: 'HTML form', retired: false, resources: [] },
];

function backendAnswers(
  result = { headers: ['ACT ID', 'Date of Echocardiogram'], rows: [['rhd00037', '2026-03-14']] },
) {
  const posts: Array<unknown> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === 'POST') {
      posts.push(init.body);
      return { data: { ...result, identifiers: false, researchOnly: true } } as never;
    }
    if (url.includes('/o3/forms/echo')) {
      return { data: schema } as never;
    }
    return { data: { results: forms } } as never;
  });
  return posts;
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DownloadData />
    </SWRConfig>,
  );
}

describe('formFields', () => {
  it("lists each observation question once, a group's under the group's label, and nothing else", () => {
    expect(formFields(schema)).toEqual([
      { concept: 'echo-date', label: 'Date of Echocardiogram' },
      { concept: 'mr', label: 'Mitral valve: Regurgitation' },
    ]);
  });
});

describe('DownloadData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the chosen fields of a form over the dates given as a CSV', async () => {
    await signInWith(['Task: act.downloadResearchData']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText(/the patients who opted in to research, without names, birth dates, ID numbers or phones/),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Form' }), 'echo');
    await user.click(await screen.findByRole('checkbox', { name: 'Mitral valve: Regurgitation' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-30' } });
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
    expect(posts).toEqual([
      {
        form: 'echo',
        fields: [{ concept: 'echo-date', label: 'Date of Echocardiogram' }],
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      },
    ]);
    expect(vi.mocked(downloadCsv).mock.calls[0][0]).toMatch(/^rhd-echocardiogram-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(vi.mocked(downloadCsv).mock.calls[0].slice(1)).toEqual([
      ['ACT ID', 'Date of Echocardiogram'],
      [['rhd00037', '2026-03-14']],
    ]);
  });

  it('says a clinician gets the identifiers', async () => {
    await signInWith(['Task: act.downloadData', 'Task: act.downloadIdentifiers']);
    backendAnswers();

    renderPage();

    expect(screen.getByText(/with the patient's names, birth date, ID numbers and phones/)).toBeInTheDocument();
  });

  it('shows nothing to a user who may not download', async () => {
    await signInWith(['Task: act.lists.export']);
    backendAnswers();

    const { container } = renderPage();

    expect(container).toBeEmptyDOMElement();
  });
});
