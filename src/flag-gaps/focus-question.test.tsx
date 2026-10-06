import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { fetchForm, type FlagGap, usePatientFlagGaps } from './flag-gaps.resource';
import FlagGapsWorkspace from './flag-gaps.workspace';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('./flag-gaps.resource', () => ({
  usePatientFlagGaps: vi.fn(),
  fetchForm: vi.fn(),
}));

const form = {
  uuid: 'form-uuid',
  name: 'Procedures and Outcomes',
  resources: [{ name: 'JSON schema', valueReference: 'schema-clob' }],
};

// A form schema as the form builder saves it: pages of sections of questions, some inside an obs group.
const schema = {
  name: 'Procedures and Outcomes',
  pages: [
    {
      label: 'Procedure',
      sections: [
        {
          label: 'Procedure',
          questions: [
            { id: 'procedureDate', questionOptions: { rendering: 'date', concept: 'procedure-date-uuid' } },
            {
              id: 'outcomes',
              questionOptions: { rendering: 'group', concept: 'outcomes-group-uuid' },
              questions: [
                { id: 'perfusionIssues', questionOptions: { rendering: 'radio', concept: 'perfusion-uuid' } },
                { id: 'siteInfection', questionOptions: { rendering: 'select', concept: 'site-infection-uuid' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function gap(concept: string): FlagGap {
  return {
    encounter: 'encounter-1',
    encounterDatetime: '2026-09-10T09:00:00.000+0000',
    form: { uuid: 'form-uuid', display: 'Procedures and Outcomes' },
    concept: { uuid: concept, display: 'Missing question' },
  };
}

function showWorkspace(gaps: Array<FlagGap>) {
  vi.mocked(usePatientFlagGaps).mockReturnValue({
    flagGaps: [{ flagUuid: 'flag-uuid', flagName: 'RHD flag', configured: true, gaps }],
    isLoading: false,
    error: undefined,
  });
  const launchChildWorkspace = vi.fn();
  render(
    <FlagGapsWorkspace
      workspaceProps={{ patientUuid: 'patient-uuid', flagUuid: 'flag-uuid', flagName: 'RHD flag' }}
      windowProps={null}
      groupProps={{ patientUuid: 'patient-uuid' }}
      launchChildWorkspace={launchChildWorkspace}
      closeWorkspace={vi.fn()}
      workspaceName="rhd-flag-gaps-workspace"
      windowName="patient-chart-clinical-forms"
      isRootWorkspace
      showActionMenu={false}
    />,
  );
  return launchChildWorkspace;
}

/** Renders questions as the form engine does once the form entry workspace has loaded the form. */
function renderForm(questions: React.ReactNode) {
  render(<form>{questions}</form>);
}

// Carbon's Dropdown, which the engine renders a select with, puts the question id on a wrapper around its button.
const siteInfection = (
  <div id="siteInfection" className="cds--list-box">
    <button type="button" aria-label="Site infection" />
  </div>
);

describe('flag gaps workspace opening the form at the missing question', () => {
  let questionTop = 0;
  const scrolled: Array<Element> = [];
  const scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this);
  });

  beforeEach(() => {
    scrolled.length = 0;
    questionTop = 0;
    Element.prototype.scrollIntoView = scrollIntoView;
    // Where the question sits; a test moves it to stand for the form filling in above it.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top: questionTop }) as DOMRect);
    vi.mocked(fetchForm).mockResolvedValue(form);
    vi.mocked(openmrsFetch).mockImplementation(async (url: string) => {
      if (url.endsWith('/clobdata/schema-clob')) {
        return { data: schema } as never;
      }
      throw new Error(`unexpected ${url}`);
    });
  });

  it('focuses the question the gap names once the form engine renders it, and scrolls it into view', async () => {
    const launch = showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    expect(launch).toHaveBeenCalledWith('patient-form-entry-workspace', { form, encounterUuid: 'encounter-1' });
    renderForm(
      <>
        <input id="procedureDate" aria-label="Procedure date" />
        {siteInfection}
      </>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Site infection' })).toHaveFocus());
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toContainElement(screen.getByRole('button', { name: 'Site infection' }));
  });

  it('scrolls the question back into view when the form fills in above it and pushes it down', async () => {
    showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(siteInfection);
    await waitFor(() => expect(scrolled).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    questionTop = 1200;

    await waitFor(() => expect(scrolled).toHaveLength(2));
  });

  it('leaves the scrolling to the user once they scroll', async () => {
    showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(siteInfection);
    await waitFor(() => expect(scrolled).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.wheel(screen.getByRole('button', { name: 'Site infection' }));
    questionTop = 1200;
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(scrolled).toHaveLength(1);
  });

  it.each([
    ['clicks', (target: Element) => fireEvent.pointerDown(target)],
    ['types', (target: Element) => fireEvent.keyDown(target, { key: 'a' })],
    ['touches the screen', (target: Element) => fireEvent.touchStart(target)],
  ])('leaves the scrolling to the user once they %s', async (_, takeOver) => {
    showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(siteInfection);
    await waitFor(() => expect(scrolled).toHaveLength(1));
    takeOver(screen.getByRole('button', { name: 'Site infection' }));
    questionTop = 1200;
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(scrolled).toHaveLength(1);
  });

  it('stops keeping the question in view once the form has had time to settle', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
      shouldAdvanceTime: true,
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    showWorkspace([gap('site-infection-uuid')]);

    await user.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(siteInfection);
    await waitFor(() => expect(scrolled).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(3_100);
    questionTop = 1200;
    await vi.advanceTimersByTimeAsync(200);
    vi.useRealTimers();

    expect(scrolled).toHaveLength(1);
  });

  it('gives up waiting for the question after 15 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    showWorkspace([gap('site-infection-uuid')]);

    await user.click(screen.getByRole('button', { name: /open form/i }));
    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(15_100);
    renderForm(siteInfection);
    await vi.advanceTimersByTimeAsync(50);
    vi.useRealTimers();

    expect(screen.getByRole('button', { name: 'Site infection' })).not.toHaveFocus();
    expect(scrolled).toHaveLength(0);
  });

  it('focuses the first field of a date question, whose id the date picker puts on its group', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        pages: [
          {
            sections: [
              {
                questions: [{ id: 'followUpDate', questionOptions: { rendering: 'date', concept: 'follow-up-uuid' } }],
              },
            ],
          },
        ],
      },
    } as never);
    showWorkspace([gap('follow-up-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(
      <div id="followUpDate" role="group" aria-label="Follow-up date">
        <span role="spinbutton" tabIndex={0} aria-label="day" aria-valuenow={1} />
        <span role="spinbutton" tabIndex={0} aria-label="month" aria-valuenow={1} />
      </div>,
    );

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'day' })).toHaveFocus());
  });

  it("finds a radio question by its buttons' name, as the form engine renders radios", async () => {
    showWorkspace([gap('perfusion-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(
      <>
        <input type="radio" name="perfusionIssues" id="perfusionIssues-Yes" aria-label="Yes" />
        <input type="radio" name="perfusionIssues" id="perfusionIssues-No" aria-label="No" />
      </>,
    );

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Yes' })).toHaveFocus());
  });

  it('focuses a question already rendered when the schema arrives', async () => {
    renderForm(siteInfection);
    showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Site infection' })).toHaveFocus());
  });

  it('ignores an element with the same id outside a form', async () => {
    render(
      <div id="siteInfection">
        <button type="button" aria-label="Outside" />
      </div>,
    );
    showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(siteInfection);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Site infection' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Outside' })).not.toHaveFocus();
  });

  it('leaves the form at the top when no question of the form records the concept', async () => {
    const launch = showWorkspace([gap('not-on-the-form-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));
    renderForm(
      <>
        <input id="procedureDate" aria-label="Procedure date" />
        {siteInfection}
      </>,
    );

    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    expect(launch).toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Procedure date' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Site infection' })).not.toHaveFocus();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('still opens the form when its schema cannot be read', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('forbidden'));
    const launch = showWorkspace([gap('site-infection-uuid')]);

    await userEvent.click(screen.getByRole('button', { name: /open form/i }));

    expect(launch).toHaveBeenCalledWith('patient-form-entry-workspace', { form, encounterUuid: 'encounter-1' });
    expect(showSnackbar).not.toHaveBeenCalled();
  });
});
