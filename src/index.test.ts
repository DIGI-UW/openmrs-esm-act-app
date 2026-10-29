import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import routeFile from './routes.json';
import { inrTrendSlot } from './inr/inr-chart-control.component';

const registered: Array<{ name: string; type: string }> = [];
vi.mock('./forms-engine-registry', () => ({
  registerControl: (control: { name: string; type: string }) => registered.push(control),
}));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAsyncLifecycle: () => ({}),
  getSyncLifecycle: () => ({}),
  createDashboard: () => ({}),
  defineConfigSchema: () => undefined,
  defineExtensionConfigSchema: () => undefined,
}));
vi.mock('./allergies/allergies.resource', () => ({ registerAllergies: vi.fn() }));
vi.mock('./prophylaxis/next-injection-due', () => ({ registerNextInjectionDue: vi.fn() }));
vi.mock('./back-to-act/act-return', () => ({ trackActReturn: vi.fn() }));

// The runner's `require` is a function, so webpack's `require.context` is given through its prototype.
beforeAll(() => {
  (Function.prototype as any).context = () => vi.fn();
});
afterAll(() => {
  delete (Function.prototype as any).context;
});

const routes = routeFile as unknown as {
  extensions: Array<{ name: string; slot?: string; component: string }>;
};

describe('the INR chart on the consultation form', () => {
  it('registers a form control named act-inr-chart at startup', async () => {
    const app = await import('./index');

    app.startupApp();

    expect(registered).toEqual([expect.objectContaining({ name: 'act-inr-chart', type: 'control' })]);
  });

  it('attaches its trend extension to the slot the control hosts, by a component the app exports', async () => {
    const app = await import('./index');
    const extension = routes.extensions.find((candidate) => candidate.name === 'act-consultation-inr-trend');

    expect(extension?.slot).toBe(inrTrendSlot);
    expect(Object.keys(app)).toContain(extension?.component);
  });
});
