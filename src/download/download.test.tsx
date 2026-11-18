import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  {
    uuid: 'echo',
    name: 'RHD Echocardiogram',
    display: 'Echocardiogram',
    retired: false,
    resources: [{ name: 'JSON schema' }],
  },
  {
    uuid: 'consult',
    name: 'RHD Consultation Visit',
    display: 'Consultation Visit',
    retired: false,
    resources: [{ name: 'JSON schema' }],
  },
  { uuid: 'old', name: 'Old form', retired: true, resources: [{ name: 'JSON schema' }] },
  { uuid: 'html', name: 'HTML form', retired: false, resources: [] },
];

const consultSchema = {
  pages: [{ sections: [{ questions: [{ label: 'NYHA', type: 'obs', questionOptions: { concept: 'nyha' } }] }] }],
};

const cardiacClinics = [{ uuid: 'uhi', display: 'Uganda Heart Institute' }];
const primaryCareClinics = [{ uuid: 'acimi', display: 'Acimi HCIII' }];

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
    if (url.includes('/o3/forms/consult')) {
      return { data: consultSchema } as never;
    }
    if (url.includes('/location?tag=')) {
      return { data: { results: url.includes('Community') ? primaryCareClinics : cardiacClinics } } as never;
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

  it('heads the page with the export pictogram', async () => {
    await signInWith(['Task: act.downloadResearchData']);
    backendAnswers();
    renderPage();

    expect(within(screen.getByTestId('act-page-header')).getByText('MetadataExportPictogram')).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Echocardiogram' })).toBeInTheDocument();
  });

  it('downloads the chosen fields of a form over the dates given as a CSV', async () => {
    await signInWith(['Task: act.downloadResearchData']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText(/the patients who opted in to research, without names, birth dates, ID numbers or phones/),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: 'Echocardiogram' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Mitral valve: Regurgitation' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-30' } });
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
    expect(posts).toEqual([
      {
        forms: [{ form: 'echo', fields: [{ concept: 'echo-date', label: 'Date of Echocardiogram' }] }],
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        patient: ['sex', 'age'],
      },
    ]);
    expect(vi.mocked(downloadCsv).mock.calls[0][0]).toMatch(/^echocardiogram-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(vi.mocked(downloadCsv).mock.calls[0].slice(1)).toEqual([
      ['ACT ID', 'Date of Echocardiogram'],
      [['rhd00037', '2026-03-14']],
    ]);
  });

  it('lists each form by the name users see, as the server displays it', async () => {
    await signInWith(['Task: act.downloadResearchData']);
    backendAnswers();
    renderPage();

    expect(await screen.findByRole('checkbox', { name: 'Echocardiogram' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Consultation Visit' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'RHD Echocardiogram' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Old form' })).not.toBeInTheDocument();
  });

  it('downloads several forms as a row per patient, each form with its own fields', async () => {
    await signInWith(['Task: act.downloadData']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Echocardiogram' }));
    await user.click(screen.getByRole('checkbox', { name: 'Consultation Visit' }));
    const consult = await screen.findByRole('group', { name: /Consultation Visit: 1 of 1 fields/ });
    await user.click(
      within(screen.getByRole('group', { name: /Echocardiogram: 2 of 2 fields/ })).getByRole('button', {
        name: 'Uncheck all',
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Date of Echocardiogram' }));
    expect(within(consult).getByRole('checkbox', { name: 'NYHA' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'A row per saved form' })).not.toBeInTheDocument();
    expect(screen.getByText(/A row per patient, each form's saves numbered/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
    expect(posts).toEqual([
      {
        forms: [
          { form: 'echo', fields: [{ concept: 'echo-date', label: 'Date of Echocardiogram' }] },
          { form: 'consult', fields: [{ concept: 'nyha', label: 'NYHA' }] },
        ],
        startDate: null,
        endDate: null,
        patient: ['sex', 'age'],
      },
    ]);
    expect(vi.mocked(downloadCsv).mock.calls[0][0]).toMatch(/^act-download-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('gives one form as a row per patient when asked', async () => {
    await signInWith(['Task: act.downloadData']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Echocardiogram' }));
    await screen.findByRole('checkbox', { name: 'Date of Echocardiogram' });
    expect(screen.getByRole('radio', { name: 'A row per saved form' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'A row per patient' }));
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ rowPerPatient: true });
  });

  it('sends the status and clinics chosen, and leaves out the ones not chosen', async () => {
    await signInWith(['Task: act.downloadData']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Echocardiogram' }));
    await screen.findByRole('checkbox', { name: 'Date of Echocardiogram' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'active');
    await waitFor(() =>
      expect(within(screen.getByRole('combobox', { name: 'Cardiac clinic' })).getAllByRole('option')).toHaveLength(2),
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cardiac clinic' }), 'uhi');
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ status: 'active', cardiacClinic: 'uhi' });
    expect(posts[0]).not.toHaveProperty('primaryCareClinic');
  });

  it("sends the patient fields ticked, in ACT Core's order, a clinician's identifying ones unticked until chosen", async () => {
    await signInWith(['Task: act.downloadData', 'Task: act.downloadIdentifiers']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Echocardiogram' }));
    await screen.findByRole('checkbox', { name: 'Date of Echocardiogram' });
    const patient = screen.getByRole('group', { name: /Patient: 2 of 7 fields/ });
    expect(within(patient).getByRole('checkbox', { name: 'Given name' })).not.toBeChecked();
    expect(within(patient).getByRole('checkbox', { name: 'Phone numbers' })).not.toBeChecked();
    expect(within(patient).getByRole('checkbox', { name: 'Sex' })).toBeChecked();
    await user.click(within(patient).getByRole('checkbox', { name: 'Phone numbers' }));
    await user.click(within(patient).getByRole('checkbox', { name: 'Given name' }));
    await user.click(within(patient).getByRole('checkbox', { name: 'Age' }));
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ patient: ['givenName', 'phones', 'sex'] });
  });

  it('offers only sex and age to a user who may not download identifiers, and sends none once unchecked', async () => {
    await signInWith(['Task: act.downloadData']);
    const posts = backendAnswers();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Echocardiogram' }));
    await screen.findByRole('checkbox', { name: 'Date of Echocardiogram' });
    const patient = screen.getByRole('group', { name: /Patient: 2 of 2 fields/ });
    expect(
      within(patient)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('id')),
    ).toEqual(['download-patient-sex', 'download-patient-age']);
    await user.click(within(patient).getByRole('button', { name: 'Uncheck all' }));
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ patient: [] });
  });

  it('offers only sex and age to a research-only user, even one who holds the identifiers privilege', async () => {
    await signInWith(['Task: act.downloadResearchData', 'Task: act.downloadIdentifiers']);
    backendAnswers();
    renderPage();

    expect(await screen.findByRole('group', { name: /Patient: 2 of 2 fields/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Given name' })).not.toBeInTheDocument();
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
