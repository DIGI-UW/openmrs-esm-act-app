import { describe, expect, it } from 'vitest';
import routeFile from './routes.json';
import {
  PRIVILEGE_ACT_HOME,
  PRIVILEGE_DUE_LIST,
  PRIVILEGE_COMMUNITY_HOME,
  PRIVILEGE_DATA_CLERK,
  PRIVILEGE_REGISTRY,
  PRIVILEGE_REPORTS,
  PRIVILEGE_SCREEN_POSITIVE,
  PRIVILEGE_WAITING_LIST,
  PRIVILEGE_WORKLISTS,
} from './constants';

const screenPrivileges = {
  home: PRIVILEGE_ACT_HOME,
  registry: PRIVILEGE_REGISTRY,
  worklists: PRIVILEGE_WORKLISTS,
  waitingList: PRIVILEGE_WAITING_LIST,
  screenPositive: PRIVILEGE_SCREEN_POSITIVE,
  dueList: PRIVILEGE_DUE_LIST,
  dataClerk: PRIVILEGE_DATA_CLERK,
  communityHome: PRIVILEGE_COMMUNITY_HOME,
  reports: PRIVILEGE_REPORTS,
};

const routes = routeFile as {
  extensions: Array<{ name: string; slot?: string; order?: number; privileges?: string | Array<string> }>;
};

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
    ['act-due-for-prophylaxis-dashboard-link', screenPrivileges.dueList],
    ['act-due-for-prophylaxis-dashboard', screenPrivileges.dueList],
    ['act-due-for-prophylaxis-widget', screenPrivileges.dueList],
    ['act-community-home-dashboard-link', screenPrivileges.communityHome],
    ['act-community-home-dashboard', screenPrivileges.communityHome],
    ['act-community-home-quick-actions', screenPrivileges.communityHome],
    ['act-community-home-record-bpg', 'Add Encounters'],
    ['act-community-home-record-oral', 'Add Encounters'],
    ['act-community-home-register-patient', 'Add Patients'],
    ['act-community-home-find-patient', 'Get Patients'],
    ['act-community-home-facility-report', screenPrivileges.dataClerk],
    ['act-home-register-patient', 'Add Patients'],
    ['act-home-enter-prophylaxis', 'Add Encounters'],
    ['act-home-find-patient', 'Get Patients'],
    ['act-back-to-act-link', 'Get Patients'],
    ['act-admin-nav', screenPrivileges.home],
    ['act-reports-dashboard-link', screenPrivileges.reports],
    ['act-reports-dashboard', screenPrivileges.reports],
    ['act-facility-reports-dashboard-link', screenPrivileges.dataClerk],
    ['act-facility-reports-dashboard', screenPrivileges.dataClerk],
  ])("declares %s behind its screen's privilege", (name, privilege) => {
    expect(routes.extensions.find((extension) => extension.name === name)?.privileges).toEqual(privilege);
  });

  it.each([
    ['act-community-home-widgets-slot', ['act-community-home-quick-actions', 'act-due-for-prophylaxis-widget']],
    [
      'act-community-home-quick-actions-slot',
      [
        'act-community-home-record-bpg',
        'act-community-home-record-oral',
        'act-community-home-register-patient',
        'act-community-home-find-patient',
        'act-community-home-facility-report',
      ],
    ],
    [
      'act-home-quick-actions-slot',
      ['act-home-register-patient', 'act-home-enter-prophylaxis', 'act-home-find-patient'],
    ],
    [
      'rhd-home-widgets-slot',
      ['act-home-quick-actions', 'act-home-worklists', 'act-home-waiting-list', 'act-home-care-cascade'],
    ],
  ])("fills %s in the mockup's order", (slot, names) => {
    expect(
      routes.extensions
        .filter((extension) => extension.slot === slot)
        .sort((a, b) => a.order - b.order)
        .map(({ name }) => name),
    ).toEqual(names);
  });

  it('declares a privilege on every extension, so none shows to every signed-in user', () => {
    expect(routes.extensions.filter((extension) => !('privileges' in extension)).map(({ name }) => name)).toEqual([]);
  });
});
