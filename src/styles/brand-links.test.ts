import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
vi.mock('../vitals/visit-vitals.resource', () => ({ registerVisitVitals: vi.fn() }));

// The runner's `require` is a function, so webpack's `require.context` is given through its prototype.
beforeAll(() => {
  (Function.prototype as any).context = () => vi.fn();
});
afterAll(() => {
  delete (Function.prototype as any).context;
});

const sheet = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe("ACT's links take the configured brand colours", () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  // Longer than the default timeout, as importing index loads every lifecycle's module graph.
  it("points Carbon's link colours at O3's brand colours when ACT starts", async () => {
    const { startupApp } = await import('../index');
    startupApp();

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--cds-link-primary')).toBe('var(--brand-01)');
    expect(style.getPropertyValue('--cds-link-primary-hover')).toBe('var(--brand-02)');
    expect(style.getPropertyValue('--cds-link-inverse')).toBe('color-mix(in srgb, var(--brand-01) 40%, white)');
    expect(style.getPropertyValue('--cds-link-inverse-hover')).toBe('color-mix(in srgb, var(--brand-01) 25%, white)');
  }, 20000);

  // A text match: it misses a fixed colour by any other name, such as colors.$teal-60 or #78a9ff.
  it.each([
    'src/dashboard/dashboard.scss',
    'src/run-charts/run-charts.scss',
    'src/instance-admin/instance-admin-kpis.scss',
  ])("names none of Carbon's blue tokens, teal-70 or O3's compiled $brand-0N in %s", (path) => {
    expect(sheet(path)).not.toMatch(
      /\$interactive\b|\$focus(?![\w-])|\$link-|colors\.\$blue-\d|#0f62fe|colors\.\$teal-70|\$brand-0\d/i,
    );
  });
});
