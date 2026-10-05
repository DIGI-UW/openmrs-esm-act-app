/**
 * The privileges ACT checks, by page and by action. Each page's extensions declare the same privilege in
 * routes.json, where an implementer can override it with Display conditions.
 */
export const screenPrivileges = {
  home: 'App: act.home',
  registry: 'App: act.registry',
  worklists: 'App: act.worklists',
  waitingList: 'App: act.waitingList',
  screenPositive: 'App: act.screenPositive',
} as const;

export const actionPrivileges = {
  recordProphylaxis: 'Task: act.recordProphylaxis',
  enterClinicalForms: 'Task: act.enterClinicalForms',
  exportData: 'Task: act.exportData',
  registerPatient: 'Add Patients',
  findPatient: 'Get Patients',
} as const;

export type ActScreen = keyof typeof screenPrivileges;
export type ActAction = keyof typeof actionPrivileges;
