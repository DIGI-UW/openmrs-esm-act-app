import { describe, expect, it } from 'vitest';
import routeFile from './routes.json';
import { screenPrivileges } from './access/screen-access.component';

const routes = routeFile as { extensions: Array<{ name: string; privileges?: string | Array<string> }> };

describe('routes.json privileges', () => {
  it.each([
    ['act-home-dashboard-link', screenPrivileges.home],
    ['act-home-dashboard', screenPrivileges.home],
    ['act-home-quick-actions', screenPrivileges.home],
    ['act-home-worklists', screenPrivileges.worklists],
    ['act-home-waiting-list', screenPrivileges.waitingList],
    ['act-home-care-cascade', screenPrivileges.registry],
    ['act-registry-dashboard-link', screenPrivileges.registry],
    ['act-registry-dashboard', screenPrivileges.registry],
    ['act-worklists-dashboard-link', screenPrivileges.worklists],
    ['act-worklists-dashboard', screenPrivileges.worklists],
    ['act-waiting-list-dashboard-link', screenPrivileges.waitingList],
    ['act-waiting-list-dashboard', screenPrivileges.waitingList],
    ['act-screen-positive-dashboard-link', screenPrivileges.screenPositive],
    ['act-screen-positive-dashboard', screenPrivileges.screenPositive],
  ])('declares %s behind the privilege its component checks', (name, privilege) => {
    expect(routes.extensions.find((extension) => extension.name === name)?.privileges).toEqual(privilege);
  });

  it('declares a privilege on every extension, so none shows to every signed-in user', () => {
    expect(routes.extensions.filter((extension) => !('privileges' in extension)).map(({ name }) => name)).toEqual([]);
  });
});
