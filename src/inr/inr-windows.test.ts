import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import routeFile from '../routes.json';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAsyncLifecycle: () => ({}),
  getSyncLifecycle: () => ({}),
  createDashboard: () => ({}),
  defineConfigSchema: () => undefined,
  defineExtensionConfigSchema: () => undefined,
}));
vi.mock('../allergies/allergies.resource', () => ({ registerAllergies: vi.fn() }));
vi.mock('../prophylaxis/next-injection-due', () => ({ registerNextInjectionDue: vi.fn() }));
vi.mock('../back-to-act/act-return', () => ({ trackActReturn: vi.fn() }));

// The runner's `require` is a function, so webpack's `require.context` is given through its prototype.
beforeAll(() => {
  (Function.prototype as any).context = () => vi.fn();
});
afterAll(() => {
  delete (Function.prototype as any).context;
});

const routes = routeFile as unknown as {
  workspaceWindows2: Array<{ name: string; group: string; icon?: string }>;
  workspaces2: Array<{ name: string; component: string; window: string }>;
};

const windows: Array<[workspace: string, window: string, component: string]> = [
  ['act-inr-trend-workspace', 'act-inr-trend', 'inrTrendWorkspace'],
  ['act-inr-edit-workspace', 'act-inr-monitoring', 'inrEditWorkspace'],
  ['act-inr-form-entry-workspace', 'act-inr-form-entry', '@openmrs/esm-patient-forms-app#patientFormEntryWorkspace'],
];

describe('the INR windows in routes.json', () => {
  it.each(windows)('opens %s in the window %s of the patient chart group, by %s', (workspace, window, component) => {
    const found = routes.workspaces2.find((candidate) => candidate.name === workspace);

    expect(found).toMatchObject({ window, component });
    expect(routes.workspaceWindows2.find((candidate) => candidate.name === window)?.group).toBe('patient-chart');
  });

  it('gives the trend window a side rail button, and the app exports it and the workspaces it names', async () => {
    const app = await import('../index');
    const trend = routes.workspaceWindows2.find((candidate) => candidate.name === 'act-inr-trend');

    expect(trend?.icon).toBe('inrTrendActionButton');
    expect(Object.keys(app)).toEqual(
      expect.arrayContaining(['inrTrendActionButton', 'inrTrendWorkspace', 'inrEditWorkspace']),
    );
  }, 30_000);
});
