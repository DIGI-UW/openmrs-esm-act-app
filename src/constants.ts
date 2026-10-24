// ACT's own UI privileges, declared in the distribution's Initializer privileges CSV.
export const PRIVILEGE_ACT_HOME = 'App: act.home';
export const PRIVILEGE_REGISTRY = 'App: act.registry';
export const PRIVILEGE_WORKLISTS = 'App: act.worklists';
export const PRIVILEGE_WAITING_LIST = 'App: act.waitingList';
export const PRIVILEGE_SCREEN_POSITIVE = 'App: act.screenPositive';
export const PRIVILEGE_DUE_LIST = 'App: act.dueList';
export const PRIVILEGE_DATA_CLERK = 'App: act.dataClerk';
export const PRIVILEGE_INSTANCE_ADMIN = 'App: act.instanceAdmin';
export const PRIVILEGE_COMMUNITY_HOME = 'App: act.communityHome';
export const PRIVILEGE_STATUS_FLAGS = 'App: act.statusFlags';
export const PRIVILEGE_REPORTS = 'App: act.reports';
export const PRIVILEGE_DASHBOARD = 'App: act.dashboard';
export const PRIVILEGE_EXPORT_LISTS = 'Task: act.lists.export';
export const PRIVILEGE_REFRESH_FLAGS = 'Task: act.refreshFlags';
export const PRIVILEGE_STUDIES = 'App: act.studies';
export const PRIVILEGE_MANAGE_STUDIES = 'Task: act.manageStudies';
export const PRIVILEGE_ENTER_CLINICAL_FORMS = 'Task: act.enterClinicalForms';
export const PRIVILEGE_ENTER_PROPHYLAXIS = 'Task: act.enterProphylaxis';
// The audit log module's (auditlogweb): changes such as saved forms, and reads such as opened patients.
export const PRIVILEGE_VIEW_AUDIT_LOGS = 'View Audit Logs';
export const PRIVILEGE_VIEW_READ_AUDIT_LOGS = 'View Read Audit Logs';
export const PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS = 'View Security Audit Logs';
export const PRIVILEGE_DOWNLOAD_DATA = 'Task: act.downloadData';
export const PRIVILEGE_DOWNLOAD_IDENTIFIERS = 'Task: act.downloadIdentifiers';
export const PRIVILEGE_DOWNLOAD_RESEARCH_DATA = 'Task: act.downloadResearchData';
export const PRIVILEGE_SEND_REFERRAL = 'Task: act.sendReferral';

// OpenMRS core privileges for the actions ACT offers, as the services that carry them out require.
export const PRIVILEGE_ADD_PATIENTS = 'Add Patients';
export const PRIVILEGE_GET_PATIENTS = 'Get Patients';
export const PRIVILEGE_ADD_ENCOUNTERS = 'Add Encounters';
export const PRIVILEGE_EDIT_USERS = 'Edit Users';
export const PRIVILEGE_MANAGE_LOCATIONS = 'Manage Locations';
export const PRIVILEGE_MANAGE_ROLES = 'Manage Roles';
