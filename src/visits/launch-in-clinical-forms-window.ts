import { getGlobalStore, launchWorkspace2, showModal } from '@openmrs/esm-framework';

/** The patient chart window that holds the clinical forms list and the form entry workspace. */
export const CLINICAL_FORMS_WINDOW = 'patient-chart-clinical-forms';

interface OpenedWorkspace {
  workspaceName: string;
  hasUnsavedChanges: boolean;
  title?: string;
}

interface OpenedWindow {
  windowName: string;
  openedWorkspaces: Array<OpenedWorkspace>;
}

interface Workspace2State {
  openedWindows: Array<OpenedWindow>;
  isMostRecentlyOpenedWindowHidden: boolean;
}

const workspaceStore = () =>
  getGlobalStore<Workspace2State>('workspace2', { openedWindows: [], isMostRecentlyOpenedWindowHidden: false });

/** The framework's own discard prompt, as launchWorkspace2 shows it; resolves true without one when nothing is unsaved. */
function confirmDiscarding(workspaces: Array<OpenedWorkspace>) {
  const unsaved = workspaces.filter((workspace) => workspace.hasUnsavedChanges);
  if (!unsaved.length) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    let dispose: (() => void) | undefined;
    const answer = (confirmed: boolean) => {
      dispose?.();
      resolve(confirmed);
    };
    dispose = showModal('workspace2-close-prompt', {
      size: 'sm',
      onConfirm: () => answer(true),
      onCancel: () => answer(false),
      affectedWorkspaceTitles: unsaved.map((workspace) => workspace.title ?? ''),
    });
  });
}

/**
 * Opens a workspace of the clinical forms window as its root, closing the window first when it is open with a
 * different workspace. launchWorkspace2 (esm-styleguide 10.0.1) checks whether the requested workspace is open, not
 * whether its window is, so opening the forms list over an open form, or a form over the list, adds a second window
 * of the same name; the framework then treats both as not the latest and hides both, and no later launch restores
 * them. Resolves false when the user keeps the open window's unsaved changes.
 */
export async function launchInClinicalFormsWindow(workspaceName: string, workspaceProps?: object): Promise<boolean> {
  const store = workspaceStore();
  // Defaulted, as the patient chart creates this store before the framework fills it.
  const openedWindows = store.getState().openedWindows ?? [];
  const index = openedWindows.findIndex((window) => window.windowName === CLINICAL_FORMS_WINDOW);
  const window = openedWindows[index];
  if (window && !window.openedWorkspaces.some((workspace) => workspace.workspaceName === workspaceName)) {
    if (!(await confirmDiscarding(window.openedWorkspaces))) {
      return false;
    }
    store.setState({
      openedWindows: (store.getState().openedWindows ?? []).filter((_, i) => i !== index),
      isMostRecentlyOpenedWindowHidden: false,
    });
  }
  return workspaceProps === undefined
    ? launchWorkspace2(workspaceName)
    : launchWorkspace2(workspaceName, workspaceProps);
}
