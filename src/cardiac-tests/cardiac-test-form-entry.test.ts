import { describe, expect, it } from 'vitest';
import routes from '../routes.json';

describe('Cardiac test form entry workspace', () => {
  it("is a form entry window of the patient chart's group, beside the consultation form (AR-178)", () => {
    const window = routes.workspaceWindows2.find((w) => w.name === 'act-cardiac-test-form-entry');
    const workspace = routes.workspaces2.find((w) => w.name === 'act-cardiac-test-form-entry-workspace');

    expect(window).toMatchObject({ group: 'patient-chart', width: 'extra-wide', canMaximize: true });
    expect(workspace).toMatchObject({
      component: '@openmrs/esm-patient-forms-app#exportedPatientFormEntryWorkspace',
      window: window.name,
    });
  });
});
