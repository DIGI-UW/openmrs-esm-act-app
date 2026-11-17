import { describe, expect, it } from 'vitest';
import routes from '../routes.json';

describe('Vitals form workspace', () => {
  it("is the vitals app's form in a window of the patient chart's group, beside the consultation form (AR-144)", () => {
    const window = routes.workspaceWindows2.find((w) => w.name === 'act-vitals-form');
    const workspace = routes.workspaces2.find((w) => w.name === 'act-vitals-form-workspace');

    expect(window).toMatchObject({ group: 'patient-chart' });
    expect(workspace).toMatchObject({
      component: '@openmrs/esm-patient-vitals-app#vitalsBiometricsFormWorkspace',
      window: window.name,
    });
  });
});
