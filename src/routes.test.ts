import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import routes from './routes.json';
import { actHomeDashboardMeta, actHomeWidgetsSlot } from './act-home/act-home.meta';

describe('routes.json', () => {
  it('registers every component it names', () => {
    const entry = readFileSync('src/index.ts', 'utf8');
    const exported = [...entry.matchAll(/^export const (\w+) =/gm)].map(([, name]) => name);
    const components = [...routes.extensions, ...routes.workspaces2].map((registration) => registration.component);

    expect(components.filter((component) => !exported.includes(component))).toEqual([]);
  });

  it('adds ACT home to the home app under the name and slot its dashboard renders', () => {
    const link = routes.extensions.find((extension) => extension.slot === 'homepage-dashboard-slot');
    const dashboard = routes.extensions.find((extension) => extension.slot === actHomeDashboardMeta.slot);

    expect(link.meta).toEqual(actHomeDashboardMeta);
    expect(dashboard.component).toBe('actHomeDashboard');
    expect(actHomeWidgetsSlot).not.toBe(actHomeDashboardMeta.slot);
  });
});
