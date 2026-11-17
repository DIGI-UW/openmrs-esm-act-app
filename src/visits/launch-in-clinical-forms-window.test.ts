import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGlobalStore, launchWorkspace2, showModal } from '@openmrs/esm-framework';
import { CLINICAL_FORMS_WINDOW, launchInClinicalFormsWindow } from './launch-in-clinical-forms-window';

const openForm = { workspaceName: 'patient-form-entry-workspace', hasUnsavedChanges: false, title: 'RHD Echocardiogram' };
const formsList = { workspaceName: 'clinical-forms-workspace', hasUnsavedChanges: false, title: 'Clinical forms' };

let store: ReturnType<typeof createGlobalStore<{ openedWindows: Array<object>; isMostRecentlyOpenedWindowHidden: boolean }>>;

const windowWith = (...openedWorkspaces: Array<typeof openForm>) => ({
  windowName: CLINICAL_FORMS_WINDOW,
  openedWorkspaces,
  props: null,
  maximized: false,
});

describe('launchInClinicalFormsWindow', () => {
  beforeEach(() => {
    store = createGlobalStore('workspace2', { openedWindows: [], isMostRecentlyOpenedWindowHidden: false });
    store.setState({ openedWindows: [], isMostRecentlyOpenedWindowHidden: false });
    vi.mocked(launchWorkspace2).mockResolvedValue(true);
  });

  it('launches straight away when the window is not open', async () => {
    await launchInClinicalFormsWindow('clinical-forms-workspace');

    expect(launchWorkspace2).toHaveBeenCalledWith('clinical-forms-workspace');
    expect(showModal).not.toHaveBeenCalled();
  });

  it('closes the window first when it is open with another workspace, so the framework does not open a second one', async () => {
    const other = { windowName: 'patient-chart-order-basket', openedWorkspaces: [], props: null, maximized: false };
    store.setState({ openedWindows: [other, windowWith(openForm)], isMostRecentlyOpenedWindowHidden: true });

    await launchInClinicalFormsWindow('clinical-forms-workspace');

    expect(store.getState().openedWindows).toEqual([other]);
    expect(store.getState().isMostRecentlyOpenedWindowHidden).toBe(false);
    expect(launchWorkspace2).toHaveBeenCalledWith('clinical-forms-workspace');
  });

  it('leaves the window to the framework when the workspace is already open in it', async () => {
    store.setState({ openedWindows: [windowWith(formsList, openForm)] });

    await launchInClinicalFormsWindow('patient-form-entry-workspace', { form: 'f' });

    expect(store.getState().openedWindows).toHaveLength(1);
    expect(launchWorkspace2).toHaveBeenCalledWith('patient-form-entry-workspace', { form: 'f' });
  });

  it('asks before discarding unsaved changes, and keeps the window when the user cancels', async () => {
    store.setState({ openedWindows: [windowWith({ ...openForm, hasUnsavedChanges: true })] });
    const dispose = vi.fn();
    // The modal answers after it has rendered, as the framework's does.
    vi.mocked(showModal).mockImplementation((_name, props: { onCancel: () => void }) => {
      queueMicrotask(() => props.onCancel());
      return dispose;
    });

    const launched = await launchInClinicalFormsWindow('clinical-forms-workspace');

    expect(launched).toBe(false);
    expect(showModal).toHaveBeenCalledWith(
      'workspace2-close-prompt',
      expect.objectContaining({ affectedWorkspaceTitles: ['RHD Echocardiogram'] }),
    );
    expect(dispose).toHaveBeenCalled();
    expect(store.getState().openedWindows).toHaveLength(1);
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('discards and launches when the user confirms', async () => {
    store.setState({ openedWindows: [windowWith({ ...openForm, hasUnsavedChanges: true })] });
    vi.mocked(showModal).mockImplementation((_name, props: { onConfirm: () => void }) => {
      queueMicrotask(() => props.onConfirm());
      return vi.fn();
    });

    const launched = await launchInClinicalFormsWindow('clinical-forms-workspace');

    expect(launched).toBe(true);
    expect(store.getState().openedWindows).toEqual([]);
    expect(launchWorkspace2).toHaveBeenCalledWith('clinical-forms-workspace');
  });
});
