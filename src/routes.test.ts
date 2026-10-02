import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import routes from './routes.json';
import { actHomeDashboardMeta, actHomeWidgetsSlot } from './act-home/act-home.meta';
import { registryDashboardMeta } from './registry/registry.meta';
import { waitingListDashboardMeta } from './waiting-list/waiting-list.meta';
import { screenPositiveDashboardMeta } from './screen-positive/screen-positive.meta';
import { worklistsDashboardMeta } from './worklists/worklists.meta';
import { cardiacTestsDashboardMeta } from './cardiac-tests/cardiac-tests.meta';

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

  it('adds the Worklists page to the home app under the name and slot its page renders, after the registry', () => {
    const links = routes.extensions.filter((extension) => extension.slot === 'homepage-dashboard-slot');
    const link = links.find((extension) => extension.component === 'worklistsDashboardLink');
    const page = routes.extensions.find((extension) => extension.slot === worklistsDashboardMeta.slot);

    expect(link.meta).toEqual(worklistsDashboardMeta);
    expect(page.component).toBe('worklistsDashboard');
    expect(links.indexOf(link)).toBe(
      links.findIndex((extension) => extension.component === 'registryDashboardLink') + 1,
    );
  });

  it("registers ACT's home nav links in the prototype's order, with no order of their own", () => {
    const links = routes.extensions.filter((extension) => extension.slot === 'homepage-dashboard-slot');

    expect(links.filter((extension) => 'order' in extension)).toEqual([]);
    expect(links.map((extension) => extension.component)).toEqual([
      'actHomeDashboardLink',
      'registryDashboardLink',
      'worklistsDashboardLink',
      'waitingListDashboardLink',
      'screenPositiveDashboardLink',
    ]);
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

  it("adds the prophylaxis status tag to the patient banner's tags", () => {
    const tag = routes.extensions.find((extension) => extension.component === 'prophylaxisStatusTag');

    expect(tag.slot).toBe('patient-banner-tags-slot');
  });

  it('adds the Prophylaxis card to the patient summary', () => {
    const card = routes.extensions.find((extension) => extension.component === 'prophylaxisCard');

    expect(card.slot).toBe('patient-chart-summary-dashboard-slot');
    // The summary lays its cards two to a row unless one asks for the whole row.
    expect(card).toMatchObject({ order: 0, meta: { fullWidth: true } });
  });

  it("registers the chart's Cardiac tests page under the slot and path its link names, for a distro to add to the chart's nav", () => {
    const link = routes.extensions.find((extension) => extension.component === 'cardiacTestsDashboardLink');
    const page = routes.extensions.find((extension) => extension.component === 'cardiacTestsDashboard');

    expect(link.meta).toEqual(cardiacTestsDashboardMeta);
    // The chart's pages are the distro's to choose (DIGI-UW/openmrs-module-actcore#29), so the link names no slot.
    expect(link).not.toHaveProperty('slot');
    expect(page.slot).toBe(cardiacTestsDashboardMeta.slot);
    expect(page.meta).toEqual({ fullWidth: true });
  });
});
