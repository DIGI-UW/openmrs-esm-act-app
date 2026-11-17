import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar, Workspace2 } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import StudyFormWorkspace from './study-form.workspace';
import { backendAnswers } from './studies.test-helper';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const closeWorkspace = vi.fn();
const onRenamed = vi.fn();
const reloadParticipants = vi.fn();

function renderWorkspace(studyUuid?: string) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <StudyFormWorkspace
        workspaceProps={{ studyUuid, onRenamed }}
        windowProps={null}
        groupProps={null}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-study-form-workspace"
        windowName="act-studies-form"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}

describe('Study form workspace', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['App: act.studies', 'Task: act.manageStudies']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [],
      isLoading: false,
      error: undefined,
      mutate: reloadParticipants,
    });
  });

  it("says why a study could not be saved, from the server's exception when it has no validation errors", async () => {
    backendAnswers({ message: '[Could not save the program]' });
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Study name'), 'Stage Study 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('[Could not save the program]')).toBeInTheDocument();
  });

  it('creates a study by name', async () => {
    const posts = backendAnswers();
    renderWorkspace();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name for the study')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Study name'), '  Stage Study 2 ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toEqual([{ url: '/ws/rest/v1/actcore/studies', body: { name: 'Stage Study 2' } }]),
    );
  });

  it('says so when the study to rename is not among the studies loaded', async () => {
    backendAnswers();
    renderWorkspace('nope');

    expect(await screen.findByText('Could not load this study')).toBeInTheDocument();
  });

  it('reloads the studies after a save', async () => {
    backendAnswers();
    renderWorkspace();
    const studyLoads = () =>
      vi.mocked(openmrsFetch).mock.calls.filter(([url, init]) => !init?.method && String(url).endsWith('/studies'))
        .length;
    await userEvent.type(screen.getByLabelText('Study name'), 'Stage Study 2');
    await waitFor(() => expect(studyLoads()).toBe(1));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(studyLoads()).toBe(2));
  });

  it('reloads the participants after a rename, as their rows carry the study name', async () => {
    const posts = backendAnswers();
    renderWorkspace('arc');
    await screen.findByLabelText('Study name');
    await userEvent.clear(screen.getByLabelText('Study name'));
    await userEvent.type(screen.getByLabelText('Study name'), 'ARC 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(posts).toEqual([{ url: '/ws/rest/v1/actcore/studies/arc', body: { name: 'ARC 2' } }]));
    await waitFor(() => expect(reloadParticipants).toHaveBeenCalled());
    expect(onRenamed).toHaveBeenCalledWith('ARC', 'ARC 2');
    expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
  });

  it("says why a study could not be renamed, in the server's words", async () => {
    backendAnswers({ globalErrors: [{ message: 'A program is already named Miller' }] });
    renderWorkspace('arc');
    await screen.findByLabelText('Study name');
    await userEvent.clear(screen.getByLabelText('Study name'));
    await userEvent.type(screen.getByLabelText('Study name'), 'Miller');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('A program is already named Miller')).toBeInTheDocument();
  });

  it('creates a study without reporting a rename, and closes the workspace', async () => {
    backendAnswers();
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Study name'), 'Stage Study 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: 'Study saved' }));
    expect(reloadParticipants).toHaveBeenCalled();
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it('keeps the workspace open when the save fails', async () => {
    backendAnswers({ message: 'Down' });
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Study name'), 'Stage Study 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Down')).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it('asks the framework to guard unsaved changes only once the name is edited, and cancels on Cancel', async () => {
    backendAnswers();
    renderWorkspace('arc');
    await screen.findByLabelText('Study name');
    const guard = () => vi.mocked(Workspace2).mock.lastCall[0].hasUnsavedChanges;
    expect(guard()).toBe(false);

    await userEvent.type(screen.getByLabelText('Study name'), '2');
    expect(guard()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
  });
});
