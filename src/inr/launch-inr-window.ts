import { launchWorkspace2 } from '@openmrs/esm-framework';
import { type FormLauncher } from '../visits/open-form-in-visit';

/** Opens the INR form in its own window, beside an open consultation rather than replacing it. */
export const launchInInrWindow: FormLauncher = (_workspaceName, workspaceProps) =>
  launchWorkspace2('act-inr-form-entry-workspace', workspaceProps);
