import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import routes from './routes.json';
import { actHomeDashboardMeta, actHomeWidgetsSlot } from './act-home/act-home.meta';
import { registryDashboardMeta } from './registry/registry.meta';
import { waitingListDashboardMeta } from './waiting-list/waiting-list.meta';
import { screenPositiveDashboardMeta } from './screen-positive/screen-positive.meta';

describe('routes.json', () => {
  it('registers every component it names', () => {
    const entry = readFileSync('src/index.ts', 'utf8');
    const exported = [...entry.matchAll(/^export const (\w+) =/gm)].map(([, name]) => name);
    // A component another app exports is named app#component, and is that app's to register.
    const components = [...routes.extensions, ...routes.workspaces2]
      .map((registration) => registration.component)
      .filter((component) => !component.includes('#'));

    expect(components.filter((component) => !exported.includes(component))).toEqual([]);
  });

  it('adds ACT home to the home app under the name and slot its dashboard renders', () => {
    const link = routes.extensions.find((extension) => extension.slot === 'homepage-dashboard-slot');
    const dashboard = routes.extensions.find((extension) => extension.slot === actHomeDashboardMeta.slot);

    expect(link.meta).toEqual(actHomeDashboardMeta);
    expect(dashboard.component).toBe('actHomeDashboard');
    expect(actHomeWidgetsSlot).not.toBe(actHomeDashboardMeta.slot);
  });

  it('adds the registry to the home app under the name and slot its page renders', () => {
    const link = routes.extensions.find((extension) => extension.component === 'registryDashboardLink');
    const page = routes.extensions.find((extension) => extension.slot === registryDashboardMeta.slot);

    expect(link.meta).toEqual(registryDashboardMeta);
    expect(page.component).toBe('registryDashboard');
  });

  it('adds the procedural waiting list to the home app under the name and slot its page renders', () => {
    const link = routes.extensions.find((extension) => extension.component === 'waitingListDashboardLink');
    const page = routes.extensions.find((extension) => extension.slot === waitingListDashboardMeta.slot);

    expect(link.meta).toEqual(waitingListDashboardMeta);
    expect(page.component).toBe('waitingListDashboard');
  });

  it("opens the waiting list's consultations in a workspace of its own, scoped to the waiting list", () => {
    const group = routes.workspaceGroups2.find((g) => g.name === 'act-waiting-list');
    const window = routes.workspaceWindows2.find((w) => w.name === 'act-waiting-list-form-entry');
    const workspace = routes.workspaces2.find((w) => w.name === 'act-waiting-list-form-entry-workspace');

    expect(group.scopePattern).toBe(`/home/${waitingListDashboardMeta.name}`);
    expect(window.group).toBe(group.name);
    expect(workspace).toEqual(
      expect.objectContaining({
        component: '@openmrs/esm-patient-forms-app#exportedPatientFormEntryWorkspace',
        window: window.name,
      }),
    );
  });

  it('adds the screen positive list to the home app under the name and slot its page renders', () => {
    const link = routes.extensions.find((extension) => extension.component === 'screenPositiveDashboardLink');
    const page = routes.extensions.find((extension) => extension.slot === screenPositiveDashboardMeta.slot);

    expect(link.meta).toEqual(screenPositiveDashboardMeta);
    expect(page.component).toBe('screenPositiveDashboard');
  });
});
